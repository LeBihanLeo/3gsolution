// Tests Stripe Connect Accounts v2 — Sprint 22 + correctifs Sprint 23
//   TICK-175 — Endpoints Accounts v2 (initiate / return / refresh / disconnect)
//   TICK-179 — CSRF cross-domain via state token HMAC (remplace getServerSession sur le hub)
//   TICK-180 — charges_enabled vérifié avant stripeOnboardingComplete: true
//   TICK-181 — Soft disconnect (stripe.accounts.del retiré)
//   TICK-182 — country: 'FR' dans accounts.create
import { createHmac } from 'crypto';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Mocks hoisted ─────────────────────────────────────────────────────────────

const {
  mockAccountsCreate,
  mockAccountLinksCreate,
  mockAccountsRetrieve,
  mockRestaurantModel,
  mockGetServerSession,
} = vi.hoisted(() => ({
  mockAccountsCreate: vi.fn(),
  mockAccountLinksCreate: vi.fn(),
  mockAccountsRetrieve: vi.fn(),
  mockRestaurantModel: {
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn(),
  },
  mockGetServerSession: vi.fn(),
}));

// TICK-175 — Accounts v2 : stripe.accounts + stripe.accountLinks
// TICK-181 — stripe.accounts.del retiré de disconnect → non exposé dans le mock
vi.mock('@/lib/stripe', () => ({
  stripe: {
    accounts: {
      create: mockAccountsCreate,
      retrieve: mockAccountsRetrieve,
    },
    accountLinks: {
      create: mockAccountLinksCreate,
    },
  },
}));
vi.mock('@/lib/mongodb', () => ({ connectDB: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.mock('next-auth', () => ({ getServerSession: mockGetServerSession }));
vi.mock('@/models/Restaurant', () => ({ default: mockRestaurantModel }));
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn() },
}));

import { POST as initiatePOST } from '@/app/api/stripe/connect/initiate/route';
import { GET as returnGET } from '@/app/api/stripe/connect/return/route';
import { GET as refreshGET } from '@/app/api/stripe/connect/refresh/route';
import { DELETE as disconnectDELETE } from '@/app/api/stripe/connect/disconnect/route';

// ── Helpers ───────────────────────────────────────────────────────────────────

const makeReq = (url: string, method = 'GET') =>
  new NextRequest(url, { method });

const TEST_SECRET = 'test_nextauth_secret';
const TEST_RESTAURANT_ID = 'restaurant_test_id';

/**
 * TICK-179 — Génère un state token HMAC valide pour les tests de return et refresh.
 * Utilise le même algorithme que initiate/route.ts avec NEXTAUTH_SECRET = TEST_SECRET.
 * @param expiresOffsetSeconds Offset en secondes depuis now (négatif = déjà expiré)
 */
function buildStateToken(
  restaurantId: string,
  expiresOffsetSeconds = 600
): { state: string; expires: string } {
  const expires = Math.floor(Date.now() / 1000) + expiresOffsetSeconds;
  const payload = `${restaurantId}:${expires}`;
  const state = createHmac('sha256', TEST_SECRET).update(payload).digest('hex');
  return { state, expires: expires.toString() };
}

/** Construit une URL /return ou /refresh avec un state token valide */
function buildReturnUrl(base: string, restaurantId: string, expiresOffset = 600): string {
  const { state, expires } = buildStateToken(restaurantId, expiresOffset);
  return `${base}?restaurantId=${restaurantId}&state=${state}&expires=${expires}`;
}

// ── Tests : POST /api/stripe/connect/initiate ─────────────────────────────────

