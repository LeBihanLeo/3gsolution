// TICK-133 — Vérification ownership produit par restaurantId (multi-tenant)
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { connectDB } from '@/lib/mongodb';
import { requireAdmin } from '@/lib/assertAdmin';
import { getTenantId } from '@/lib/tenant';
import Produit from '@/models/Produit';

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
  taux_tva: TauxTvaSchema.optional(), // TICK-127
  options: z.array(OptionSchema).optional(),
  imageUrl: z.string().min(1).optional().nullable(), // TICK-036 — null pour supprimer l'image
  actif: z.boolean().optional(),
});

type RouteParams = { params: Promise<{ id: string }> };

// PUT /api/produits/[id] — admin : modifier un produit (ownership vérifié)
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const check = await requireAdmin();
  if (check.error) return check.error;

  try {
    const { id } = await params;
    const restaurantId = await getTenantId();
    const body = await request.json();
    const parsed = ProduitUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    await connectDB();
    // TICK-133 — vérifier que le produit appartient au tenant courant
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

// PATCH /api/produits/[id] — admin : toggle actif/inactif (ownership vérifié)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const check = await requireAdmin();
  if (check.error) return check.error;

  try {
    const { id } = await params;
    const restaurantId = await getTenantId();
    const body = await request.json();
    const parsed = z.object({ actif: z.boolean() }).safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Le champ "actif" (booléen) est requis' }, { status: 400 });
    }

    await connectDB();
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

// DELETE /api/produits/[id] — admin : supprimer un produit (ownership vérifié)
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const check = await requireAdmin();
  if (check.error) return check.error;

  try {
    const { id } = await params;
    const restaurantId = await getTenantId();
    await connectDB();
    const produit = await Produit.findOneAndDelete({ _id: id, restaurantId });

    if (!produit) {
      return NextResponse.json({ error: 'Produit introuvable' }, { status: 404 });
    }

    return NextResponse.json({ data: { message: 'Produit supprimé' } });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
