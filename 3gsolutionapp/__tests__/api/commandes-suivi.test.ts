import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import mongoose from 'mongoose';

const FAKE_TENANT_ID = new mongoose.Types.ObjectId('aaaaaaaaaaaaaaaaaaaaaaaa');

const { mockFindOne, mockGetTenantId } = vi.hoisted(() => ({
  mockFindOne: vi.fn(),
  mockGetTenantId: vi.fn(),
}));

vi.mock('@/lib/mongodb', () => ({ connectDB: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/tenant', () => ({ getTenantId: mockGetTenantId }));
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

const mockCommandePayee = {
  _id: new mongoose.Types.ObjectId('aaaaaaaaaaaaaaaaaaaaaaaa'),
  stripeSessionId: 'cs_test_123',
  statut: 'payee',
  retrait: { type: 'immediat' },
  produits: [{ nom: 'Burger', quantite: 2 }],
  total: 1700,
  createdAt: new Date(),
  client: { nom: 'Jean', telephone: '0612345678' },
};

describe('GET /api/commandes/suivi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTenantId.mockResolvedValue(FAKE_TENANT_ID);
  });

  it('session_id absent → 400', async () => {
    const res = await GET(makeReq());
    expect(res.status).toBe(400);
  });

  // session_id valide (>= 20 chars après cs_test_) mais absent en base → 404
  it('session_id valide mais inconnu → 404', async () => {
    mockFindOne.mockReturnValueOnce({ lean: vi.fn().mockResolvedValue(null) });
    const res = await GET(makeReq('cs_test_abcdefghijklmnopqrst'));
    expect(res.status).toBe(404);
  });

  // session_id trop court → 400 (rejeté par le regex CVE-07)
  it('session_id trop court → 400', async () => {
    const res = await GET(makeReq('cs_test_inconnu'));
    expect(res.status).toBe(400);
  });

  it('statut en_attente_paiement → 404', async () => {
    mockFindOne.mockReturnValueOnce({
      lean: vi.fn().mockResolvedValue({ ...mockCommandePayee, statut: 'en_attente_paiement' }),
    });
    // cs_test_123validlongformatxx — 20+ chars après cs_test_
    const res = await GET(makeReq('cs_test_123validlongformatxx'));
    expect(res.status).toBe(404);
  });

  it('commande payee → 200 + réponse sans données sensibles', async () => {
    mockFindOne.mockReturnValueOnce({
      lean: vi.fn().mockResolvedValue(mockCommandePayee),
    });
    const res = await GET(makeReq('cs_test_123validlongformatxx'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.statut).toBe('payee');
    expect(json.client).toBeUndefined();
    expect(json.stripeSessionId).toBeUndefined();
    expect(json.produits[0].nom).toBe('Burger');
    expect(json.produits[0].quantite).toBe(2);
    // TICK-134 — filtrage par restaurantId + stripeSessionId
    expect(mockFindOne).toHaveBeenCalledWith(
      expect.objectContaining({ restaurantId: FAKE_TENANT_ID })
    );
  });

  it('commande prete → 200 + statut prete', async () => {
    mockFindOne.mockReturnValueOnce({
      lean: vi.fn().mockResolvedValue({ ...mockCommandePayee, statut: 'prete' }),
    });
    const res = await GET(makeReq('cs_test_123validlongformatxx'));
    expect(res.status).toBe(200);
    expect((await res.json()).statut).toBe('prete');
  });
});
