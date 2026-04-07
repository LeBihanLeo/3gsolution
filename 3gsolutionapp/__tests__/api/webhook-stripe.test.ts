import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import type Stripe from 'stripe';

const {
  mockConstructEvent,
  mockCommandeModel,
  mockPendingOrderModel,
  mockSendEmail,
  mockGetStripeClient,
  mockCreateStripeClient,
  mockRestaurantModel,
} = vi.hoisted(() => ({
  mockConstructEvent: vi.fn(),
  mockCommandeModel: { findOne: vi.fn(), create: vi.fn(), findByIdAndDelete: vi.fn() },
  mockPendingOrderModel: { findById: vi.fn(), findByIdAndDelete: vi.fn() },
  mockSendEmail: vi.fn().mockResolvedValue(undefined),
  // TICK-139 — getStripeClient retourne un client avec constructEvent mocké
  mockGetStripeClient: vi.fn(),
  // TICK-139 — createStripeClient (fallback charge/dispute events)
  mockCreateStripeClient: vi.fn(),
  mockRestaurantModel: { findById: vi.fn() },
}));

// TICK-139 — mock getStripeClient + createStripeClient (remplace getStripe)
vi.mock('@/lib/stripe', () => ({
  getStripeClient: mockGetStripeClient,
  createStripeClient: mockCreateStripeClient,
}));
vi.mock('@/lib/mongodb', () => ({ connectDB: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/email', () => ({
  sendConfirmationEmail: mockSendEmail,
  sendDisputeAlert: vi.fn().mockResolvedValue(undefined),
  sendChargeFailedAlert: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/models/Commande', () => ({ default: mockCommandeModel }));
vi.mock('@/models/PendingOrder', () => ({ default: mockPendingOrderModel }));
vi.mock('@/models/WebhookFailedEvent', () => ({
  default: { findOneAndUpdate: vi.fn().mockResolvedValue(null) },
}));
// TICK-139 — mock Restaurant pour résolution tenant + stripeWebhookSecret
vi.mock('@/models/Restaurant', () => ({ default: mockRestaurantModel }));

import { POST } from '@/app/api/webhooks/stripe/route';

const RESTAURANT_ID = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const WEBHOOK_SECRET = 'whsec_test_fake';

const makeWebhookReq = (body: string, sig: string) =>
  new NextRequest('http://localhost/api/webhooks/stripe', {
    method: 'POST',
    headers: { 'stripe-signature': sig, 'content-type': 'application/json' },
    body,
  });

// Corps JSON d'un checkout.session.completed avec restaurantId dans metadata
const makeCheckoutBody = (overrides?: Record<string, unknown>) =>
  JSON.stringify({
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_test_123',
        payment_intent: 'pi_test_456',
        metadata: { pending_order_id: 'pending123', restaurantId: RESTAURANT_ID, ...overrides },
      },
    },
  });

// PendingOrder typique retourné par findById()
const mockPendingOrderDoc = {
  _id: 'pending123',
  restaurantId: RESTAURANT_ID,
  client: { nom: 'Jean', telephone: '0612345678', email: 'jean@example.com' },
  retrait: { type: 'immediat', creneau: undefined },
  commentaire: undefined,
  produits: [
    { produitId: 'p1', nom: 'Burger', prix: 850, quantite: 1, taux_tva: 10, options: [] },
  ],
  clientId: undefined,
};

const mockSession: Partial<Stripe.Checkout.Session> = {
  id: 'cs_test_123',
  payment_intent: 'pi_test_456',
  metadata: { pending_order_id: 'pending123', restaurantId: RESTAURANT_ID },
};

const completedEvent = {
  type: 'checkout.session.completed',
  id: 'evt_test_1',
  data: { object: mockSession as Stripe.Checkout.Session },
};

// Mock Stripe client exposant webhooks.constructEvent
const makeStripeClient = () => ({
  webhooks: { constructEvent: mockConstructEvent },
  paymentIntents: { retrieve: vi.fn().mockResolvedValue({ latest_charge: null }) },
});

describe('POST /api/webhooks/stripe', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // TICK-139 — restaurant résolu avec stripeWebhookSecret
    mockRestaurantModel.findById.mockReturnValue({
      select: vi.fn().mockResolvedValue({
        stripeWebhookSecret: WEBHOOK_SECRET,
        stripeSecretKey: 'sk_test_fake',
      }),
    });
    // TICK-139 — getStripeClient retourne un client mocké (main path)
    mockGetStripeClient.mockResolvedValue(makeStripeClient());
    // TICK-139 — createStripeClient retourne le même client mocké (fallback path)
    mockCreateStripeClient.mockReturnValue(makeStripeClient());
    mockPendingOrderModel.findById.mockResolvedValue(mockPendingOrderDoc);
    mockPendingOrderModel.findByIdAndDelete.mockResolvedValue(null);
  });

  // ── Sécurité de base ────────────────────────────────────────────────────────

  it('signature manquante → 400', async () => {
    const req = new NextRequest('http://localhost/api/webhooks/stripe', {
      method: 'POST',
      body: '{}',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('corps JSON invalide → 400', async () => {
    const res = await POST(makeWebhookReq('not-json', 'valid_sig'));
    expect(res.status).toBe(400);
  });

  // TICK-139 — restaurant introuvable ou webhook secret absent → 400
  it('restaurant introuvable → 400', async () => {
    mockRestaurantModel.findById.mockReturnValue({
      select: vi.fn().mockResolvedValue(null),
    });
    const res = await POST(makeWebhookReq(makeCheckoutBody(), 'valid_sig'));
    expect(res.status).toBe(400);
  });

  it('signature invalide → 400', async () => {
    mockConstructEvent.mockImplementationOnce(() => { throw new Error('Invalid sig'); });
    const res = await POST(makeWebhookReq(makeCheckoutBody(), 'bad_sig'));
    expect(res.status).toBe(400);
  });

  it('événement non géré → 200 silencieux sans action', async () => {
    const body = JSON.stringify({
      type: 'payment_intent.created',
      data: { object: { metadata: { restaurantId: RESTAURANT_ID } } },
    });
    mockConstructEvent.mockReturnValueOnce({ type: 'payment_intent.created', data: { object: {} } });
    const res = await POST(makeWebhookReq(body, 'valid_sig'));
    expect(res.status).toBe(200);
    expect(mockCommandeModel.create).not.toHaveBeenCalled();
  });

  // TICK-139 — fallback pour événements sans metadata.restaurantId (charge/dispute)
  it('événement sans restaurantId → fallback createStripeClient (charge.refunded)', async () => {
    const body = JSON.stringify({
      type: 'charge.refunded',
      data: { object: { id: 'ch_xxx', payment_intent: 'pi_xxx', amount: 850, amount_refunded: 850, refunded: true } },
    });
    mockConstructEvent.mockReturnValueOnce({
      type: 'charge.refunded',
      id: 'evt_test',
      data: { object: { id: 'ch_xxx', payment_intent: 'pi_xxx', amount: 850, amount_refunded: 850, refunded: true } },
    });
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', WEBHOOK_SECRET);
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_fallback');
    mockCommandeModel.findOne.mockResolvedValueOnce(null);
    const res = await POST(makeWebhookReq(body, 'valid_sig'));
    expect(res.status).toBe(200);
    expect(mockCreateStripeClient).toHaveBeenCalledWith('sk_test_fallback');
    vi.unstubAllEnvs();
  });

  it('pas de restaurantId ET pas de STRIPE_WEBHOOK_SECRET → 500', async () => {
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', '');
    vi.stubEnv('STRIPE_SECRET_KEY', '');
    const body = JSON.stringify({
      type: 'charge.refunded',
      data: { object: { id: 'ch_xxx', payment_intent: 'pi_xxx' } },
    });
    const res = await POST(makeWebhookReq(body, 'valid_sig'));
    expect(res.status).toBe(500);
    vi.unstubAllEnvs();
  });

  // ── checkout.session.completed ──────────────────────────────────────────────

  it('checkout.session.completed → crée une commande avec statut payee', async () => {
    mockConstructEvent.mockReturnValueOnce(completedEvent);
    mockCommandeModel.findOne.mockResolvedValueOnce(null);
    mockCommandeModel.create.mockResolvedValueOnce({ _id: 'new1', statut: 'payee' });
    const res = await POST(makeWebhookReq(makeCheckoutBody(), 'valid_sig'));
    expect(res.status).toBe(200);
    expect(mockCommandeModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ stripeSessionId: 'cs_test_123', statut: 'payee' })
    );
  });

  // TICK-139 — getStripeClient appelé avec le restaurantId du tenant
  it('getStripeClient est appelé avec le restaurantId du tenant', async () => {
    mockConstructEvent.mockReturnValueOnce(completedEvent);
    mockCommandeModel.findOne.mockResolvedValueOnce(null);
    mockCommandeModel.create.mockResolvedValueOnce({ _id: 'new1' });
    await POST(makeWebhookReq(makeCheckoutBody(), 'valid_sig'));
    expect(mockGetStripeClient).toHaveBeenCalledWith(RESTAURANT_ID);
  });

  it('checkout.session.completed → stripePaymentIntentId stocké', async () => {
    mockConstructEvent.mockReturnValueOnce(completedEvent);
    mockCommandeModel.findOne.mockResolvedValueOnce(null);
    mockCommandeModel.create.mockResolvedValueOnce({ _id: 'new1' });
    await POST(makeWebhookReq(makeCheckoutBody(), 'valid_sig'));
    expect(mockCommandeModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ stripePaymentIntentId: 'pi_test_456' })
    );
  });

  it('checkout.session.completed → PendingOrder supprimé après création commande', async () => {
    mockConstructEvent.mockReturnValueOnce(completedEvent);
    mockCommandeModel.findOne.mockResolvedValueOnce(null);
    mockCommandeModel.create.mockResolvedValueOnce({ _id: 'new1' });
    await POST(makeWebhookReq(makeCheckoutBody(), 'valid_sig'));
    expect(mockPendingOrderModel.findByIdAndDelete).toHaveBeenCalledWith('pending123');
  });

  it('checkout.session.completed → envoie email si email présent', async () => {
    mockConstructEvent.mockReturnValueOnce(completedEvent);
    mockCommandeModel.findOne.mockResolvedValueOnce(null);
    mockCommandeModel.create.mockResolvedValueOnce({ _id: 'new1', statut: 'payee' });
    await POST(makeWebhookReq(makeCheckoutBody(), 'valid_sig'));
    expect(mockSendEmail).toHaveBeenCalledOnce();
  });

  it("checkout.session.completed sans email → pas d'email envoyé", async () => {
    mockPendingOrderModel.findById.mockResolvedValueOnce({
      ...mockPendingOrderDoc,
      client: { nom: 'Jean', telephone: '0612' },
    });
    mockConstructEvent.mockReturnValueOnce(completedEvent);
    mockCommandeModel.findOne.mockResolvedValueOnce(null);
    mockCommandeModel.create.mockResolvedValueOnce({ _id: 'new1' });
    await POST(makeWebhookReq(makeCheckoutBody(), 'valid_sig'));
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it('idempotence — stripeSessionId déjà en base → pas de doublon', async () => {
    mockConstructEvent.mockReturnValueOnce(completedEvent);
    mockCommandeModel.findOne.mockResolvedValueOnce({ _id: 'existing', statut: 'payee' });
    const res = await POST(makeWebhookReq(makeCheckoutBody(), 'valid_sig'));
    expect(res.status).toBe(200);
    expect(mockCommandeModel.create).not.toHaveBeenCalled();
  });

  it('sendConfirmationEmail qui lève une exception → 200 quand même', async () => {
    mockConstructEvent.mockReturnValueOnce(completedEvent);
    mockCommandeModel.findOne.mockResolvedValueOnce(null);
    mockCommandeModel.create.mockResolvedValueOnce({ _id: 'new1' });
    mockSendEmail.mockRejectedValueOnce(new Error('Email service down'));
    const res = await POST(makeWebhookReq(makeCheckoutBody(), 'valid_sig'));
    expect(res.status).toBe(200);
  });

  it('pending_order_id absent → 200 silencieux sans créer commande', async () => {
    const body = JSON.stringify({
      type: 'checkout.session.completed',
      data: { object: { id: 'cs_test_123', metadata: { restaurantId: RESTAURANT_ID } } },
    });
    mockConstructEvent.mockReturnValueOnce({
      type: 'checkout.session.completed',
      id: 'evt_test',
      data: { object: { id: 'cs_test_123', metadata: { restaurantId: RESTAURANT_ID } } },
    });
    mockCommandeModel.findOne.mockResolvedValueOnce(null);
    const res = await POST(makeWebhookReq(body, 'valid_sig'));
    expect(res.status).toBe(200);
    expect(mockCommandeModel.create).not.toHaveBeenCalled();
  });

  it('PendingOrder introuvable (TTL expiré) → 200 silencieux', async () => {
    mockPendingOrderModel.findById.mockResolvedValueOnce(null);
    mockConstructEvent.mockReturnValueOnce(completedEvent);
    mockCommandeModel.findOne.mockResolvedValueOnce(null);
    const res = await POST(makeWebhookReq(makeCheckoutBody(), 'valid_sig'));
    expect(res.status).toBe(200);
    expect(mockCommandeModel.create).not.toHaveBeenCalled();
  });

  // ── checkout.session.expired ────────────────────────────────────────────────

  it('checkout.session.expired → PendingOrder supprimé immédiatement', async () => {
    const body = JSON.stringify({
      type: 'checkout.session.expired',
      data: { object: { id: 'cs_expired_789', metadata: { pending_order_id: 'pending123', restaurantId: RESTAURANT_ID } } },
    });
    const expiredEvent = {
      type: 'checkout.session.expired',
      id: 'evt_test',
      data: { object: { id: 'cs_expired_789', metadata: { pending_order_id: 'pending123' } } },
    };
    mockConstructEvent.mockReturnValueOnce(expiredEvent);
    const res = await POST(makeWebhookReq(body, 'valid_sig'));
    expect(res.status).toBe(200);
    expect(mockPendingOrderModel.findByIdAndDelete).toHaveBeenCalledWith('pending123');
    expect(mockCommandeModel.create).not.toHaveBeenCalled();
  });

  it('checkout.session.expired sans pending_order_id → 200 silencieux', async () => {
    const body = JSON.stringify({
      type: 'checkout.session.expired',
      data: { object: { id: 'cs_expired_789', metadata: { restaurantId: RESTAURANT_ID } } },
    });
    const expiredEvent = {
      type: 'checkout.session.expired',
      id: 'evt_test',
      data: { object: { id: 'cs_expired_789', metadata: {} } },
    };
    mockConstructEvent.mockReturnValueOnce(expiredEvent);
    const res = await POST(makeWebhookReq(body, 'valid_sig'));
    expect(res.status).toBe(200);
    expect(mockPendingOrderModel.findByIdAndDelete).not.toHaveBeenCalled();
  });

  // ── charge.refunded ─────────────────────────────────────────────────────────

  // Pour les charge.refunded, le body n'a pas de metadata.restaurantId
  // → fallback createStripeClient (mocké via vi.mock('@/lib/stripe'))
  // STRIPE_WEBHOOK_SECRET est requis dans le fallback path
  it('charge.refunded total (refunded: true) → commande passée en statut remboursee', async () => {
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', WEBHOOK_SECRET);
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_fake');
    const mockCommande = { _id: 'cmd1', statut: 'payee', save: vi.fn().mockResolvedValue(undefined) };
    mockCommandeModel.findOne.mockResolvedValueOnce(mockCommande);
    const body = JSON.stringify({
      type: 'charge.refunded',
      data: { object: { id: 'ch_xxx', payment_intent: 'pi_test_456', amount: 850, amount_refunded: 850, refunded: true } },
    });
    mockConstructEvent.mockReturnValueOnce({
      type: 'charge.refunded', id: 'evt_test',
      data: { object: { id: 'ch_xxx', payment_intent: 'pi_test_456', amount: 850, amount_refunded: 850, refunded: true } },
    });
    const res = await POST(makeWebhookReq(body, 'valid_sig'));
    expect(res.status).toBe(200);
    expect(mockCommande.statut).toBe('remboursee');
    expect(mockCommande.save).toHaveBeenCalledOnce();
    vi.unstubAllEnvs();
  });

  it('charge.refunded partiel (refunded: false) → statut partiellement_remboursee + save appelé', async () => {
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', WEBHOOK_SECRET);
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_fake');
    const mockCommande = { _id: 'cmd1', statut: 'payee', montantRembourse: 0, save: vi.fn().mockResolvedValue(undefined) };
    mockCommandeModel.findOne.mockResolvedValueOnce(mockCommande);
    const body = JSON.stringify({
      type: 'charge.refunded',
      data: { object: { id: 'ch_xxx', payment_intent: 'pi_test_456', amount: 850, amount_refunded: 300, refunded: false } },
    });
    mockConstructEvent.mockReturnValueOnce({
      type: 'charge.refunded', id: 'evt_test',
      data: { object: { id: 'ch_xxx', payment_intent: 'pi_test_456', amount: 850, amount_refunded: 300, refunded: false } },
    });
    await POST(makeWebhookReq(body, 'valid_sig'));
    expect(mockCommande.statut).toBe('partiellement_remboursee');
    expect(mockCommande.montantRembourse).toBe(300);
    expect(mockCommande.save).toHaveBeenCalledOnce();
    vi.unstubAllEnvs();
  });

  it('charge.refunded — commande déjà remboursee → idempotent, pas de double save', async () => {
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', WEBHOOK_SECRET);
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_fake');
    const mockCommande = { _id: 'cmd1', statut: 'remboursee', save: vi.fn().mockResolvedValue(undefined) };
    mockCommandeModel.findOne.mockResolvedValueOnce(mockCommande);
    const body = JSON.stringify({
      type: 'charge.refunded',
      data: { object: { id: 'ch_xxx', payment_intent: 'pi_test_456', amount: 850, amount_refunded: 850, refunded: true } },
    });
    mockConstructEvent.mockReturnValueOnce({
      type: 'charge.refunded', id: 'evt_test',
      data: { object: { id: 'ch_xxx', payment_intent: 'pi_test_456', amount: 850, amount_refunded: 850, refunded: true } },
    });
    await POST(makeWebhookReq(body, 'valid_sig'));
    expect(mockCommande.save).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });

  it('charge.refunded sans payment_intent → 200 silencieux', async () => {
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', WEBHOOK_SECRET);
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_fake');
    const body = JSON.stringify({
      type: 'charge.refunded',
      data: { object: { id: 'ch_xxx', payment_intent: null, amount: 850, amount_refunded: 850, refunded: true } },
    });
    mockConstructEvent.mockReturnValueOnce({
      type: 'charge.refunded', id: 'evt_test',
      data: { object: { id: 'ch_xxx', payment_intent: null, amount: 850, amount_refunded: 850, refunded: true } },
    });
    const res = await POST(makeWebhookReq(body, 'valid_sig'));
    expect(res.status).toBe(200);
    expect(mockCommandeModel.findOne).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });

  // ── payment_intent.payment_failed ───────────────────────────────────────────

  it('payment_intent.payment_failed → 200 silencieux sans action en base', async () => {
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', WEBHOOK_SECRET);
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_fake');
    const body = JSON.stringify({
      type: 'payment_intent.payment_failed',
      data: { object: { id: 'pi_failed_xxx' } },
    });
    mockConstructEvent.mockReturnValueOnce({
      type: 'payment_intent.payment_failed', id: 'evt_test',
      data: {
        object: {
          id: 'pi_failed_xxx',
          last_payment_error: { message: 'Your card was declined.', code: 'card_declined' },
        },
      },
    });
    const res = await POST(makeWebhookReq(body, 'valid_sig'));
    expect(res.status).toBe(200);
    expect(mockCommandeModel.create).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });

  // ── TICK-075 — clientId ─────────────────────────────────────────────────────

  it('clientId présent dans PendingOrder → create avec clientId', async () => {
    const validObjectId = 'a'.repeat(24);
    mockPendingOrderModel.findById.mockResolvedValueOnce({
      ...mockPendingOrderDoc,
      clientId: validObjectId,
    });
    mockConstructEvent.mockReturnValueOnce(completedEvent);
    mockCommandeModel.findOne.mockResolvedValueOnce(null);
    mockCommandeModel.create.mockResolvedValueOnce({ _id: 'new1' });
    await POST(makeWebhookReq(makeCheckoutBody(), 'valid_sig'));
    expect(mockCommandeModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: validObjectId })
    );
  });

  it('clientId absent → create SANS clientId', async () => {
    mockConstructEvent.mockReturnValueOnce(completedEvent);
    mockCommandeModel.findOne.mockResolvedValueOnce(null);
    mockCommandeModel.create.mockResolvedValueOnce({ _id: 'new1' });
    await POST(makeWebhookReq(makeCheckoutBody(), 'valid_sig'));
    const createArg = mockCommandeModel.create.mock.calls[0][0];
    expect(createArg).not.toHaveProperty('clientId');
  });

  // ── TICK-129 — taux_tva ─────────────────────────────────────────────────────

  it('taux_tva est persisté depuis le snapshot PendingOrder', async () => {
    mockPendingOrderModel.findById.mockResolvedValueOnce({
      ...mockPendingOrderDoc,
      produits: [
        { produitId: 'p1', nom: 'Bière', prix: 500, quantite: 2, taux_tva: 20, options: [] },
      ],
    });
    mockConstructEvent.mockReturnValueOnce(completedEvent);
    mockCommandeModel.findOne.mockResolvedValueOnce(null);
    mockCommandeModel.create.mockResolvedValueOnce({ _id: 'new1' });
    await POST(makeWebhookReq(makeCheckoutBody(), 'valid_sig'));
    const createArg = mockCommandeModel.create.mock.calls[0][0];
    expect(createArg.produits[0].taux_tva).toBe(20);
  });
});
