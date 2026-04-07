// TICK-132 — Tests de la route interne /api/tenant-resolver
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/mongodb', () => ({ connectDB: vi.fn().mockResolvedValue(undefined) }));

const { mockFindOne } = vi.hoisted(() => ({
  mockFindOne: vi.fn(),
}));

vi.mock('@/models/Restaurant', () => ({
  default: {
    findOne: mockFindOne,
  },
}));

// Provide NEXTAUTH_SECRET for the auth check
process.env.NEXTAUTH_SECRET = 'test-secret';

async function importRoute() {
  const mod = await import('@/app/api/tenant-resolver/route');
  return mod.GET;
}

function makeRequest(host: string) {
  return new NextRequest(
    `http://localhost/api/tenant-resolver?host=${encodeURIComponent(host)}`,
    { headers: { 'x-internal-secret': 'test-secret' } }
  );
}

describe('GET /api/tenant-resolver (TICK-132)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('retourne 403 si x-internal-secret absent', async () => {
    const GET = await importRoute();
    const req = new NextRequest('http://localhost/api/tenant-resolver?host=www.resto.com');
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it('retourne 400 si host manquant', async () => {
    const GET = await importRoute();
    const req = new NextRequest('http://localhost/api/tenant-resolver', {
      headers: { 'x-internal-secret': 'test-secret' },
    });
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it('retourne l\'id du restaurant quand le domaine est trouvé', async () => {
    mockFindOne.mockReturnValue({
      select: () => Promise.resolve({ _id: { toString: () => 'abc123' } }),
    });
    const GET = await importRoute();
    const res = await GET(makeRequest('www.resto-a.com'));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.id).toBe('abc123');
  });

  it('retourne 404 pour domaine inconnu en production', async () => {
    mockFindOne.mockReturnValue({ select: () => Promise.resolve(null) });
    process.env.NODE_ENV = 'production';
    const GET = await importRoute();
    const res = await GET(makeRequest('www.inconnu.com'));
    expect(res.status).toBe(404);
    process.env.NODE_ENV = 'test';
  });

  it('retourne le fallback pour localhost (seed)', async () => {
    // findOne domaine → null, findOne seed → restaurant
    mockFindOne
      .mockReturnValueOnce({ select: () => Promise.resolve(null) })
      .mockReturnValueOnce({
        sort: () => ({ select: () => Promise.resolve({ _id: { toString: () => 'seed-id' } }) }),
      });
    const GET = await importRoute();
    const res = await GET(makeRequest('localhost:3000'));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.id).toBe('seed-id');
    expect(data.fallback).toBe(true);
  });

  it('résout restoa.localhost:3000 par slug "restoa"', async () => {
    // findOne domaine → null, findOne bySlug → restaurant
    mockFindOne
      .mockReturnValueOnce({ select: () => Promise.resolve(null) })  // domain query
      .mockReturnValueOnce({ select: () => Promise.resolve({ _id: { toString: () => 'restoa-id' } }) }); // bySlug
    const GET = await importRoute();
    const res = await GET(makeRequest('restoa.localhost:3000'));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.id).toBe('restoa-id');
    expect(data.fallback).toBe(true);
  });
});
