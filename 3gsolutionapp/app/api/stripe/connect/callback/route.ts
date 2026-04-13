// TICK-175 — Route dépréciée (OAuth v1 Stripe Connect).
// Remplacée par GET /api/stripe/connect/return (Accounts v2).
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(
    { error: 'Route dépréciée. Utiliser GET /api/stripe/connect/return (Stripe Accounts v2).' },
    { status: 410 }
  );
}
