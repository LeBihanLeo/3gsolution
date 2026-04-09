import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import type Stripe from 'stripe';

const { mockConstructEvent, mockCommandeModel, mockPendingOrderModel, mockSendEmail } = vi.hoisted(() => ({
  mockConstructEvent: vi.fn(),
  mockCommandeModel: { findOne: vi.fn(), create: vi.fn(), findByIdAndDelete: vi.fn() },
  mockPendingOrderModel: { findById: vi.fn(), findByIdAndDelete: vi.fn() },
  mockSendEmail: vi.fn().mockResolvedValue(undefined),
}));

// TICK-139 — getStripeClient remplace getStripe (multi-tenant Sprint 18)
vi.mock('@/lib/stripe', () => ({
  getStripeClient: vi.fn().mockResolvedValue({ webhooks: { constructEvent: mockConstructEvent } }),
  getStripeWebhookSecret: vi.fn().mockResolvedValue('whsec_test'),
}));
vi.mock('@/lib/mongodb', () => ({ connectDB: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/email', () => ({ sendConfirmationEmail: mockSendEmail }));
vi.mock('@/models/Commande', () => ({ default: mockCommandeModel }));
vi.mock('@/models/PendingOrder', () => ({ default: mockPendingOrderModel }));

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
};

const mockSession: Partial<Stripe.Checkout.Session> = {
  id: 'cs_test_123',
  payment_intent: 'pi_test_456',
  metadata: { pending_order_id: 'pending123' },
};

const completedEvent = {
  type: 'checkout.session.completed',
  data: { object: mockSession as Stripe.Checkout.Session },
};

describe('POST /api/webhooks/stripe', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_test_fake');
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

  it('signature invalide → 400', async () => {
    mockConstructEvent.mockImplementationOnce(() => { throw new Error('Invalid sig'); });
    const res = await POST(makeWebhookReq('{}', 'bad_sig'));
    expect(res.status).toBe(400);
  });

  it('événement non géré → 200 silencieux sans action', async () => {
    mockConstructEvent.mockReturnValueOnce({ type: 'payment_intent.created', data: { object: {} } });
    const res = await POST(makeWebhookReq('{}', 'valid_sig'));
    expect(res.status).toBe(200);
    expect(mockCommandeModel.create).not.toHaveBeenCalled();
  });

  // ── checkout.session.completed ──────────────────────────────────────────────

  it('checkout.session.completed → crée une commande avec statut payee', async () => {
    mockConstructEvent.mockReturnValueOnce(completedEvent);
    mockCommandeModel.findOne.mockResolvedValueOnce(null);
    mockCommandeModel.create.mockResolvedValueOnce({ _id: 'new1', statut: 'payee' });
    const res = await POST(makeWebhookReq('{}', 'valid_sig'));
    expect(res.status).toBe(200);
    expect(mockCommandeModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ stripeSessionId: 'cs_test_123', statut: 'payee' })
    );
  });

  it('checkout.session.completed → stripePaymentIntentId stocké', async () => {
    mockConstructEvent.mockReturnValueOnce(completedEvent);
    mockCommandeModel.findOne.mockResolvedValueOnce(null);
    mockCommandeModel.create.mockResolvedValueOnce({ _id: 'new1' });
    await POST(makeWebhookReq('{}', 'valid_sig'));
    expect(mockCommandeModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ stripePaymentIntentId: 'pi_test_456' })
    );
  });

  it('checkout.session.completed → PendingOrder supprimé après création commande', async () => {
    mockConstructEvent.mockReturnValueOnce(completedEvent);
    mockCommandeModel.findOne.mockResolvedValueOnce(null);
    mockCommandeModel.create.mockResolvedValueOnce({ _id: 'new1' });
    await POST(makeWebhookReq('{}', 'valid_sig'));
    expect(mockPendingOrderModel.findByIdAndDelete).toHaveBeenCalledWith('pending123');
  });

  it('checkout.session.completed → envoie email si email présent', async () => {
    mockConstructEvent.mockReturnValueOnce(completedEvent);
    mockCommandeModel.findOne.mockResolvedValueOnce(null);
    mockCommandeModel.create.mockResolvedValueOnce({ _id: 'new1', statut: 'payee' });
    await POST(makeWebhookReq('{}', 'valid_sig'));
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
    await POST(makeWebhookReq('{}', 'valid_sig'));
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it('idempotence — stripeSessionId déjà en base → pas de doublon', async () => {
    mockConstructEvent.mockReturnValueOnce(completedEvent);
    mockCommandeModel.findOne.mockResolvedValueOnce({ _id: 'existing', statut: 'payee' });
    const res = await POST(makeWebhookReq('{}', 'valid_sig'));
    expect(res.status).toBe(200);
    expect(mockCommandeModel.create).not.toHaveBeenCalled();
  });

  it('sendConfirmationEmail qui lève une exception → 200 quand même', async () => {
    mockConstructEvent.mockReturnValueOnce(completedEvent);
    mockCommandeModel.findOne.mockResolvedValueOnce(null);
    mockCommandeModel.create.mockResolvedValueOnce({ _id: 'new1' });
    mockSendEmail.mockRejectedValueOnce(new Error('Email service down'));
    const res = await POST(makeWebhookReq('{}', 'valid_sig'));
    expect(res.status).toBe(200);
  });

  it('pending_order_id absent → 200 silencieux sans créer commande', async () => {
    const eventSansPendingId = {
      ...completedEvent,
      data: { object: { ...mockSession, metadata: {} } },
    };
    mockConstructEvent.mockReturnValueOnce(eventSansPendingId);
    mockCommandeModel.findOne.mockResolvedValueOnce(null);
    const res = await POST(makeWebhookReq('{}', 'valid_sig'));
    expect(res.status).toBe(200);
    expect(mockCommandeModel.create).not.toHaveBeenCalled();
  });

  it('PendingOrder introuvable (TTL expiré) → 200 silencieux', async () => {
    mockPendingOrderModel.findById.mockResolvedValueOnce(null);
    mockConstructEvent.mockReturnValueOnce(completedEvent);
    mockCommandeModel.findOne.mockResolvedValueOnce(null);
    const res = await POST(makeWebhookReq('{}', 'valid_sig'));
    expect(res.status).toBe(200);
    expect(mockCommandeModel.create).not.toHaveBeenCalled();
  });

  // ── checkout.session.expired ────────────────────────────────────────────────

  it('checkout.session.expired → PendingOrder supprimé immédiatement', async () => {
    const expiredEvent = {
      type: 'checkout.session.expired',
      data: { object: { id: 'cs_expired_789', metadata: { pending_order_id: 'pending123' } } },
    };
    mockConstructEvent.mockReturnValueOnce(expiredEvent);
    const res = await POST(makeWebhookReq('{}', 'valid_sig'));
    expect(res.status).toBe(200);
    expect(mockPendingOrderModel.findByIdAndDelete).toHaveBeenCalledWith('pending123');
    expect(mockCommandeModel.create).not.toHaveBeenCalled();
  });

  it('checkout.session.expired sans pending_order_id → 200 silencieux', async () => {
    const expiredEvent = {
      type: 'checkout.session.expired',
      data: { object: { id: 'cs_expired_789', metadata: {} } },
    };
    mockConstructEvent.mockReturnValueOnce(expiredEvent);
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
      data: { object: { id: 'ch_xxx', payment_intent: 'pi_test_456', amount: 850, amount_refunded: 850, refunded: true } },
    };
    mockConstructEvent.mockReturnValueOnce(refundedEvent);
    const res = await POST(makeWebhookReq('{}', 'valid_sig'));
    expect(res.status).toBe(200);
    expect(mockCommande.statut).toBe('remboursee');
    expect(mockCommande.save).toHaveBeenCalledOnce();
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
      data: { object: { id: 'ch_xxx', payment_intent: 'pi_test_456', amount: 850, amount_refunded: 300, refunded: false } },
    };
    mockConstructEvent.mockReturnValueOnce(partialRefundEvent);
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
      data: { object: { id: 'ch_xxx', payment_intent: 'pi_test_456', amount: 850, amount_refunded: 850, refunded: true } },
    };
    mockConstructEvent.mockReturnValueOnce(refundedEvent);
    await POST(makeWebhookReq('{}', 'valid_sig'));
    expect(mockCommande.save).not.toHaveBeenCalled();
  });

  it('charge.refunded sans payment_intent → 200 silencieux', async () => {
    const refundedEvent = {
      type: 'charge.refunded',
      data: { object: { id: 'ch_xxx', payment_intent: null, amount: 850, amount_refunded: 850, refunded: true } },
    };
    mockConstructEvent.mockReturnValueOnce(refundedEvent);
    const res = await POST(makeWebhookReq('{}', 'valid_sig'));
    expect(res.status).toBe(200);
    expect(mockCommandeModel.findOne).not.toHaveBeenCalled();
  });

  it('charge.refunded — commande introuvable → 200 silencieux', async () => {
    mockCommandeModel.findOne.mockResolvedValueOnce(null);
    const refundedEvent = {
      type: 'charge.refunded',
      data: { object: { id: 'ch_xxx', payment_intent: 'pi_unknown', amount: 850, amount_refunded: 850, refunded: true } },
    };
    mockConstructEvent.mockReturnValueOnce(refundedEvent);
    const res = await POST(makeWebhookReq('{}', 'valid_sig'));
    expect(res.status).toBe(200);
  });

  // ── payment_intent.payment_failed ───────────────────────────────────────────

  it('payment_intent.payment_failed → 200 silencieux sans action en base', async () => {
    const failedEvent = {
      type: 'payment_intent.payment_failed',
      data: {
        object: {
          id: 'pi_failed_xxx',
          last_payment_error: { message: 'Your card was declined.', code: 'card_declined' },
        },
      },
    };
    mockConstructEvent.mockReturnValueOnce(failedEvent);
    const res = await POST(makeWebhookReq('{}', 'valid_sig'));
    expect(res.status).toBe(200);
    expect(mockCommandeModel.create).not.toHaveBeenCalled();
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
    await POST(makeWebhookReq('{}', 'valid_sig'));
    expect(mockCommandeModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: validObjectId })
    );
  });

  it('clientId absent → create SANS clientId', async () => {
    mockConstructEvent.mockReturnValueOnce(completedEvent);
    mockCommandeModel.findOne.mockResolvedValueOnce(null);
    mockCommandeModel.create.mockResolvedValueOnce({ _id: 'new1' });
    await POST(makeWebhookReq('{}', 'valid_sig'));
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
    await POST(makeWebhookReq('{}', 'valid_sig'));
    const createArg = mockCommandeModel.create.mock.calls[0][0];
    expect(createArg.produits[0].taux_tva).toBe(20);
  });
});
