import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import mongoose from 'mongoose';

const { mockFindOne } = vi.hoisted(() => ({ mockFindOne: vi.fn() }));

vi.mock('@/lib/mongodb', () => ({ connectDB: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/models/Commande', () => ({
  default: { findOne: mockFindOne },
}));

import { GET } from '@/app/api/commandes/suivi/route';

const makeReq = (sessionId?: string) => {
  const url = sessionId
    ? `http://localhost/api/commandes/suivi?session_id=${sessionId}`
    : 'http://localhost/api/commandes/suivi';
  return new NextRequest(url);
};

// CVE-07 — session_id doit correspondre au regex (cs_test_ + 20+ chars)
const VALID_SESSION_ID = 'cs_test_AbCdEfGhIjKlMnOpQrStUv12345';
const mockCommandePayee = {
  _id: new mongoose.Types.ObjectId('aaaaaaaaaaaaaaaaaaaaaaaa'),
  stripeSessionId: VALID_SESSION_ID,
  statut: 'payee',
  retrait: { type: 'immediat' },
  produits: [{ nom: 'Burger', quantite: 2 }],
  total: 1700,
  createdAt: new Date(),
  client: { nom: 'Jean', telephone: '0612345678' },
};

describe('GET /api/commandes/suivi', () => {
  beforeEach(() => vi.clearAllMocks());

  it('session_id absent → 400', async () => {
    const res = await GET(makeReq());
    expect(res.status).toBe(400);
  });

  it('session_id inconnu → 404', async () => {
    mockFindOne.mockReturnValueOnce({ lean: vi.fn().mockResolvedValue(null) });
    const res = await GET(makeReq(VALID_SESSION_ID));
    expect(res.status).toBe(404);
  });

  it('statut en_attente_paiement → 404', async () => {
    mockFindOne.mockReturnValueOnce({
      lean: vi.fn().mockResolvedValue({ ...mockCommandePayee, statut: 'en_attente_paiement' }),
    });
    const res = await GET(makeReq(VALID_SESSION_ID));
    expect(res.status).toBe(404);
  });

  it('commande payee → 200 + réponse sans données sensibles', async () => {
    mockFindOne.mockReturnValueOnce({
      lean: vi.fn().mockResolvedValue(mockCommandePayee),
    });
    const res = await GET(makeReq(VALID_SESSION_ID));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.statut).toBe('payee');
    expect(json.client).toBeUndefined();
    expect(json.stripeSessionId).toBeUndefined();
    expect(json.produits[0].nom).toBe('Burger');
    expect(json.produits[0].quantite).toBe(2);
  });

  it('commande prete → 200 + statut prete', async () => {
    mockFindOne.mockReturnValueOnce({
      lean: vi.fn().mockResolvedValue({ ...mockCommandePayee, statut: 'prete' }),
    });
    const res = await GET(makeReq(VALID_SESSION_ID));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.statut).toBe('prete');
  });
});
