// TICK-068 — POST /api/client/verify-email
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Client from '@/models/Client';

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 });
  }

  const token = (body as { token?: unknown }).token;
  if (!token || typeof token !== 'string') {
    return NextResponse.json({ error: 'Token invalide.' }, { status: 400 });
  }

  await connectDB();

  const client = await Client.findOne({ emailVerifyToken: token });

  if (!client) {
    // Message générique — pas d'info sur l'existence du compte
    return NextResponse.json({ error: 'Token invalide.' }, { status: 400 });
  }

  if (!client.emailVerifyTokenExpiry || client.emailVerifyTokenExpiry < new Date()) {
    // Token expiré → suppression du compte (token inutilisable, re-inscription nécessaire)
    await Client.deleteOne({ _id: client._id });
    return NextResponse.json(
      { error: 'Lien de vérification expiré. Veuillez vous réinscrire.' },
      { status: 400 }
    );
  }

  // Token valide → activation du compte
  await Client.updateOne(
    { _id: client._id },
    {
      $set: { emailVerified: true },
      $unset: { emailVerifyToken: '', emailVerifyTokenExpiry: '' },
    }
  );

  return NextResponse.json({ message: 'Email vérifié avec succès. Vous pouvez vous connecter.' });
}
