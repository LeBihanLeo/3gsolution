import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── vi.hoisted pour éviter le problème de hoisting avec vi.mock ───────────────
const { mockProduitChain, mockProduitModel } = vi.hoisted(() => {
  const chain = {
    sort: vi.fn().mockReturnThis(),
    lean: vi.fn().mockResolvedValue([]),
  };
  return {
    mockProduitChain: chain,
    mockProduitModel: {
      find: vi.fn().mockReturnValue(chain),
      create: vi.fn(),
    },
  };
});

vi.mock('@/lib/mongodb', () => ({ connectDB: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('@/models/Produit', () => ({ default: mockProduitModel }));

import { getServerSession } from 'next-auth';
import { GET, POST } from '@/app/api/produits/route';

const mockProduits = [
  { _id: '1', nom: 'Burger', description: 'Desc', categorie: 'Burgers', prix: 850, actif: true, options: [] },
];

const makeReq = (url: string, method = 'GET', body?: unknown) =>
  new NextRequest(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });

describe('GET /api/produits', () => {
  beforeEach(() => vi.clearAllMocks());

  it('retourne 200 + liste des produits actifs (public)', async () => {
    mockProduitChain.lean.mockResolvedValueOnce(mockProduits);
    const res = await GET(makeReq('http://localhost/api/produits'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toHaveLength(1);
    expect(mockProduitModel.find).toHaveBeenCalledWith({ actif: true });
  });

  it('base vide → 200 + tableau vide', async () => {
    mockProduitChain.lean.mockResolvedValueOnce([]);
    const res = await GET(makeReq('http://localhost/api/produits'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toEqual([]);
  });

  it('?all=true sans session → 401', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(null);
    const res = await GET(makeReq('http://localhost/api/produits?all=true'));
    expect(res.status).toBe(401);
  });

  it('?all=true avec session admin → 200 + tous les produits', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { email: 'admin@test.com' } } as Parameters<typeof vi.mocked<typeof getServerSession>>[0] extends infer T ? T : never);
    mockProduitChain.lean.mockResolvedValueOnce(mockProduits);
    const res = await GET(makeReq('http://localhost/api/produits?all=true'));
    expect(res.status).toBe(200);
    expect(mockProduitModel.find).toHaveBeenCalledWith({});
  });
});

describe('POST /api/produits', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sans session → 401', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(null);
    const res = await POST(makeReq('http://localhost/api/produits', 'POST', { nom: 'Test' }));
    expect(res.status).toBe(401);
  });

  it('body invalide (prix manquant) → 400', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: {} } as NonNullable<Awaited<ReturnType<typeof getServerSession>>>);
    const res = await POST(makeReq('http://localhost/api/produits', 'POST', {
      nom: 'Test', description: 'Desc', categorie: 'Cat',
    }));
    expect(res.status).toBe(400);
  });

  it('body valide + session → 201 + produit créé', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: {} } as NonNullable<Awaited<ReturnType<typeof getServerSession>>>);
    mockProduitModel.create.mockResolvedValueOnce({ _id: 'new1', nom: 'Burger', prix: 850 });
    const res = await POST(makeReq('http://localhost/api/produits', 'POST', {
      nom: 'Burger', description: 'Desc', categorie: 'Burgers', prix: 850,
    }));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data.nom).toBe('Burger');
  });
});
