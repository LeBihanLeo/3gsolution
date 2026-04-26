// TICK-190 — API onboarding admin
// GET  → { completed: boolean, steps: string[] }
// PATCH { stepId: string }    → marque une étape comme complétée
// PATCH { completeAll: true } → marque l'onboarding entier comme terminé
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import Restaurant from '@/models/Restaurant';

const VALID_STEPS = ['personnalisation', 'menu', 'stripe', 'commandes', '2fa'] as const;

const PatchSchema = z.union([
  z.object({ stepId: z.enum(VALID_STEPS) }),
  z.object({ completeAll: z.literal(true) }),
]);

function adminGuard(session: ReturnType<typeof Object.create> | null): string | null {
  const user = session?.user as { role?: string; restaurantId?: string } | undefined;
  if (!user || user.role !== 'admin' || !user.restaurantId) return null;
  return user.restaurantId;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const restaurantId = adminGuard(session);
  if (!restaurantId) {
    return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 });
  }

  await connectDB();
  const restaurant = await Restaurant.findById(restaurantId)
    .select('onboardingCompleted onboardingStepsCompleted')
    .lean();

  if (!restaurant) {
    return NextResponse.json({ error: 'Restaurant introuvable.' }, { status: 404 });
  }

  return NextResponse.json({
    completed: restaurant.onboardingCompleted ?? false,
    steps: restaurant.onboardingStepsCompleted ?? [],
  });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const restaurantId = adminGuard(session);
  if (!restaurantId) {
    return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide.' }, { status: 400 });
  }

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Payload invalide.', details: parsed.error.flatten() }, { status: 422 });
  }

  await connectDB();

  if ('completeAll' in parsed.data) {
    await Restaurant.findByIdAndUpdate(restaurantId, {
      $set: { onboardingCompleted: true },
    });
    return NextResponse.json({ ok: true, completed: true });
  }

  // Marque l'étape (addToSet évite les doublons)
  await Restaurant.findByIdAndUpdate(restaurantId, {
    $addToSet: { onboardingStepsCompleted: parsed.data.stepId },
  });
  return NextResponse.json({ ok: true, step: parsed.data.stepId });
}
