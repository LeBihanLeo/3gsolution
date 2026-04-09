// TICK-155 — Tests intégration : flow OAuth cross-domain (Sprint 19)
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Mocks communs ────────────────────────────────────────────────────────────

vi.mock('@/lib/mongodb', () => ({ connectDB: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
// next/headers non disponible hors contexte Next.js (utilisé par lib/auth.ts → cookies())
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockReturnValue({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  }),
}));
// Autres dépendances de lib/auth.ts (sauf assert-known-domain qui est testé directement)
vi.mock('@/lib/turnstile', () => ({ verifyTurnstile: vi.fn().mockResolvedValue(true) }));
vi.mock('@/lib/tenant', () => ({ resolveTenantId: vi.fn().mockResolvedValue('restaurant_test_id') }));

// ─── Mocks modèles ────────────────────────────────────────────────────────────

const { mockAuthCodeFindOneAndDelete, mockAuthCodeCreate } = vi.hoisted(() => ({
  mockAuthCodeFindOneAndDelete: vi.fn(),
  mockAuthCodeCreate: vi.fn(),
}));

const { mockRelayTokenFindOneAndDelete, mockRelayTokenCreate } = vi.hoisted(() => ({
  mockRelayTokenFindOneAndDelete: vi.fn(),
  mockRelayTokenCreate: vi.fn(),
}));

const { mockRestaurantExists } = vi.hoisted(() => ({
  mockRestaurantExists: vi.fn(),
}));

vi.mock('@/models/AuthCode', () => ({
  default: {
    findOneAndDelete: mockAuthCodeFindOneAndDelete,
    create: mockAuthCodeCreate,
  },
}));

vi.mock('@/models/RelayToken', () => ({
  default: {
    findOneAndDelete: mockRelayTokenFindOneAndDelete,
    create: mockRelayTokenCreate,
  },
}));

vi.mock('@/models/Restaurant', () => ({
  default: { exists: mockRestaurantExists },
}));

const { mockClientFindOneAndUpdate } = vi.hoisted(() => ({
  mockClientFindOneAndUpdate: vi.fn(),
}));

vi.mock('@/models/Client', () => ({
  default: { findOneAndUpdate: mockClientFindOneAndUpdate },
}));

vi.mock('@/lib/ratelimit', () => ({
  checkTokenRateLimit: vi.fn().mockResolvedValue({ success: true, reset: 0 }),
}));

// ─── assertKnownDomain ────────────────────────────────────────────────────────

describe('assertKnownDomain', () => {
  beforeEach(() => vi.clearAllMocks());

  it('résout sans erreur pour un domaine connu (prod, sans port)', async () => {
    mockRestaurantExists.mockResolvedValueOnce(true);
    const { assertKnownDomain } = await import('@/lib/auth/assert-known-domain');
    await expect(assertKnownDomain('https://resto-a.com')).resolves.toBeUndefined();
    expect(mockRestaurantExists).toHaveBeenCalledWith({ domaine: 'resto-a.com' });
  });

  it('résout sans erreur pour un domaine connu (dev, avec port)', async () => {
    mockRestaurantExists.mockResolvedValueOnce(true);
    const { assertKnownDomain } = await import('@/lib/auth/assert-known-domain');
    await expect(assertKnownDomain('http://resto-a.local:3000')).resolves.toBeUndefined();
    expect(mockRestaurantExists).toHaveBeenCalledWith({ domaine: 'resto-a.local:3000' });
  });

  it('lève une erreur pour un domaine inconnu', async () => {
    mockRestaurantExists.mockResolvedValueOnce(false);
    const { assertKnownDomain } = await import('@/lib/auth/assert-known-domain');
    await expect(assertKnownDomain('https://malveillant.com')).rejects.toThrow(
      'Domaine non autorisé : malveillant.com'
    );
  });

  it('lève une erreur pour une URL malformée', async () => {
    const { assertKnownDomain } = await import('@/lib/auth/assert-known-domain');
    await expect(assertKnownDomain('pas-une-url')).rejects.toThrow('URL malformée');
  });
});

// ─── POST /api/auth/token ─────────────────────────────────────────────────────

