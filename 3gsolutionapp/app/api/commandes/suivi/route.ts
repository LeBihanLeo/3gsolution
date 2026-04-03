import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Commande from '@/models/Commande';

// CVE-07 — Format attendu pour les session_id Stripe et mock
// Stripe : cs_live_... ou cs_test_... (longueur ~58-80 chars)
// Mock   : mock_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
const SESSION_ID_REGEX = /^(cs_(live|test)_[a-zA-Z0-9]{20,100}|mock_[0-9a-f-]{36})$/;

/**
 * GET /api/commandes/suivi?session_id=xxx
 * Endpoint public — retourne le statut et les infos non-sensibles d'une commande.
 * Les données personnelles (téléphone, email) sont exclues de la réponse.
 */
export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('session_id');

  if (!sessionId || sessionId.trim() === '') {
    return NextResponse.json(
      { error: 'Paramètre session_id manquant' },
      { status: 400 }
    );
  }

  // CVE-07 — Valider la longueur et le format avant toute requête MongoDB
  // Empêche les entrées arbitrairement longues et les tentatives d'injection
  if (sessionId.length > 200 || !SESSION_ID_REGEX.test(sessionId)) {
    return NextResponse.json(
      { error: 'Paramètre session_id invalide' },
      { status: 400 }
    );
  }

  await connectDB();

  const commande = await Commande.findOne({ stripeSessionId: sessionId }).lean();

  if (!commande) {
    return NextResponse.json(
      { error: 'Commande introuvable' },
      { status: 404 }
    );
  }

  // Les commandes en attente de paiement ne sont pas encore confirmées
  if (commande.statut === 'en_attente_paiement') {
    return NextResponse.json(
      { error: 'Commande non encore confirmée' },
      { status: 404 }
    );
  }

  // Réponse filtrée : on exclut les données personnelles sensibles
  return NextResponse.json({
    commandeId: commande._id.toString(),
    statut: commande.statut,
    retrait: commande.retrait,
    produits: commande.produits.map((p) => ({
      nom: p.nom,
      quantite: p.quantite,
    })),
    total: commande.total,
    createdAt: commande.createdAt,
  });
}
