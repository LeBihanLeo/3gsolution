// TICK-188 — Statut 2FA du compte admin courant
// GET /api/admin/2fa/status → { enabled: boolean }
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { connectDB } from '@/lib/mongodb';
import Restaurant from '@/models/Restaurant';
import { authOptions } from '@/lib/auth';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as { role?: string }).role !== 'admin') {
    return NextResponse.json({ error: 'Accès refusé.' }, { status: 401 });
  }

  await connectDB();
  const restaurantId = (session.user as { restaurantId?: string }).restaurantId;
  const restaurant = await Restaurant.findById(restaurantId)
    .select('+adminTotpSecret')
    .lean();

  return NextResponse.json({ enabled: !!restaurant?.adminTotpSecret });
}
