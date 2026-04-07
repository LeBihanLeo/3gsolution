// TICK-138 — Super-admin : liste des restaurants (GET) + création (POST)
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { connectDB } from '@/lib/mongodb';
import Restaurant from '@/models/Restaurant';
import Produit from '@/models/Produit';
import Commande from '@/models/Commande';
import { requireSuperadmin } from '@/lib/superadmin-guard';
import { upsertEdgeConfigDomains } from '@/lib/edge-config';

const CreateRestaurantSchema = z.object({
  nomRestaurant: z.string().min(1, 'Nom requis'),
  slug: z
    .string()
    .min(1, 'Slug requis')
    .regex(/^[a-z0-9-]+$/, 'Slug : minuscules, chiffres et tirets uniquement'),
  domaine: z.string().min(1, 'Domaine requis'),
  domainesAlternatifs: z.array(z.string()).optional().default([]),
  adminEmail: z.string().email('Email admin invalide'),
  adminPassword: z.string().min(8, 'Mot de passe admin : 8 caractères minimum'),
  stripeSecretKey: z.string().min(1, 'Clé secrète Stripe requise'),
  stripePublishableKey: z.string().min(1, 'Clé publique Stripe requise'),
  stripeWebhookSecret: z.string().min(1, 'Secret webhook Stripe requis'),
  horaireOuverture: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'Format HH:MM')
    .optional()
    .default('11:30'),
  horaireFermeture: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'Format HH:MM')
    .optional()
    .default('14:00'),
  couleurPrincipale: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Couleur hex requise (#RRGGBB)')
    .optional()
    .default('#E63946'),
  emailFrom: z.string().email().optional(),
});

// ── GET : tableau des restaurants ─────────────────────────────────────────────
export async function GET() {
  const { error } = await requireSuperadmin();
  if (error) return error;

  await connectDB();

  const restaurants = await Restaurant.find({})
    .select('nomRestaurant slug domaine adminEmail stripePublishableKey createdAt')
    .lean();

  const results = await Promise.all(
    restaurants.map(async (resto) => {
      const [nbProduits, nbCommandes] = await Promise.all([
        Produit.countDocuments({ restaurantId: resto._id }),
        Commande.countDocuments({ restaurantId: resto._id }),
      ]);
      return {
        _id: resto._id,
        nomRestaurant: resto.nomRestaurant,
        slug: resto.slug,
        domaine: resto.domaine,
        adminEmail: resto.adminEmail,
        nbProduits,
        nbCommandes,
        createdAt: resto.createdAt,
      };
    })
  );

  return NextResponse.json({ data: results });
}

// ── POST : créer un restaurant ────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const { error } = await requireSuperadmin();
  if (error) return error;

  const body = await request.json().catch(() => null);
  const parsed = CreateRestaurantSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation échouée.', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { adminPassword, ...fields } = parsed.data;
  const adminPasswordHash = await bcrypt.hash(adminPassword, 12);

  await connectDB();

  try {
    const restaurant = await Restaurant.create({ ...fields, adminPasswordHash });

    // Sync Edge Config (fire-and-forget) — non-bloquant, ne rollback pas la création
    const domainsToSync: Record<string, string> = {
      [fields.domaine]: restaurant._id.toString(),
    };
    for (const alt of fields.domainesAlternatifs ?? []) {
      domainsToSync[alt] = restaurant._id.toString();
    }
    upsertEdgeConfigDomains(domainsToSync).catch((err) =>
      console.error('[superadmin] sync Edge Config échoué après création :', err)
    );

    return NextResponse.json(
      { data: { _id: restaurant._id, slug: restaurant.slug } },
      { status: 201 }
    );
  } catch (err: unknown) {
    if ((err as { code?: number }).code === 11000) {
      return NextResponse.json(
        { error: 'Slug, domaine ou email admin déjà utilisé.' },
        { status: 409 }
      );
    }
    throw err;
  }
}
