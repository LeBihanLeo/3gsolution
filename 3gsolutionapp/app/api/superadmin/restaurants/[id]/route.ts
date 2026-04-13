// TICK-138 — API super-admin : détail, update, suppression restaurant
// TICK-161 — Stripe Connect : retrait de tous les champs Stripe (gérés par l'admin restaurant)
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

const UpdateSchema = z.object({
  nom: z.string().min(1).max(100).optional(),
  domaine: z.string().min(1).max(200).optional(),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/).optional(),
  adminEmail: z.string().email().optional(),
  adminPassword: z.string().min(8).optional(),
  couleurPrimaire: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  couleurSecondaire: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  horaireOuverture: z.string().optional(),
  horaireFermeture: z.string().optional(),
  // Stripe : géré exclusivement par l'admin restaurant via /admin/stripe (OAuth Connect)
});

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/superadmin/restaurants/[id]
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { error } = await requireSuperAdmin();
  if (error) return error;

  const { id } = await params;
  await connectDB();

  const restaurant = await Restaurant.findById(id)
    .select('-adminPasswordHash')
    .lean();

  if (!restaurant) return NextResponse.json({ error: 'Restaurant introuvable' }, { status: 404 });
  return NextResponse.json({ data: restaurant });
}

// PUT /api/superadmin/restaurants/[id]
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { error } = await requireSuperAdmin();
  if (error) return error;

  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = UpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    await connectDB();

    const { adminPassword, ...rest } = parsed.data;

    const update: Record<string, unknown> = { ...rest };

    if (adminPassword) {
      update.adminPasswordHash = await bcrypt.hash(adminPassword, 12);
    }

    const restaurant = await Restaurant.findByIdAndUpdate(
      id,
      { $set: update },
      { new: true }
    ).select('-adminPasswordHash').lean();

    if (!restaurant) return NextResponse.json({ error: 'Restaurant introuvable' }, { status: 404 });
    return NextResponse.json({ data: restaurant });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// DELETE /api/superadmin/restaurants/[id]
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { error } = await requireSuperAdmin();
  if (error) return error;

  const { id } = await params;
  await connectDB();

  const restaurant = await Restaurant.findByIdAndDelete(id);
  if (!restaurant) return NextResponse.json({ error: 'Restaurant introuvable' }, { status: 404 });

  return NextResponse.json({ data: { message: 'Restaurant supprimé' } });
}
