// TICK-175 — Route dépréciée (OAuth v1 Stripe Connect).
// Remplacée par POST /api/stripe/connect/initiate (Accounts v2).
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(
    { error: 'Route dépréciée. Utiliser POST /api/stripe/connect/initiate (Stripe Accounts v2).' },
    { status: 410 }
  );
}
