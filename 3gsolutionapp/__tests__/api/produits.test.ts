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
// TICK-133 — getTenantId utilisé par les routes produits (multi-tenant)
vi.mock('@/lib/tenant', () => ({ getTenantId: vi.fn().mockResolvedValue('restaurant_test_id') }));

import { getServerSession } from 'next-auth';
import { GET, POST } from '@/app/api/produits/route';

const mockProduits = [
  { _id: '1', nom: 'Burger', description: 'Desc', categorie: 'Burgers', prix: 850, taux_tva: 10, actif: true, options: [] },
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
    expect(mockProduitModel.find).toHaveBeenCalledWith({ restaurantId: 'restaurant_test_id', actif: true });
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
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { role: 'admin', email: 'admin@test.com' } } as NonNullable<Awaited<ReturnType<typeof getServerSession>>>);
    mockProduitChain.lean.mockResolvedValueOnce(mockProduits);
    const res = await GET(makeReq('http://localhost/api/produits?all=true'));
    expect(res.status).toBe(200);
    expect(mockProduitModel.find).toHaveBeenCalledWith({ restaurantId: 'restaurant_test_id' });
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
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { role: 'admin' } } as NonNullable<Awaited<ReturnType<typeof getServerSession>>>);
    const res = await POST(makeReq('http://localhost/api/produits', 'POST', {
      nom: 'Test', description: 'Desc', categorie: 'Cat',
    }));
    expect(res.status).toBe(400);
  });

  it('body valide + session → 201 + produit créé', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { role: 'admin' } } as NonNullable<Awaited<ReturnType<typeof getServerSession>>>);
    mockProduitModel.create.mockResolvedValueOnce({ _id: 'new1', nom: 'Burger', prix: 850, taux_tva: 10 });
    const res = await POST(makeReq('http://localhost/api/produits', 'POST', {
      nom: 'Burger', description: 'Desc', categorie: 'Burgers', prix: 850,
    }));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data.nom).toBe('Burger');
  });

  // TICK-127 — taux_tva Zod
  it('body avec taux_tva valide (20) → 201', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { role: 'admin' } } as NonNullable<Awaited<ReturnType<typeof getServerSession>>>);
    mockProduitModel.create.mockResolvedValueOnce({ _id: 'new2', nom: 'Bière', prix: 500, taux_tva: 20 });
    const res = await POST(makeReq('http://localhost/api/produits', 'POST', {
      nom: 'Bière', description: 'Desc', categorie: 'Boissons', prix: 500, taux_tva: 20,
    }));
    expect(res.status).toBe(201);
  });

  it('body avec taux_tva invalide (7) → 400', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { role: 'admin' } } as NonNullable<Awaited<ReturnType<typeof getServerSession>>>);
    const res = await POST(makeReq('http://localhost/api/produits', 'POST', {
      nom: 'Test', description: 'Desc', categorie: 'Cat', prix: 500, taux_tva: 7,
    }));
    expect(res.status).toBe(400);
  });

  it('body sans taux_tva → 201 (défaut 10 appliqué)', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { role: 'admin' } } as NonNullable<Awaited<ReturnType<typeof getServerSession>>>);
    mockProduitModel.create.mockResolvedValueOnce({ _id: 'new3', nom: 'Pizza', prix: 900, taux_tva: 10 });
    const res = await POST(makeReq('http://localhost/api/produits', 'POST', {
      nom: 'Pizza', description: 'Desc', categorie: 'Plats', prix: 900,
    }));
    expect(res.status).toBe(201);
    expect(mockProduitModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ taux_tva: 10 })
    );
  });
});
