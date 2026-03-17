import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { connectDB } from '@/lib/mongodb';
import { authOptions } from '@/lib/auth';
import Produit from '@/models/Produit';

const OptionSchema = z.object({
  nom: z.string().min(1),
  prix: z.number().int().min(0),
});

const ProduitSchema = z.object({
  nom: z.string().min(1, 'Le nom est requis'),
  description: z.string().min(1, 'La description est requise'),
  categorie: z.string().min(1, 'La catégorie est requise'),
  prix: z.number().int().min(0, 'Le prix doit être positif'),
  options: z.array(OptionSchema).default([]),
  actif: z.boolean().default(true),
});

// GET /api/produits
//   - Public (sans ?all=true) : produits actifs uniquement
//   - Admin (?all=true avec session) : tous les produits
export async function GET(request: NextRequest) {
  try {
    const all = request.nextUrl.searchParams.get('all') === 'true';

    // Si on demande tous les produits, vérifier l'authentification admin
    if (all) {
      const session = await getServerSession(authOptions);
      if (!session) {
        return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
      }
    }

    await connectDB();
    const filtre = all ? {} : { actif: true };
    const produits = await Produit.find(filtre).sort({ categorie: 1, nom: 1 }).lean();
    return NextResponse.json({ data: produits });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// POST /api/produits — admin : créer un produit
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = ProduitSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    await connectDB();
    const produit = await Produit.create(parsed.data);
    return NextResponse.json({ data: produit }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
