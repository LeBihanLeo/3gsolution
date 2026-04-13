import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import type Stripe from 'stripe';

const {
  mockConstructConnectEvent,
  mockCommandeModel,
  mockPendingOrderModel,
  mockRestaurantModel,
  mockSendEmail,
} = vi.hoisted(() => ({
  mockConstructConnectEvent: vi.fn(),
  // TICK-172 — findOneAndUpdate remplace findOne + create (idempotence atomique)
  mockCommandeModel: {
    findOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
    findByIdAndDelete: vi.fn(),
  },
  mockPendingOrderModel: { findById: vi.fn(), findByIdAndDelete: vi.fn() },
  // TICK-160 — Restaurant.findOne({ stripeAccountId }) pour résolution du tenant
  // TICK-178 — findByIdAndUpdate pour sync account.updated / deauthorized
  mockRestaurantModel: { findOne: vi.fn(), findByIdAndUpdate: vi.fn() },
  mockSendEmail: vi.fn().mockResolvedValue(undefined),
}));

// TICK-157/160 — stripe (platform) + constructConnectEvent remplacent getStripeClient/getStripeWebhookSecret
vi.mock('@/lib/stripe', () => ({
  stripe: {
    paymentIntents: { retrieve: vi.fn().mockResolvedValue({ latest_charge: null }) },
  },
  constructConnectEvent: mockConstructConnectEvent,
}));
vi.mock('@/lib/mongodb', () => ({ connectDB: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/email', () => ({
  sendConfirmationEmail: mockSendEmail,
  sendDisputeAlert: vi.fn().mockResolvedValue(undefined),
  sendChargeFailedAlert: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/models/Commande', () => ({ default: mockCommandeModel }));
vi.mock('@/models/PendingOrder', () => ({ default: mockPendingOrderModel }));
vi.mock('@/models/Restaurant', () => ({ default: mockRestaurantModel }));
vi.mock('@/models/WebhookFailedEvent', () => ({
  default: { findOneAndUpdate: vi.fn().mockResolvedValue(null) },
}));

import { POST } from '@/app/api/webhooks/stripe/route';

const makeWebhookReq = (body: string, sig: string) =>
  new NextRequest('http://localhost/api/webhooks/stripe', {
    method: 'POST',
    headers: { 'stripe-signature': sig, 'content-type': 'application/json' },
    body,
  });

// PendingOrder typique retourné par findById()
const mockPendingOrderDoc = {
  _id: 'pending123',
  client: { nom: 'Jean', telephone: '0612345678', email: 'jean@example.com' },
  retrait: { type: 'immediat', creneau: undefined },
  commentaire: undefined,
  produits: [
    { produitId: 'p1', nom: 'Burger', prix: 850, quantite: 1, taux_tva: 10, options: [] },
  ],
  clientId: undefined,
  restaurantId: 'restaurant_test_id',
};

const mockSession: Partial<Stripe.Checkout.Session> = {
  id: 'cs_test_123',
  payment_intent: 'pi_test_456',
  metadata: { pending_order_id: 'pending123' },
};

// TICK-160 — event.account identifie le compte Connect du restaurant
const completedEvent = {
  type: 'checkout.session.completed',
  account: 'acct_test123',
  data: { object: mockSession as Stripe.Checkout.Session },
};

// Restaurant retourné par findOne({ stripeAccountId })
const mockRestaurantDoc = { _id: { toString: () => 'restaurant_test_id' } };

describe('POST /api/webhooks/stripe', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('STRIPE_CONNECT_WEBHOOK_SECRET', 'whsec_connect_test');
    mockPendingOrderModel.findById.mockResolvedValue(mockPendingOrderDoc);
    mockPendingOrderModel.findByIdAndDelete.mockResolvedValue(null);
    // TICK-160 — résolution tenant par défaut OK
    mockRestaurantModel.findOne.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue(mockRestaurantDoc),
    });
    // TICK-172 — findOneAndUpdate : null = insertion réussie (pas de doublon)
    mockCommandeModel.findOneAndUpdate.mockResolvedValue(null);
    // Récupération du doc après upsert (post-insertion seulement)
    mockCommandeModel.findOne.mockResolvedValue({ _id: 'new1', statut: 'payee' });
    // TICK-178 — findByIdAndUpdate Restaurant par défaut
    mockRestaurantModel.findByIdAndUpdate.mockResolvedValue(null);
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

  it('signature invalide → 400', async () => {
    mockConstructConnectEvent.mockImplementationOnce(() => { throw new Error('Invalid sig'); });
    const res = await POST(makeWebhookReq('{}', 'bad_sig'));
    expect(res.status).toBe(400);
  });

  // TICK-160 — event.account inconnu → 200 (pas de retry Stripe)
  it('event.account inconnu → 200 silencieux sans créer commande', async () => {
    mockRestaurantModel.findOne.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue(null),
    });
    mockConstructConnectEvent.mockReturnValueOnce({
      ...completedEvent,
      account: 'acct_unknown',
    });
    const res = await POST(makeWebhookReq('{}', 'valid_sig'));
    expect(res.status).toBe(200);
    expect(mockCommandeModel.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('événement non géré → 200 silencieux sans action', async () => {
    mockConstructConnectEvent.mockReturnValueOnce({
      type: 'payment_intent.created',
      account: 'acct_test123',
      data: { object: {} },
    });
    const res = await POST(makeWebhookReq('{}', 'valid_sig'));
    expect(res.status).toBe(200);
    expect(mockCommandeModel.findOneAndUpdate).not.toHaveBeenCalled();
  });

  // ── checkout.session.completed ──────────────────────────────────────────────

  it('checkout.session.completed → crée une commande avec statut payee (upsert atomique)', async () => {
    mockConstructConnectEvent.mockReturnValueOnce(completedEvent);
    const res = await POST(makeWebhookReq('{}', 'valid_sig'));
    expect(res.status).toBe(200);
    // TICK-172 — vérifier l'appel findOneAndUpdate avec $setOnInsert
    expect(mockCommandeModel.findOneAndUpdate).toHaveBeenCalledWith(
      { stripeSessionId: 'cs_test_123' },
      { $setOnInsert: expect.objectContaining({ stripeSessionId: 'cs_test_123', statut: 'payee' }) },
      { upsert: true, new: false }
    );
  });

  it('checkout.session.completed → stripePaymentIntentId stocké', async () => {
    mockConstructConnectEvent.mockReturnValueOnce(completedEvent);
    await POST(makeWebhookReq('{}', 'valid_sig'));
    const $setOnInsert = mockCommandeModel.findOneAndUpdate.mock.calls[0][1]['$setOnInsert'];
    expect($setOnInsert.stripePaymentIntentId).toBe('pi_test_456');
  });

  it('checkout.session.completed → PendingOrder supprimé après insertion', async () => {
    mockConstructConnectEvent.mockReturnValueOnce(completedEvent);
    await POST(makeWebhookReq('{}', 'valid_sig'));
    expect(mockPendingOrderModel.findByIdAndDelete).toHaveBeenCalledWith('pending123');
  });

  it('checkout.session.completed → envoie email si email présent', async () => {
    mockConstructConnectEvent.mockReturnValueOnce(completedEvent);
    // client.email vient du pendingOrder (jean@example.com) — email envoyé
    await POST(makeWebhookReq('{}', 'valid_sig'));
    expect(mockSendEmail).toHaveBeenCalledOnce();
  });

  it("checkout.session.completed sans email → pas d'email envoyé", async () => {
    // PendingOrder sans email client
    mockPendingOrderModel.findById.mockResolvedValueOnce({
      ...mockPendingOrderDoc,
      client: { nom: 'Jean', telephone: '0612' },
    });
    mockConstructConnectEvent.mockReturnValueOnce(completedEvent);
    await POST(makeWebhookReq('{}', 'valid_sig'));
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  // TICK-172 — idempotence atomique : findOneAndUpdate retourne non-null = doc existait
  it('idempotence — stripeSessionId déjà en base → pas de doublon ni email', async () => {
    mockCommandeModel.findOneAndUpdate.mockResolvedValueOnce({ _id: 'existing', statut: 'payee' });
    mockConstructConnectEvent.mockReturnValueOnce(completedEvent);
    const res = await POST(makeWebhookReq('{}', 'valid_sig'));
    expect(res.status).toBe(200);
    expect(mockPendingOrderModel.findByIdAndDelete).not.toHaveBeenCalled();
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it('sendConfirmationEmail qui lève une exception → 200 quand même', async () => {
    mockConstructConnectEvent.mockReturnValueOnce(completedEvent);
    mockSendEmail.mockRejectedValueOnce(new Error('Email service down'));
    const res = await POST(makeWebhookReq('{}', 'valid_sig'));
    expect(res.status).toBe(200);
  });

  it('pending_order_id absent → 200 silencieux sans créer commande', async () => {
    const eventSansPendingId = {
      ...completedEvent,
      data: { object: { ...mockSession, metadata: {} } },
    };
    mockConstructConnectEvent.mockReturnValueOnce(eventSansPendingId);
    const res = await POST(makeWebhookReq('{}', 'valid_sig'));
    expect(res.status).toBe(200);
    expect(mockCommandeModel.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('PendingOrder introuvable (TTL expiré) → 200 silencieux', async () => {
    mockPendingOrderModel.findById.mockResolvedValueOnce(null);
    mockConstructConnectEvent.mockReturnValueOnce(completedEvent);
    const res = await POST(makeWebhookReq('{}', 'valid_sig'));
    expect(res.status).toBe(200);
    expect(mockCommandeModel.findOneAndUpdate).not.toHaveBeenCalled();
  });

  // ── checkout.session.expired ────────────────────────────────────────────────

  it('checkout.session.expired → PendingOrder supprimé immédiatement', async () => {
    const expiredEvent = {
      type: 'checkout.session.expired',
      account: 'acct_test123',
      data: { object: { id: 'cs_expired_789', metadata: { pending_order_id: 'pending123' } } },
    };
    mockConstructConnectEvent.mockReturnValueOnce(expiredEvent);
    const res = await POST(makeWebhookReq('{}', 'valid_sig'));
    expect(res.status).toBe(200);
    expect(mockPendingOrderModel.findByIdAndDelete).toHaveBeenCalledWith('pending123');
    expect(mockCommandeModel.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('checkout.session.expired sans pending_order_id → 200 silencieux', async () => {
    const expiredEvent = {
      type: 'checkout.session.expired',
      account: 'acct_test123',
      data: { object: { id: 'cs_expired_789', metadata: {} } },
    };
    mockConstructConnectEvent.mockReturnValueOnce(expiredEvent);
    const res = await POST(makeWebhookReq('{}', 'valid_sig'));
    expect(res.status).toBe(200);
    expect(mockPendingOrderModel.findByIdAndDelete).not.toHaveBeenCalled();
  });

  // ── charge.refunded ─────────────────────────────────────────────────────────

  it('charge.refunded total (refunded: true) → commande passée en statut remboursee', async () => {
    const mockCommande = {
      _id: 'cmd1',
      statut: 'payee',
      save: vi.fn().mockResolvedValue(undefined),
    };
    mockCommandeModel.findOne.mockResolvedValueOnce(mockCommande);
    const refundedEvent = {
      type: 'charge.refunded',
      account: 'acct_test123',
      data: { object: { id: 'ch_xxx', payment_intent: 'pi_test_456', amount: 850, amount_refunded: 850, refunded: true } },
    };
    mockConstructConnectEvent.mockReturnValueOnce(refundedEvent);
    const res = await POST(makeWebhookReq('{}', 'valid_sig'));
    expect(res.status).toBe(200);
    expect(mockCommande.statut).toBe('remboursee');
    expect(mockCommande.save).toHaveBeenCalledOnce();
  });

  // TICK-168 — vérification du filtre restaurantId dans les handlers charge
  it('charge.refunded — findOne filtré par restaurantId (isolation tenant TICK-168)', async () => {
    const mockCommande = { _id: 'cmd1', statut: 'payee', save: vi.fn().mockResolvedValue(undefined) };
    mockCommandeModel.findOne.mockResolvedValueOnce(mockCommande);
    const refundedEvent = {
      type: 'charge.refunded',
      account: 'acct_test123',
      data: { object: { id: 'ch_xxx', payment_intent: 'pi_test_456', amount: 850, amount_refunded: 850, refunded: true } },
    };
    mockConstructConnectEvent.mockReturnValueOnce(refundedEvent);
    await POST(makeWebhookReq('{}', 'valid_sig'));
    expect(mockCommandeModel.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ restaurantId: 'restaurant_test_id' })
    );
  });

  it('charge.refunded partiel (refunded: false) → statut partiellement_remboursee + save appelé', async () => {
    const mockCommande = {
      _id: 'cmd1',
      statut: 'payee',
      montantRembourse: undefined as number | undefined,
      save: vi.fn().mockResolvedValue(undefined),
    };
    mockCommandeModel.findOne.mockResolvedValueOnce(mockCommande);
    const partialRefundEvent = {
      type: 'charge.refunded',
      account: 'acct_test123',
      data: { object: { id: 'ch_xxx', payment_intent: 'pi_test_456', amount: 850, amount_refunded: 300, refunded: false } },
    };
    mockConstructConnectEvent.mockReturnValueOnce(partialRefundEvent);
    await POST(makeWebhookReq('{}', 'valid_sig'));
    expect(mockCommande.statut).toBe('partiellement_remboursee');
    expect(mockCommande.save).toHaveBeenCalledOnce();
  });

  it('charge.refunded — commande déjà remboursee → idempotent, pas de double save', async () => {
    const mockCommande = {
      _id: 'cmd1',
      statut: 'remboursee',
      save: vi.fn().mockResolvedValue(undefined),
    };
    mockCommandeModel.findOne.mockResolvedValueOnce(mockCommande);
    const refundedEvent = {
      type: 'charge.refunded',
      account: 'acct_test123',
      data: { object: { id: 'ch_xxx', payment_intent: 'pi_test_456', amount: 850, amount_refunded: 850, refunded: true } },
    };
    mockConstructConnectEvent.mockReturnValueOnce(refundedEvent);
    await POST(makeWebhookReq('{}', 'valid_sig'));
    expect(mockCommande.save).not.toHaveBeenCalled();
  });

  it('charge.refunded sans payment_intent → 200 silencieux', async () => {
    const refundedEvent = {
      type: 'charge.refunded',
      account: 'acct_test123',
      data: { object: { id: 'ch_xxx', payment_intent: null, amount: 850, amount_refunded: 850, refunded: true } },
    };
    mockConstructConnectEvent.mockReturnValueOnce(refundedEvent);
    const res = await POST(makeWebhookReq('{}', 'valid_sig'));
    expect(res.status).toBe(200);
    expect(mockCommandeModel.findOne).not.toHaveBeenCalled();
  });

  it('charge.refunded — commande introuvable → 200 silencieux', async () => {
    mockCommandeModel.findOne.mockResolvedValueOnce(null);
    const refundedEvent = {
      type: 'charge.refunded',
      account: 'acct_test123',
      data: { object: { id: 'ch_xxx', payment_intent: 'pi_unknown', amount: 850, amount_refunded: 850, refunded: true } },
    };
    mockConstructConnectEvent.mockReturnValueOnce(refundedEvent);
    const res = await POST(makeWebhookReq('{}', 'valid_sig'));
    expect(res.status).toBe(200);
  });

  // ── payment_intent.payment_failed ───────────────────────────────────────────

  it('payment_intent.payment_failed → 200 silencieux sans action en base', async () => {
    const failedEvent = {
      type: 'payment_intent.payment_failed',
      account: 'acct_test123',
      data: {
        object: {
          id: 'pi_failed_xxx',
          last_payment_error: { message: 'Your card was declined.', code: 'card_declined' },
        },
      },
    };
    mockConstructConnectEvent.mockReturnValueOnce(failedEvent);
    const res = await POST(makeWebhookReq('{}', 'valid_sig'));
    expect(res.status).toBe(200);
    expect(mockCommandeModel.findOneAndUpdate).not.toHaveBeenCalled();
  });

  // ── TICK-075 — clientId ─────────────────────────────────────────────────────

  it('clientId présent dans PendingOrder → $setOnInsert avec clientId', async () => {
    const validObjectId = 'a'.repeat(24);
    mockPendingOrderModel.findById.mockResolvedValueOnce({
      ...mockPendingOrderDoc,
      clientId: validObjectId,
    });
    mockConstructConnectEvent.mockReturnValueOnce(completedEvent);
    await POST(makeWebhookReq('{}', 'valid_sig'));
    const $setOnInsert = mockCommandeModel.findOneAndUpdate.mock.calls[0][1]['$setOnInsert'];
    expect($setOnInsert).toHaveProperty('clientId', validObjectId);
  });

  it('clientId absent → $setOnInsert SANS clientId', async () => {
    mockConstructConnectEvent.mockReturnValueOnce(completedEvent);
    await POST(makeWebhookReq('{}', 'valid_sig'));
    const $setOnInsert = mockCommandeModel.findOneAndUpdate.mock.calls[0][1]['$setOnInsert'];
    expect($setOnInsert).not.toHaveProperty('clientId');
  });

  // ── TICK-129 — taux_tva ─────────────────────────────────────────────────────

  it('taux_tva est persisté depuis le snapshot PendingOrder', async () => {
    mockPendingOrderModel.findById.mockResolvedValueOnce({
      ...mockPendingOrderDoc,
      produits: [
        { produitId: 'p1', nom: 'Bière', prix: 500, quantite: 2, taux_tva: 20, options: [] },
      ],
    });
    mockConstructConnectEvent.mockReturnValueOnce(completedEvent);
    await POST(makeWebhookReq('{}', 'valid_sig'));
    const $setOnInsert = mockCommandeModel.findOneAndUpdate.mock.calls[0][1]['$setOnInsert'];
    expect($setOnInsert.produits[0].taux_tva).toBe(20);
  });
});

// ── TICK-178 + TICK-180 — account.updated ───────────────────────────────────

describe('webhook account.updated (TICK-178 + TICK-180)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('STRIPE_CONNECT_WEBHOOK_SECRET', 'whsec_connect_test');
    mockRestaurantModel.findOne.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue(mockRestaurantDoc),
    });
    mockRestaurantModel.findByIdAndUpdate.mockResolvedValue(null);
  });

  // TICK-180 — details_submitted ET charges_enabled requis
  it('details_submitted: true + charges_enabled: true → stripeOnboardingComplete: true en DB', async () => {
    mockConstructConnectEvent.mockReturnValueOnce({
      type: 'account.updated',
      account: 'acct_test123',
      data: { object: { id: 'acct_test123', details_submitted: true, charges_enabled: true } },
    });
    const res = await POST(makeWebhookReq('{}', 'valid_sig'));
    expect(res.status).toBe(200);
    expect(mockRestaurantModel.findByIdAndUpdate).toHaveBeenCalledWith(
      'restaurant_test_id',
      { stripeOnboardingComplete: true }
    );
  });

  it('details_submitted: false → aucune mise à jour DB', async () => {
    mockConstructConnectEvent.mockReturnValueOnce({
      type: 'account.updated',
      account: 'acct_test123',
      data: { object: { id: 'acct_test123', details_submitted: false, charges_enabled: false } },
    });
    const res = await POST(makeWebhookReq('{}', 'valid_sig'));
    expect(res.status).toBe(200);
    expect(mockRestaurantModel.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  // TICK-180 — KYC en cours : infos soumises mais Stripe n'a pas encore validé
  it('details_submitted: true mais charges_enabled: false (KYC en cours) → aucune mise à jour DB', async () => {
    mockConstructConnectEvent.mockReturnValueOnce({
      type: 'account.updated',
      account: 'acct_test123',
      data: { object: { id: 'acct_test123', details_submitted: true, charges_enabled: false } },
    });
    const res = await POST(makeWebhookReq('{}', 'valid_sig'));
    expect(res.status).toBe(200);
    expect(mockRestaurantModel.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('restaurantId null (account sans tenant associé) → 200 silencieux sans update', async () => {
    mockRestaurantModel.findOne.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue(null),
    });
    mockConstructConnectEvent.mockReturnValueOnce({
      type: 'account.updated',
      account: 'acct_unknown',
      data: { object: { id: 'acct_unknown', details_submitted: true, charges_enabled: true } },
    });
    const res = await POST(makeWebhookReq('{}', 'valid_sig'));
    expect(res.status).toBe(200);
    expect(mockRestaurantModel.findByIdAndUpdate).not.toHaveBeenCalled();
  });
});

// ── TICK-178 — account.application.deauthorized ──────────────────────────────

describe('webhook account.application.deauthorized (TICK-178)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('STRIPE_CONNECT_WEBHOOK_SECRET', 'whsec_connect_test');
    mockRestaurantModel.findOne.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue(mockRestaurantDoc),
    });
    mockRestaurantModel.findByIdAndUpdate.mockResolvedValue(null);
  });

  it('restaurant révoqué depuis Stripe → stripeAccountId supprimé + stripeOnboardingComplete: false', async () => {
    mockConstructConnectEvent.mockReturnValueOnce({
      type: 'account.application.deauthorized',
      account: 'acct_test123',
      data: { object: {} },
    });
    const res = await POST(makeWebhookReq('{}', 'valid_sig'));
    expect(res.status).toBe(200);
    expect(mockRestaurantModel.findByIdAndUpdate).toHaveBeenCalledWith(
      'restaurant_test_id',
      expect.objectContaining({ stripeOnboardingComplete: false })
    );
  });

  it('account inconnu (restaurantId null) → 200 silencieux sans update DB', async () => {
    mockRestaurantModel.findOne.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue(null),
    });
    mockConstructConnectEvent.mockReturnValueOnce({
      type: 'account.application.deauthorized',
      account: 'acct_unknown',
      data: { object: {} },
    });
    const res = await POST(makeWebhookReq('{}', 'valid_sig'));
    expect(res.status).toBe(200);
    expect(mockRestaurantModel.findByIdAndUpdate).not.toHaveBeenCalled();
  });
});