describe('POST /api/stripe/connect/initiate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // AUTH_HUB_URL centralise return_url/refresh_url pour tous les restaurants
    vi.stubEnv('AUTH_HUB_URL', 'https://hub.test');
    vi.stubEnv('NEXTAUTH_SECRET', TEST_SECRET);
    mockGetServerSession.mockResolvedValue({
      user: { role: 'admin', restaurantId: TEST_RESTAURANT_ID },
    });
    // Restaurant sans compte Stripe (onboarding initial)
    mockRestaurantModel.findById.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue({
        stripeAccountId: undefined,
        stripeOnboardingComplete: false,
      }),
    });
    mockAccountsCreate.mockResolvedValue({ id: 'acct_new123' });
    mockAccountLinksCreate.mockResolvedValue({ url: 'https://connect.stripe.com/setup/acct_new123' });
    mockRestaurantModel.findByIdAndUpdate.mockResolvedValue(null);
  });

  afterEach(() => vi.unstubAllEnvs());

  it('admin authentifié (sans compte existant) → crée compte Express + redirect 302 vers Stripe', async () => {
    const req = makeReq('https://hub.test/api/stripe/connect/initiate', 'POST');
    const res = await initiatePOST(req);
    expect(res.status).toBe(302);
    const location = res.headers.get('location') ?? '';
    expect(location).toContain('connect.stripe.com/setup/acct_new123');
    expect(mockRestaurantModel.findByIdAndUpdate).toHaveBeenCalledWith(
      TEST_RESTAURANT_ID,
      { stripeAccountId: 'acct_new123' }
    );
  });

  // TICK-182 — country: 'FR' + capabilities card_payments + transfers demandées à la création
  it('accounts.create appelé avec type: express, country: FR, capabilities et restaurantId', async () => {
    const req = makeReq('https://hub.test/api/stripe/connect/initiate', 'POST');
    await initiatePOST(req);
    expect(mockAccountsCreate).toHaveBeenCalledWith({
      type: 'express',
      country: 'FR',
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      metadata: { restaurantId: TEST_RESTAURANT_ID },
    });
  });

  it('restaurant déjà connecté → réutilise stripeAccountId existant sans recréer le compte', async () => {
    mockRestaurantModel.findById.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue({
        stripeAccountId: 'acct_existing456',
        stripeOnboardingComplete: false,
      }),
    });
    const req = makeReq('https://hub.test/api/stripe/connect/initiate', 'POST');
    await initiatePOST(req);
    expect(mockAccountsCreate).not.toHaveBeenCalled();
    expect(mockAccountLinksCreate).toHaveBeenCalledWith(
      expect.objectContaining({ account: 'acct_existing456' })
    );
  });

  // TICK-179 — state token HMAC inclus dans return_url et refresh_url (base = AUTH_HUB_URL)
  it('accountLink contient return_url et refresh_url avec restaurantId + state + expires', async () => {
    const req = makeReq('https://hub.test/api/stripe/connect/initiate', 'POST');
    await initiatePOST(req);
    expect(mockAccountLinksCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        return_url: expect.stringMatching(
          /^https:\/\/hub\.test\/api\/stripe\/connect\/return\?restaurantId=restaurant_test_id&state=[a-f0-9]{64}&expires=\d+$/
        ),
        refresh_url: expect.stringMatching(
          /^https:\/\/hub\.test\/api\/stripe\/connect\/refresh\?restaurantId=restaurant_test_id&state=[a-f0-9]{64}&expires=\d+$/
        ),
        type: 'account_onboarding',
      })
    );
  });

  it('non authentifié → 403', async () => {
    mockGetServerSession.mockResolvedValueOnce(null);
    const res = await initiatePOST(makeReq('https://hub.test/api/stripe/connect/initiate', 'POST'));
    expect(res.status).toBe(403);
  });

  it('rôle non admin → 403', async () => {
    mockGetServerSession.mockResolvedValueOnce({ user: { role: 'client' } });
    const res = await initiatePOST(makeReq('https://hub.test/api/stripe/connect/initiate', 'POST'));
    expect(res.status).toBe(403);
  });

  it('AUTH_HUB_URL manquant → 500', async () => {
    vi.stubEnv('AUTH_HUB_URL', '');
    const res = await initiatePOST(makeReq('https://hub.test/api/stripe/connect/initiate', 'POST'));
    expect(res.status).toBe(500);
  });

  it('restaurant introuvable en DB → 404', async () => {
    mockRestaurantModel.findById.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue(null),
    });
    const res = await initiatePOST(makeReq('https://hub.test/api/stripe/connect/initiate', 'POST'));
    expect(res.status).toBe(404);
  });

  it('erreur Stripe lors de la création de compte → 500', async () => {
    mockAccountsCreate.mockRejectedValueOnce(new Error('Stripe error'));
    const res = await initiatePOST(makeReq('https://hub.test/api/stripe/connect/initiate', 'POST'));
    expect(res.status).toBe(500);
  });
});

