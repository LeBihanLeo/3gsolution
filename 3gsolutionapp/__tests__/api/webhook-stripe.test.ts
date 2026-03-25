import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import type Stripe from 'stripe';

const { mockConstructEvent, mockCommandeModel, mockSendEmail } = vi.hoisted(() => ({
  mockConstructEvent: vi.fn(),
  mockCommandeModel: { findOne: vi.fn(), create: vi.fn() },
  mockSendEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/stripe', () => ({
  getStripe: () => ({ webhooks: { constructEvent: mockConstructEvent } }),
}));
vi.mock('@/lib/mongodb', () => ({ connectDB: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/email', () => ({ sendConfirmationEmail: mockSendEmail }));
vi.mock('@/models/Commande', () => ({ default: mockCommandeModel }));

import { POST } from '@/app/api/webhooks/stripe/route';

const makeWebhookReq = (body: string, sig: string) =>
  new NextRequest('http://localhost/api/webhooks/stripe', {
    method: 'POST',
    headers: { 'stripe-signature': sig, 'content-type': 'application/json' },
    body,
  });

const produits = JSON.stringify([
  { produitId: 'p1', nom: 'Burger', prix: 850, quantite: 1, options: [] },
]);

const mockSession: Partial<Stripe.Checkout.Session> = {
  id: 'cs_test_123',
  metadata: {
    client_nom: 'Jean',
    client_telephone: '0612345678',
    client_email: 'jean@example.com',
    retrait_type: 'immediat',
    retrait_creneau: '',
    commentaire: '',
    produits,
  },
};

const completedEvent = {
  type: 'checkout.session.completed',
  data: { object: mockSession as Stripe.Checkout.Session },
};

describe('POST /api/webhooks/stripe', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_test_fake');
  });

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

  it('événement non géré (payment_intent.created) → 200 silencieux', async () => {
    mockConstructEvent.mockReturnValueOnce({ type: 'payment_intent.created', data: { object: {} } });
    const res = await POST(makeWebhookReq('{}', 'valid_sig'));
    expect(res.status).toBe(200);
    expect(mockCommandeModel.create).not.toHaveBeenCalled();
  });

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

  it('checkout.session.completed → appelle sendConfirmationEmail si email présent', async () => {
    mockConstructEvent.mockReturnValueOnce(completedEvent);
    mockCommandeModel.findOne.mockResolvedValueOnce(null);
    mockCommandeModel.create.mockResolvedValueOnce({ _id: 'new1', statut: 'payee' });
    await POST(makeWebhookReq('{}', 'valid_sig'));
    expect(mockSendEmail).toHaveBeenCalledOnce();
  });

  it("checkout.session.completed sans email → pas d'email envoyé", async () => {
    const eventSansEmail = {
      ...completedEvent,
      data: {
        object: { ...mockSession, metadata: { ...mockSession.metadata, client_email: '' } },
      },
    };
    mockConstructEvent.mockReturnValueOnce(eventSansEmail);
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

  it('sendConfirmationEmail qui lève une exception → handler retourne quand même 200', async () => {
    mockConstructEvent.mockReturnValueOnce(completedEvent);
    mockCommandeModel.findOne.mockResolvedValueOnce(null);
    mockCommandeModel.create.mockResolvedValueOnce({ _id: 'new1' });
    mockSendEmail.mockRejectedValueOnce(new Error('Email service down'));
    const res = await POST(makeWebhookReq('{}', 'valid_sig'));
    expect(res.status).toBe(200);
  });

  // TICK-075 — clientId dans les métadonnées
  it('metadata clientId valide → create appelé avec clientId', async () => {
    const validObjectId = 'a'.repeat(24); // 24 hex chars
    const eventAvecClientId = {
      ...completedEvent,
      data: {
        object: {
          ...mockSession,
          metadata: { ...mockSession.metadata, clientId: validObjectId },
        },
      },
    };
    mockConstructEvent.mockReturnValueOnce(eventAvecClientId);
    mockCommandeModel.findOne.mockResolvedValueOnce(null);
    mockCommandeModel.create.mockResolvedValueOnce({ _id: 'new1' });
    await POST(makeWebhookReq('{}', 'valid_sig'));
    expect(mockCommandeModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: validObjectId })
    );
  });

  it('metadata clientId vide → create appelé SANS clientId', async () => {
    const eventSansClientId = {
      ...completedEvent,
      data: {
        object: {
          ...mockSession,
          metadata: { ...mockSession.metadata, clientId: '' },
        },
      },
    };
    mockConstructEvent.mockReturnValueOnce(eventSansClientId);
    mockCommandeModel.findOne.mockResolvedValueOnce(null);
    mockCommandeModel.create.mockResolvedValueOnce({ _id: 'new1' });
    await POST(makeWebhookReq('{}', 'valid_sig'));
    const createArg = mockCommandeModel.create.mock.calls[0][0];
    expect(createArg).not.toHaveProperty('clientId');
  });

  it('metadata clientId invalide (non ObjectId) → create appelé SANS clientId', async () => {
    const eventClientIdInvalide = {
      ...completedEvent,
      data: {
        object: {
          ...mockSession,
          metadata: { ...mockSession.metadata, clientId: 'not-a-valid-object-id' },
        },
      },
    };
    mockConstructEvent.mockReturnValueOnce(eventClientIdInvalide);
    mockCommandeModel.findOne.mockResolvedValueOnce(null);
    mockCommandeModel.create.mockResolvedValueOnce({ _id: 'new1' });
    await POST(makeWebhookReq('{}', 'valid_sig'));
    const createArg = mockCommandeModel.create.mock.calls[0][0];
    expect(createArg).not.toHaveProperty('clientId');
  });
});
