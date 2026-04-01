import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock Stripe
const mockCreateSession = vi.fn();
vi.mock('@/lib/stripe', () => ({
  getStripe: () => ({
    checkout: { sessions: { create: mockCreateSession } },
  }),
}));

// Mock mockStore
vi.mock('@/lib/mockStore', () => ({
  mockSessions: new Map(),
}));

// TICK-050 — Le checkout vérifie les prix en BDD : il faut mocker connectDB + Produit
vi.mock('@/lib/mongodb', () => ({ connectDB: vi.fn().mockResolvedValue(undefined) }));
// TICK-075 — getServerSession mocké (renvoie null = client non connecté par défaut)
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.mock('next-auth', () => ({ getServerSession: vi.fn().mockResolvedValue(null) }));

// vi.hoisted() garantit que la variable est initialisée avant le hoist de vi.mock
const { mockProduitFind, mockSiteConfigFindOne } = vi.hoisted(() => ({
  mockProduitFind: vi.fn(),
  mockSiteConfigFindOne: vi.fn(),
}));
vi.mock('@/models/Produit', () => ({
  default: { find: mockProduitFind },
}));
// TICK-105 — SiteConfig mock pour vérifier fermeeAujourdhui + horaires
vi.mock('@/models/SiteConfig', () => ({
  default: { findOne: mockSiteConfigFindOne },
}));

import { POST } from '@/app/api/checkout/route';

// Note : `prix` et `nom` sont ignorés par le schéma Zod côté serveur (TICK-050),
// les tests en-dessous valident que le prix vient de la BDD mockée (850 centimes).
// Retrait toujours de type 'creneau' (option 'Dès que possible' supprimée)
const validBody = {
  client: { nom: 'Jean Dupont', telephone: '0612345678', email: 'jean@example.com' },
  retrait: { type: 'creneau', creneau: '12:00 – 12:15' },
  produits: [{ produitId: 'p1', quantite: 1, options: [] }],
};

const makeReq = (body: unknown) =>
  new NextRequest('http://localhost/api/checkout', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

// Produit mocké retourné par la BDD pour les tests valides
const mockProduitDB = {
  _id: { toString: () => 'p1' },
  nom: 'Burger',
  prix: 850,
  taux_tva: 10, // TICK-129
  actif: true,
  options: [],
};

// SiteConfig ouvert toute la journée pour que les tests passent à n'importe quelle heure
const openConfig = {
  fermeeAujourdhui: false,
  horaireOuverture: '00:00',
  horaireFermeture: '23:59',
};

describe('POST /api/checkout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_fake');
    vi.stubEnv('NEXTAUTH_URL', 'http://localhost:3000');
    // Par défaut : boutique ouverte toute la journée
    mockSiteConfigFindOne.mockReturnValue({ lean: vi.fn().mockResolvedValue(openConfig) });
    // Par défaut : la BDD retourne le produit valide
    mockProduitFind.mockReturnValue({ lean: vi.fn().mockResolvedValue([mockProduitDB]) });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it('produits vides → 400', async () => {
    const res = await POST(makeReq({ ...validBody, produits: [] }));
    expect(res.status).toBe(400);
  });

  it('client.nom manquant → 400', async () => {
    const res = await POST(makeReq({ ...validBody, client: { telephone: '0612345678' } }));
    expect(res.status).toBe(400);
  });

  it('retrait sans créneau → 400', async () => {
    const res = await POST(makeReq({ ...validBody, retrait: { type: 'creneau', creneau: '' } }));
    expect(res.status).toBe(400);
  });

  // TICK-105 — Boutique fermée → 503
  it('boutique fermée (fermeeAujourdhui: true) → 503', async () => {
    mockSiteConfigFindOne.mockReturnValueOnce({
      lean: vi.fn().mockResolvedValue({ ...openConfig, fermeeAujourdhui: true }),
    });
    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.error).toMatch(/fermée/i);
  });

  it('heure hors plage d\'ouverture → 503', async () => {
    vi.useFakeTimers();
    // Fixer l'heure à 10:00, boutique ouvre à 11:30
    vi.setSystemTime(new Date('2025-01-01T10:00:00'));
    mockSiteConfigFindOne.mockReturnValueOnce({
      lean: vi.fn().mockResolvedValue({
        fermeeAujourdhui: false,
        horaireOuverture: '11:30',
        horaireFermeture: '14:00',
      }),
    });
    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.error).toMatch(/fermée/i);
  });

  it('body valide → stripe.checkout.sessions.create appelé avec les bons line_items', async () => {
    mockCreateSession.mockResolvedValueOnce({ url: 'https://checkout.stripe.com/pay/test' });
    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(200);
    expect(mockCreateSession).toHaveBeenCalledOnce();
    const call = mockCreateSession.mock.calls[0][0];
    expect(call.line_items[0].price_data.product_data.name).toBe('Burger');
    expect(call.line_items[0].price_data.unit_amount).toBe(850);
  });

  it('les metadata client sont incluses', async () => {
    mockCreateSession.mockResolvedValueOnce({ url: 'https://checkout.stripe.com/pay/test' });
    await POST(makeReq(validBody));
    const call = mockCreateSession.mock.calls[0][0];
    expect(call.metadata.client_nom).toBe('Jean Dupont');
    expect(call.metadata.client_telephone).toBe('0612345678');
  });

  it('retourne { url } vers Stripe', async () => {
    mockCreateSession.mockResolvedValueOnce({ url: 'https://checkout.stripe.com/pay/test' });
    const res = await POST(makeReq(validBody));
    const json = await res.json();
    expect(json.url).toBe('https://checkout.stripe.com/pay/test');
  });

  it('erreur Stripe → 500', async () => {
    mockCreateSession.mockRejectedValueOnce(new Error('Stripe error'));
    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(500);
  });

  // TICK-129 — taux_tva inclus dans metadata produits
  it('taux_tva du produit BDD est inclus dans metadata.produits', async () => {
    mockProduitFind.mockReturnValueOnce({
      lean: vi.fn().mockResolvedValue([{ ...mockProduitDB, taux_tva: 20 }]),
    });
    mockCreateSession.mockResolvedValueOnce({ url: 'https://checkout.stripe.com/pay/test' });
    await POST(makeReq(validBody));
    const call = mockCreateSession.mock.calls[0][0];
    const produitsSnapshot = JSON.parse(call.metadata.produits);
    expect(produitsSnapshot[0].taux_tva).toBe(20);
  });
});
