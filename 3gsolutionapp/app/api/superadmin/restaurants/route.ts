// TICK-138 — API super-admin : liste + création restaurants
// TICK-161 — Stripe Connect : retrait des champs secrets Stripe du schema de création
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import Restaurant from '@/models/Restaurant';

async function requireSuperAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as { role?: string }).role !== 'superadmin') {
    return { error: NextResponse.json({ error: 'Accès refusé.' }, { status: 403 }) };
  }
  return { error: null };
}

const CreateRestaurantSchema = z.object({
  nom: z.string().min(1).max(100),
  domaine: z.string().min(1).max(200),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, 'Slug: lettres minuscules, chiffres, tirets uniquement'),
  adminEmail: z.string().email(),
  adminPassword: z.string().min(8, 'Mot de passe admin : 8 caractères minimum'),
  couleurPrimaire: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#E63946'),
  couleurSecondaire: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#ffffff'),
  horaireOuverture: z.string().default('11:30'),
  horaireFermeture: z.string().default('14:00'),
  // Stripe Connect : l'onboarding se fait via OAuth (/api/stripe/connect), pas ici
});

// GET /api/superadmin/restaurants — liste tous les restaurants
export async function GET() {
  const { error } = await requireSuperAdmin();
  if (error) return error;

  await connectDB();
  // Ne jamais exposer adminPasswordHash
  const restaurants = await Restaurant.find()
    .select('-adminPasswordHash')
    .sort({ createdAt: -1 })
    .lean();

  return NextResponse.json({ data: restaurants });
}

// POST /api/superadmin/restaurants — créer un restaurant
export async function POST(request: NextRequest) {
  const { error } = await requireSuperAdmin();
  if (error) return error;

  try {
    const body = await request.json();
    const parsed = CreateRestaurantSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    await connectDB();

    const { adminPassword, ...rest } = parsed.data;
    const adminPasswordHash = await bcrypt.hash(adminPassword, 12);

    const restaurant = await Restaurant.create({
      ...rest,
      adminPasswordHash,
    });

    return NextResponse.json({
      data: {
        _id: restaurant._id,
        nom: restaurant.nom,
        domaine: restaurant.domaine,
        slug: restaurant.slug,
        adminEmail: restaurant.adminEmail,
      },
    }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error && err.message.includes('duplicate key')
      ? 'Ce domaine ou slug est déjà utilisé'
      : 'Erreur serveur';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