// ── Tests : GET /api/stripe/connect/return ────────────────────────────────────

describe('GET /api/stripe/connect/return', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('AUTH_HUB_URL', 'https://hub.test');
    vi.stubEnv('NEXTAUTH_SECRET', TEST_SECRET);
    mockRestaurantModel.findById.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue({
        stripeAccountId: 'acct_test123',
        domaine: 'resto-test.com',
      }),
    });
    // TICK-180 — details_submitted ET charges_enabled requis
    mockAccountsRetrieve.mockResolvedValue({
      details_submitted: true,
      charges_enabled: true,
    });
    mockRestaurantModel.findByIdAndUpdate.mockResolvedValue(null);
  });

  afterEach(() => vi.unstubAllEnvs());

  it('onboarding terminé → stripeOnboardingComplete: true + redirect vers restaurant.domaine', async () => {
    const url = buildReturnUrl('https://hub.test/api/stripe/connect/return', TEST_RESTAURANT_ID);
    const res = await returnGET(makeReq(url));
    expect(res.status).toBe(302);
    const location = res.headers.get('location') ?? '';
    expect(location).toBe('https://resto-test.com/espace-restaurateur/stripe?connected=true');
    expect(mockRestaurantModel.findByIdAndUpdate).toHaveBeenCalledWith(
      TEST_RESTAURANT_ID,
      { stripeOnboardingComplete: true }
    );
  });

  it('details_submitted: false → redirect ?error=onboarding_incomplete sans update DB', async () => {
    mockAccountsRetrieve.mockResolvedValueOnce({
      details_submitted: false,
      charges_enabled: false,
    });
    const url = buildReturnUrl('https://hub.test/api/stripe/connect/return', TEST_RESTAURANT_ID);
    const res = await returnGET(makeReq(url));
    expect(res.status).toBe(302);
    expect(res.headers.get('location') ?? '').toContain('error=onboarding_incomplete');
    expect(mockRestaurantModel.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  // TICK-180 — KYC en cours : details_submitted true mais charges_enabled false
  it('details_submitted: true mais charges_enabled: false → redirect ?error=onboarding_incomplete', async () => {
    mockAccountsRetrieve.mockResolvedValueOnce({
      details_submitted: true,
      charges_enabled: false,
    });
    const url = buildReturnUrl('https://hub.test/api/stripe/connect/return', TEST_RESTAURANT_ID);
    const res = await returnGET(makeReq(url));
    expect(res.status).toBe(302);
    expect(res.headers.get('location') ?? '').toContain('error=onboarding_incomplete');
    expect(mockRestaurantModel.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('restaurantId manquant → redirect ?error=missing_restaurant', async () => {
    const res = await returnGET(makeReq('https://hub.test/api/stripe/connect/return'));
    expect(res.status).toBe(302);
    expect(res.headers.get('location') ?? '').toContain('error=missing_restaurant');
  });

  // TICK-179 — CSRF : state token invalide → unauthorized (pas de session requise)
  it('state token invalide → redirect ?error=unauthorized (CSRF)', async () => {
    const res = await returnGET(makeReq(
      `https://hub.test/api/stripe/connect/return?restaurantId=${TEST_RESTAURANT_ID}&state=deadbeef&expires=9999999999`
    ));
    expect(res.status).toBe(302);
    expect(res.headers.get('location') ?? '').toContain('error=unauthorized');
    expect(mockAccountsRetrieve).not.toHaveBeenCalled();
  });

  // TICK-179 — Token expiré → unauthorized
  it('state token expiré → redirect ?error=unauthorized', async () => {
    const url = buildReturnUrl(
      'https://hub.test/api/stripe/connect/return',
      TEST_RESTAURANT_ID,
      -60 // expiré il y a 60 secondes
    );
    const res = await returnGET(makeReq(url));
    expect(res.status).toBe(302);
    expect(res.headers.get('location') ?? '').toContain('error=unauthorized');
    expect(mockAccountsRetrieve).not.toHaveBeenCalled();
  });

  // TICK-179 — Token d'un autre restaurant → unauthorized (protection CSRF inter-restaurant)
  it('state signé pour un autre restaurantId → redirect ?error=unauthorized', async () => {
    const { state, expires } = buildStateToken('other_restaurant_id');
    const res = await returnGET(makeReq(
      `https://hub.test/api/stripe/connect/return?restaurantId=${TEST_RESTAURANT_ID}&state=${state}&expires=${expires}`
    ));
    expect(res.status).toBe(302);
    expect(res.headers.get('location') ?? '').toContain('error=unauthorized');
    expect(mockAccountsRetrieve).not.toHaveBeenCalled();
  });

  it('restaurant sans stripeAccountId → redirect ?error=connect_failed', async () => {
    mockRestaurantModel.findById.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue({ stripeAccountId: undefined, domaine: 'resto-test.com' }),
    });
    const url = buildReturnUrl('https://hub.test/api/stripe/connect/return', TEST_RESTAURANT_ID);
    const res = await returnGET(makeReq(url));
    expect(res.status).toBe(302);
    expect(res.headers.get('location') ?? '').toContain('error=connect_failed');
  });

  it('erreur API Stripe → redirect ?error=connect_failed', async () => {
    mockAccountsRetrieve.mockRejectedValueOnce(new Error('Stripe API error'));
    const url = buildReturnUrl('https://hub.test/api/stripe/connect/return', TEST_RESTAURANT_ID);
    const res = await returnGET(makeReq(url));
    expect(res.status).toBe(302);
    expect(res.headers.get('location') ?? '').toContain('error=connect_failed');
  });
});

// ── Tests : GET /api/stripe/connect/refresh ───────────────────────────────────

describe('GET /api/stripe/connect/refresh', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('AUTH_HUB_URL', 'https://hub.test');
    vi.stubEnv('NEXTAUTH_SECRET', TEST_SECRET);
    mockRestaurantModel.findById.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue({ stripeAccountId: 'acct_test123' }),
    });
    mockAccountLinksCreate.mockResolvedValue({
      url: 'https://connect.stripe.com/setup/new_link',
    });
  });

  afterEach(() => vi.unstubAllEnvs());

  it('lien expiré → régénère accountLink sans recréer le compte + redirect 302', async () => {
    const url = buildReturnUrl('https://hub.test/api/stripe/connect/refresh', TEST_RESTAURANT_ID);
    const res = await refreshGET(makeReq(url));
    expect(res.status).toBe(302);
    expect(res.headers.get('location') ?? '').toBe('https://connect.stripe.com/setup/new_link');
    expect(mockAccountsCreate).not.toHaveBeenCalled();
    expect(mockAccountLinksCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        account: 'acct_test123',
        type: 'account_onboarding',
      })
    );
  });

  it('accountLink régénéré propage le même state/expires dans les URLs', async () => {
    const { state, expires } = buildStateToken(TEST_RESTAURANT_ID);
    const url = `https://hub.test/api/stripe/connect/refresh?restaurantId=${TEST_RESTAURANT_ID}&state=${state}&expires=${expires}`;
    await refreshGET(makeReq(url));
    const [linkParams] = mockAccountLinksCreate.mock.calls[0];
    expect(linkParams.return_url).toContain(`state=${state}`);
    expect(linkParams.refresh_url).toContain(`state=${state}`);
  });

  it('restaurantId manquant → redirect ?error=missing_restaurant', async () => {
    const res = await refreshGET(makeReq('https://hub.test/api/stripe/connect/refresh'));
    expect(res.status).toBe(302);
    expect(res.headers.get('location') ?? '').toContain('error=missing_restaurant');
  });

  // TICK-179 — CSRF : state invalide → unauthorized (pas de session requise sur le hub)
  it('state token invalide → redirect ?error=unauthorized (CSRF)', async () => {
    const res = await refreshGET(makeReq(
      `https://hub.test/api/stripe/connect/refresh?restaurantId=${TEST_RESTAURANT_ID}&state=invalid&expires=9999999999`
    ));
    expect(res.status).toBe(302);
    expect(res.headers.get('location') ?? '').toContain('error=unauthorized');
    expect(mockAccountLinksCreate).not.toHaveBeenCalled();
  });

  it('state token expiré → redirect ?error=unauthorized', async () => {
    const url = buildReturnUrl(
      'https://hub.test/api/stripe/connect/refresh',
      TEST_RESTAURANT_ID,
      -60
    );
    const res = await refreshGET(makeReq(url));
    expect(res.status).toBe(302);
    expect(res.headers.get('location') ?? '').toContain('error=unauthorized');
  });

  it('restaurant sans stripeAccountId → redirect ?error=connect_failed', async () => {
    mockRestaurantModel.findById.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue({ stripeAccountId: undefined }),
    });
    const url = buildReturnUrl('https://hub.test/api/stripe/connect/refresh', TEST_RESTAURANT_ID);
    const res = await refreshGET(makeReq(url));
    expect(res.status).toBe(302);
    expect(res.headers.get('location') ?? '').toContain('error=connect_failed');
  });
});

