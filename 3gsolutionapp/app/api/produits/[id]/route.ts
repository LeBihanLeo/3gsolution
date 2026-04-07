import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { connectDB } from '@/lib/mongodb';
import { requireAdmin } from '@/lib/assertAdmin';
import Produit from '@/models/Produit';
import { getTenantId, resolveTenantForAdmin } from '@/lib/tenant';

const OptionSchema = z.object({
  nom: z.string().min(1),
  prix: z.number().int().min(0),
});

const TauxTvaSchema = z.union([
  z.literal(0),
  z.literal(5.5),
  z.literal(10),
  z.literal(20),
]); // TICK-127

const ProduitUpdateSchema = z.object({
  nom: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  categorie: z.string().min(1).optional(),
  prix: z.number().int().min(0).optional(),
  taux_tva: TauxTvaSchema.optional(), // TICK-127 — inchangé si absent du body
  options: z.array(OptionSchema).optional(),
  imageUrl: z.preprocess((v) => (v === '' ? undefined : v), z.string().min(1).optional().nullable()), // TICK-036 — null pour supprimer l'image
  actif: z.boolean().optional(),
});

type RouteParams = { params: Promise<{ id: string }> };

// PUT /api/produits/[id] — admin : modifier un produit complet
export async function PUT(request: NextRequest, { params }: RouteParams) {
  // CVE-02 — vérification de rôle 'admin'
  const check = await requireAdmin();
  if (check.error) return check.error;

  try {
    const { id } = await params;
    const restaurantId = await resolveTenantForAdmin(check.session);
    if (!restaurantId) {
      return NextResponse.json({ error: 'Tenant non résolu' }, { status: 400 });
    }

    const body = await request.json();
    const parsed = ProduitUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    await connectDB();
    // TICK-133 — Sécurité cross-tenant : filtre par restaurantId
    const produit = await Produit.findOneAndUpdate(
      { _id: id, restaurantId },
      parsed.data,
      { new: true, runValidators: true }
    );

    if (!produit) {
      return NextResponse.json({ error: 'Produit introuvable' }, { status: 404 });
    }

    return NextResponse.json({ data: produit });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// PATCH /api/produits/[id] — admin : toggle actif/inactif
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  // CVE-02 — vérification de rôle 'admin'
  const check = await requireAdmin();
  if (check.error) return check.error;

  try {
    const { id } = await params;
    const restaurantId = await resolveTenantForAdmin(check.session);
    if (!restaurantId) {
      return NextResponse.json({ error: 'Tenant non résolu' }, { status: 400 });
    }

    const body = await request.json();
    const parsed = z.object({ actif: z.boolean() }).safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Le champ "actif" (booléen) est requis' }, { status: 400 });
    }

    await connectDB();
    // TICK-133 — Sécurité cross-tenant
    const produit = await Produit.findOneAndUpdate(
      { _id: id, restaurantId },
      { actif: parsed.data.actif },
      { new: true }
    );

    if (!produit) {
      return NextResponse.json({ error: 'Produit introuvable' }, { status: 404 });
    }

    return NextResponse.json({ data: produit });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// DELETE /api/produits/[id] — admin : supprimer un produit
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  // CVE-02 — vérification de rôle 'admin'
  const check = await requireAdmin();
  if (check.error) return check.error;

  try {
    const { id } = await params;
    const restaurantId = await resolveTenantForAdmin(check.session);
    if (!restaurantId) {
      return NextResponse.json({ error: 'Tenant non résolu' }, { status: 400 });
    }

    await connectDB();
    // TICK-133 — Sécurité cross-tenant
    const produit = await Produit.findOneAndDelete({ _id: id, restaurantId });

    if (!produit) {
      return NextResponse.json({ error: 'Produit introuvable' }, { status: 404 });
    }

    return NextResponse.json({ data: { message: 'Produit supprimé' } });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
