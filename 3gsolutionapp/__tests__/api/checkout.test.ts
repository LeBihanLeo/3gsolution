import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// TICK-139 — getStripeClient remplace getStripe
const { mockGetStripeClient, mockCreateSession } = vi.hoisted(() => ({
  mockGetStripeClient: vi.fn(),
  mockCreateSession: vi.fn(),
}));

vi.mock('@/lib/stripe', () => ({
  getStripeClient: mockGetStripeClient,
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
const { mockProduitFind, mockSiteConfigFindOne, mockPendingOrderCreate, mockGetTenantId } = vi.hoisted(() => ({
  mockProduitFind: vi.fn(),
  mockSiteConfigFindOne: vi.fn(),
  mockPendingOrderCreate: vi.fn(),
  mockGetTenantId: vi.fn(),
}));
vi.mock('@/models/Produit', () => ({
  default: { find: mockProduitFind },
}));
// TICK-105 — SiteConfig mock pour vérifier fermeeAujourdhui + horaires
vi.mock('@/models/SiteConfig', () => ({
  default: { findOne: mockSiteConfigFindOne },
}));
// PendingOrder mock — stockage snapshot produits (évite la limite 500 chars metadata Stripe)
vi.mock('@/models/PendingOrder', () => ({
  default: { create: mockPendingOrderCreate },
}));
// TICK-134 — mock getTenantId
vi.mock('@/lib/tenant', () => ({ getTenantId: mockGetTenantId }));

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

// PendingOrder retourné par create() (simule le document MongoDB créé)
const mockPendingOrderDoc = { _id: { toString: () => 'pending123' } };

describe('POST /api/checkout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('NEXTAUTH_URL', 'http://localhost:3000');
    // TICK-134 — tenant résolu par défaut
    mockGetTenantId.mockResolvedValue({ toString: () => 'aaaaaaaaaaaaaaaaaaaaaaaa' });
    // TICK-139 — getStripeClient résolu par défaut (mode Stripe réel)
    mockGetStripeClient.mockResolvedValue({
      checkout: { sessions: { create: mockCreateSession } },
    });
    // Par défaut : boutique ouverte toute la journée
    mockSiteConfigFindOne.mockReturnValue({ lean: vi.fn().mockResolvedValue(openConfig) });
    // Par défaut : la BDD retourne le produit valide
    mockProduitFind.mockReturnValue({ lean: vi.fn().mockResolvedValue([mockProduitDB]) });
    // Par défaut : PendingOrder créé avec succès
    mockPendingOrderCreate.mockResolvedValue(mockPendingOrderDoc);
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

  // TICK-139 — mode mock : getStripeClient rejette (Stripe non configuré)
  it('Stripe non configuré pour le restaurant → bascule mode mock', async () => {
    mockGetStripeClient.mockRejectedValueOnce(new Error('Stripe non configuré pour ce restaurant'));
    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.url).toMatch(/mock-checkout/);
    expect(mockCreateSession).not.toHaveBeenCalled();
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

  it('metadata contient pending_order_id (snapshot produits stocké en BDD)', async () => {
    mockCreateSession.mockResolvedValueOnce({ url: 'https://checkout.stripe.com/pay/test' });
    await POST(makeReq(validBody));
    const call = mockCreateSession.mock.calls[0][0];
    expect(call.metadata.pending_order_id).toBe('pending123');
    // Les données sensibles ne sont plus dans les metadata Stripe
    expect(call.metadata.produits).toBeUndefined();
    expect(call.metadata.client_nom).toBeUndefined();
  });

  it('customer_email pré-remplit le formulaire Stripe quand fourni', async () => {
    mockCreateSession.mockResolvedValueOnce({ url: 'https://checkout.stripe.com/pay/test' });
    await POST(makeReq(validBody));
    const call = mockCreateSession.mock.calls[0][0];
    expect(call.customer_email).toBe('jean@example.com');
  });

  it('customer_email absent quand pas d\'email client', async () => {
    mockCreateSession.mockResolvedValueOnce({ url: 'https://checkout.stripe.com/pay/test' });
    await POST(makeReq({ ...validBody, client: { nom: 'Jean', telephone: '0612345678' } }));
    const call = mockCreateSession.mock.calls[0][0];
    expect(call.customer_email).toBeUndefined();
  });

  it('expires_at défini à ~30 min dans le futur', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T12:00:00Z'));
    mockCreateSession.mockResolvedValueOnce({ url: 'https://checkout.stripe.com/pay/test' });
    await POST(makeReq(validBody));
    const call = mockCreateSession.mock.calls[0][0];
    const expectedExpiresAt = Math.floor(Date.now() / 1000) + 30 * 60;
    expect(call.expires_at).toBe(expectedExpiresAt);
  });

  it('PendingOrder créé avec le snapshot produits BDD', async () => {
    mockCreateSession.mockResolvedValueOnce({ url: 'https://checkout.stripe.com/pay/test' });
    await POST(makeReq(validBody));
    expect(mockPendingOrderCreate).toHaveBeenCalledOnce();
    const pendingArg = mockPendingOrderCreate.mock.calls[0][0];
    expect(pendingArg.produits[0].nom).toBe('Burger');
    expect(pendingArg.produits[0].prix).toBe(850);
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

  // TICK-129 — taux_tva inclus dans le snapshot PendingOrder
  it('taux_tva du produit BDD est inclus dans le snapshot PendingOrder', async () => {
    mockProduitFind.mockReturnValueOnce({
      lean: vi.fn().mockResolvedValue([{ ...mockProduitDB, taux_tva: 20 }]),
    });
    mockCreateSession.mockResolvedValueOnce({ url: 'https://checkout.stripe.com/pay/test' });
    await POST(makeReq(validBody));
    const pendingArg = mockPendingOrderCreate.mock.calls[0][0];
    expect(pendingArg.produits[0].taux_tva).toBe(20);
  });
});