describe('POST /api/auth/token', () => {
  const INTER_SERVICE_SECRET = 'test_secret_12345';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('INTER_SERVICE_SECRET', INTER_SERVICE_SECRET);
  });

  async function makeRequest(code: string, authorization?: string) {
    const { POST } = await import('@/app/api/auth/token/route');
    const req = new NextRequest('http://localhost/api/auth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authorization ? { Authorization: authorization } : {}),
      },
      body: JSON.stringify({ code }),
    });
    return POST(req);
  }

  it('retourne userId/email/name pour un code valide + bon secret', async () => {
    mockAuthCodeFindOneAndDelete.mockResolvedValueOnce({
      userId: 'user123',
      email: 'test@example.com',
      name: 'Test User',
    });

    const res = await makeRequest('valid_code', `Bearer ${INTER_SERVICE_SECRET}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ userId: 'user123', email: 'test@example.com', name: 'Test User' });
  });

  it('retourne 401 avec un mauvais secret', async () => {
    const res = await makeRequest('valid_code', 'Bearer wrong_secret');
    expect(res.status).toBe(401);
  });

  it('retourne 401 sans header Authorization', async () => {
    const res = await makeRequest('valid_code');
    expect(res.status).toBe(401);
  });

  it('retourne 401 pour un code expiré (document absent en DB)', async () => {
    mockAuthCodeFindOneAndDelete.mockResolvedValueOnce(null);
    const res = await makeRequest('expired_code', `Bearer ${INTER_SERVICE_SECRET}`);
    expect(res.status).toBe(401);
  });

  it('garantit l\'usage unique : 401 au second appel avec le même code', async () => {
    mockAuthCodeFindOneAndDelete
      .mockResolvedValueOnce({ userId: 'user123', email: 'test@example.com', name: null })
      .mockResolvedValueOnce(null); // second appel → supprimé

    const res1 = await makeRequest('one_time_code', `Bearer ${INTER_SERVICE_SECRET}`);
    const res2 = await makeRequest('one_time_code', `Bearer ${INTER_SERVICE_SECRET}`);

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(401);
  });

  it('retourne 400 si code absent du body', async () => {
    const { POST } = await import('@/app/api/auth/token/route');
    const req = new NextRequest('http://localhost/api/auth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${INTER_SERVICE_SECRET}`,
      },
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

// ─── GET /api/auth/cross-domain ───────────────────────────────────────────────

describe('GET /api/auth/cross-domain', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('AUTH_HUB_URL', 'https://app.3gsolution.com');
    vi.stubEnv('INTER_SERVICE_SECRET', 'test_secret_12345');
  });

  async function makeRequest(code?: string) {
    const { GET } = await import('@/app/api/auth/cross-domain/route');
    const url = code
      ? `http://resto-a.com/api/auth/cross-domain?code=${code}`
      : 'http://resto-a.com/api/auth/cross-domain';
    const req = new NextRequest(url);
    return GET(req);
  }

  it('redirige vers /auth/login?error=invalid si code absent', async () => {
    const res = await makeRequest();
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/auth/login?error=invalid');
  });

  it('crée un RelayToken et redirige vers /auth/completing si code valide', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ userId: 'u1', email: 'a@b.com', name: 'Alice' }), { status: 200 })
    );
    vi.stubGlobal('fetch', mockFetch);
    mockRelayTokenCreate.mockResolvedValueOnce({});

    const res = await makeRequest('valid_code_abc');
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/auth/completing?t=');
    expect(mockRelayTokenCreate).toHaveBeenCalledOnce();
  });

  it('redirige vers /auth/login?error=expired si le hub répond 401', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Code invalide' }), { status: 401 })
    );
    vi.stubGlobal('fetch', mockFetch);

    const res = await makeRequest('expired_code');
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/auth/login?error=expired');
    expect(mockRelayTokenCreate).not.toHaveBeenCalled();
  });
});

// ─── Provider cross-domain (lib/auth.ts) ─────────────────────────────────────

describe('Provider cross-domain — authorize()', () => {
  // NEXTAUTH_SECRET requis par lib/auth.ts au chargement du module (check module-level)
  vi.stubEnv('NEXTAUTH_SECRET', 'test-secret-for-vitest-min-32-chars');
  vi.stubEnv('NEXTAUTH_URL', 'http://localhost:3000');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function callAuthorize(t?: string) {
    // On récupère le provider cross-domain depuis authOptions
    // Note: CredentialsProvider stocke l'id custom dans options.id (p.id est toujours 'credentials')
    const { authOptions } = await import('@/lib/auth');
    const provider = authOptions.providers.find(
      (p) => (p as { options?: { id?: string } }).options?.id === 'cross-domain'
    ) as {
      options: { authorize: (c: { t?: string }, req: unknown) => Promise<unknown> };
    };
    // Appeler options.authorize directement (p.authorize est un wrapper NextAuth)
    return provider.options.authorize({ t }, null);
  }

  it('crée une session pour un RelayToken valide', async () => {
    const mockClient = { _id: { toString: () => 'clientId1' }, email: 'a@b.com', nom: 'Alice' };
    mockRelayTokenFindOneAndDelete.mockResolvedValueOnce({
      token: 'relay_abc',
      userId: 'u1',
      email: 'a@b.com',
      name: 'Alice',
    });
    mockClientFindOneAndUpdate.mockResolvedValueOnce(mockClient);

    const result = await callAuthorize('relay_abc');
    expect(result).toMatchObject({ id: 'clientId1', email: 'a@b.com', role: 'client' });
  });

  it('retourne null pour un RelayToken expiré', async () => {
    mockRelayTokenFindOneAndDelete.mockResolvedValueOnce(null);
    const result = await callAuthorize('expired_relay');
    expect(result).toBeNull();
  });

  it('retourne null si t est absent', async () => {
    const result = await callAuthorize(undefined);
    expect(result).toBeNull();
  });

  it('garantit l\'usage unique : null au second appel avec le même RelayToken', async () => {
    const mockClient = { _id: { toString: () => 'cid' }, email: 'x@y.com', nom: 'X' };
    mockClientFindOneAndUpdate.mockResolvedValue(mockClient);

    mockRelayTokenFindOneAndDelete
      .mockResolvedValueOnce({ token: 't', userId: 'u', email: 'x@y.com', name: 'X' })
      .mockResolvedValueOnce(null);

    const r1 = await callAuthorize('t');
    const r2 = await callAuthorize('t');

    expect(r1).not.toBeNull();
    expect(r2).toBeNull();
  });
});
