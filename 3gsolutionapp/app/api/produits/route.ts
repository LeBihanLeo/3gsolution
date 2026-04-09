// TICK-133 — Scoping produits par restaurantId (multi-tenant)
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
]).default(10); // TICK-127

const ProduitSchema = z.object({
  nom: z.string().min(1, 'Le nom est requis'),
  description: z.string().min(1, 'La description est requise'),
  categorie: z.string().min(1, 'La catégorie est requise'),
  prix: z.number().int().min(0, 'Le prix doit être positif'),
  taux_tva: TauxTvaSchema, // TICK-127
  options: z.array(OptionSchema).default([]),
  imageUrl: z.string().min(1).optional().nullable(), // TICK-036
  actif: z.boolean().default(true),
});

// GET /api/produits
//   - Public (sans ?all=true) : produits actifs du tenant courant uniquement
//   - Admin (?all=true avec session) : tous les produits du tenant courant
export async function GET(request: NextRequest) {
  try {
    const all = request.nextUrl.searchParams.get('all') === 'true';

    // CVE-02 — Si on demande tous les produits, vérifier le rôle admin
    if (all) {
      const check = await requireAdmin();
      if (check.error) return check.error;
    }

    const restaurantId = await getTenantId();
    await connectDB();
    const filtre = all ? { restaurantId } : { restaurantId, actif: true };
    const produits = await Produit.find(filtre).sort({ categorie: 1, nom: 1 }).lean();
    return NextResponse.json({ data: produits });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// POST /api/produits — admin : créer un produit pour le tenant courant
export async function POST(request: NextRequest) {
  // CVE-02 — vérification de rôle 'admin'
  const check = await requireAdmin();
  if (check.error) return check.error;

  try {
    const restaurantId = await getTenantId();
    const body = await request.json();
    const parsed = ProduitSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    await connectDB();
    const produit = await Produit.create({ ...parsed.data, restaurantId });
    return NextResponse.json({ data: produit }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
