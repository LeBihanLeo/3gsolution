// TICK-138 — Super-admin : modifier (PUT) et supprimer (DELETE) un restaurant
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/mongodb';
import { invalidateStripeClient } from '@/lib/stripe';
import Restaurant from '@/models/Restaurant';
import Produit from '@/models/Produit';
import Commande from '@/models/Commande';
import { requireSuperadmin } from '@/lib/superadmin-guard';
import { upsertEdgeConfigDomains, removeEdgeConfigDomains } from '@/lib/edge-config';

const UpdateRestaurantSchema = z
  .object({
    nomRestaurant: z.string().min(1).optional(),
    slug: z
      .string()
      .min(1)
      .regex(/^[a-z0-9-]+$/)
      .optional(),
    domaine: z.string().min(1).optional(),
    domainesAlternatifs: z.array(z.string()).optional(),
    adminEmail: z.string().email().optional(),
    adminPassword: z.string().min(8).optional(),
    stripeSecretKey: z.string().min(1).optional(),
    stripePublishableKey: z.string().min(1).optional(),
    stripeWebhookSecret: z.string().min(1).optional(),
    horaireOuverture: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    horaireFermeture: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    couleurPrincipale: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    emailFrom: z.string().email().optional(),
    fermeeAujourdhui: z.boolean().optional(),
  })
  .strict();

type Params = { params: Promise<{ id: string }> };

// ── PUT : modifier un restaurant ──────────────────────────────────────────────
export async function PUT(request: NextRequest, { params }: Params) {
  const { error } = await requireSuperadmin();
  if (error) return error;

  const { id } = await params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: 'ID invalide.' }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = UpdateRestaurantSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation échouée.', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { adminPassword, ...fields } = parsed.data;
  const update: Record<string, unknown> = { ...fields };

  if (adminPassword) {
    update.adminPasswordHash = await bcrypt.hash(adminPassword, 12);
  }

  await connectDB();

  // Lire le document avant modification pour détecter les changements de domaine
  const domaineChanged = parsed.data.domaine !== undefined || parsed.data.domainesAlternatifs !== undefined;
  const oldRestaurant = domaineChanged
    ? await Restaurant.findById(id).select('domaine domainesAlternatifs').lean()
    : null;

  const restaurant = await Restaurant.findByIdAndUpdate(
    id,
    { $set: update },
    { new: true, runValidators: true }
  );

  if (!restaurant) {
    return NextResponse.json({ error: 'Restaurant introuvable.' }, { status: 404 });
  }

  // TICK-139 — invalider le cache Stripe si les clés ont changé
  if (parsed.data.stripeSecretKey || parsed.data.stripeWebhookSecret) {
    invalidateStripeClient(id);
  }

  // Sync Edge Config si le domaine a changé (fire-and-forget)
  if (domaineChanged && oldRestaurant) {
    const oldDomains = [oldRestaurant.domaine, ...(oldRestaurant.domainesAlternatifs ?? [])];
    const newDomains = [restaurant.domaine, ...(restaurant.domainesAlternatifs ?? [])];
    const toRemove = oldDomains.filter((d) => !newDomains.includes(d));
    const tenantId = restaurant._id.toString();
    const toAdd: Record<string, string> = {};
    for (const d of newDomains) toAdd[d] = tenantId;

    if (toRemove.length > 0) {
      removeEdgeConfigDomains(toRemove).catch((err) =>
        console.error('[superadmin] remove Edge Config échoué après PUT :', err)
      );
    }
    upsertEdgeConfigDomains(toAdd).catch((err) =>
      console.error('[superadmin] upsert Edge Config échoué après PUT :', err)
    );
  }

  return NextResponse.json({
    data: { _id: restaurant._id, slug: restaurant.slug, nomRestaurant: restaurant.nomRestaurant },
  });
}

// ── DELETE : supprimer un restaurant (+ cascade produits) ─────────────────────
// Refuse si des commandes existent (protection données comptables).
export async function DELETE(_request: NextRequest, { params }: Params) {
  const { error } = await requireSuperadmin();
  if (error) return error;

  const { id } = await params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: 'ID invalide.' }, { status: 400 });
  }

  await connectDB();

  const nbCommandes = await Commande.countDocuments({ restaurantId: id });
  if (nbCommandes > 0) {
    return NextResponse.json(
      {
        error: `Impossible de supprimer : ${nbCommandes} commande(s) associée(s). Les données comptables sont protégées.`,
      },
      { status: 409 }
    );
  }

  const restaurant = await Restaurant.findById(id).select('domaine domainesAlternatifs');
  if (!restaurant) {
    return NextResponse.json({ error: 'Restaurant introuvable.' }, { status: 404 });
  }

  const domainsToRemove = [restaurant.domaine, ...(restaurant.domainesAlternatifs ?? [])];

  // Cascade : supprimer les produits du restaurant
  await Produit.deleteMany({ restaurantId: id });
  await Restaurant.deleteOne({ _id: id });

  // Retirer les domaines de Edge Config (fire-and-forget)
  removeEdgeConfigDomains(domainsToRemove).catch((err) =>
    console.error('[superadmin] remove Edge Config échoué après DELETE :', err)
  );

  return NextResponse.json({ ok: true });
}