// ── Tests : DELETE /api/stripe/connect/disconnect ─────────────────────────────

describe('DELETE /api/stripe/connect/disconnect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue({
      user: { role: 'admin', restaurantId: 'resto1' },
    });
    mockRestaurantModel.findById.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue({
        stripeAccountId: 'acct_test123',
        stripeOnboardingComplete: true,
      }),
    });
    mockRestaurantModel.findByIdAndUpdate.mockResolvedValue(null);
  });

  it('admin connecté → déconnexion douce (nettoyage DB uniquement) + 200', async () => {
    const res = await disconnectDELETE(makeReq('https://app.com/api/stripe/connect/disconnect', 'DELETE'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.message).toMatch(/déconnecté/i);
    // TICK-181 — nettoyage DB
    expect(mockRestaurantModel.findByIdAndUpdate).toHaveBeenCalledWith(
      'resto1',
      expect.objectContaining({ stripeOnboardingComplete: false })
    );
  });

  // TICK-181 — stripe.accounts.del ne doit plus être appelé (soft disconnect)
  it('stripe.accounts.del non appelé (soft disconnect — compte Stripe préservé)', async () => {
    await disconnectDELETE(makeReq('https://app.com/api/stripe/connect/disconnect', 'DELETE'));
    // Le mock stripe n'expose plus accounts.del → toute tentative d'appel lèverait une erreur.
    // On vérifie que le DB update s'est bien fait sans avoir besoin de stripe.
    expect(mockRestaurantModel.findByIdAndUpdate).toHaveBeenCalledTimes(1);
  });

  it('non authentifié → 403', async () => {
    mockGetServerSession.mockResolvedValueOnce(null);
    const res = await disconnectDELETE(makeReq('https://app.com/api/stripe/connect/disconnect', 'DELETE'));
    expect(res.status).toBe(403);
  });

  it('rôle client (non admin) → 403', async () => {
    mockGetServerSession.mockResolvedValueOnce({ user: { role: 'client' } });
    const res = await disconnectDELETE(makeReq('https://app.com/api/stripe/connect/disconnect', 'DELETE'));
    expect(res.status).toBe(403);
  });

  it('restaurant non connecté → 400', async () => {
    mockRestaurantModel.findById.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue({
        stripeAccountId: undefined,
        stripeOnboardingComplete: false,
      }),
    });
    const res = await disconnectDELETE(makeReq('https://app.com/api/stripe/connect/disconnect', 'DELETE'));
    expect(res.status).toBe(400);
    expect(mockRestaurantModel.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('restaurant introuvable → 404', async () => {
    mockRestaurantModel.findById.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue(null),
    });
    const res = await disconnectDELETE(makeReq('https://app.com/api/stripe/connect/disconnect', 'DELETE'));
    expect(res.status).toBe(404);
  });
});
