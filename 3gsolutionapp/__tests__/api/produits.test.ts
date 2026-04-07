import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import mongoose from 'mongoose';
import { NextResponse } from 'next/server';

const FAKE_TENANT_STR = 'aaaaaaaaaaaaaaaaaaaaaaaa';

// ── vi.hoisted ────────────────────────────────────────────────────────────────
const { mockProduitChain, mockProduitModel, mockRequireAdmin, mockGetTenantId } = vi.hoisted(() => {
  const chain = {
    sort: vi.fn().mockReturnThis(),
    lean: vi.fn().mockResolvedValue([]),
  };
  return {
    mockProduitChain: chain,
    mockProduitModel: { find: vi.fn().mockReturnValue(chain), create: vi.fn() },
    mockRequireAdmin: vi.fn(),
    mockGetTenantId: vi.fn(),
  };
});

vi.mock('@/lib/mongodb', () => ({ connectDB: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('@/models/Produit', () => ({ default: mockProduitModel }));
vi.mock('@/lib/assertAdmin', () => ({ requireAdmin: mockRequireAdmin }));
vi.mock('@/lib/tenant', () => ({ getTenantId: mockGetTenantId, resolveTenantForAdmin: mockGetTenantId }));

import { GET, POST } from '@/app/api/produits/route';

const FAKE_TENANT_ID = new mongoose.Types.ObjectId(FAKE_TENANT_STR);
const ADMIN_SESSION = { session: { user: { role: 'admin', email: 'admin@test.com' } }, error: null };
const NO_AUTH = { session: null, error: NextResponse.json({ error: 'Non autorisé.' }, { status: 401 }) };

const mockProduits = [
  { _id: '1', nom: 'Burger', description: 'Desc', categorie: 'Burgers', prix: 850, taux_tva: 10, actif: true, options: [], restaurantId: FAKE_TENANT_ID },
];

const makeReq = (url: string, method = 'GET', body?: unknown) =>
  new NextRequest(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });

describe('GET /api/produits', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTenantId.mockResolvedValue(FAKE_TENANT_ID);
  });

  it('retourne 200 + produits actifs filtrés par tenant (public)', async () => {
    mockProduitChain.lean.mockResolvedValueOnce(mockProduits);
    const res = await GET(makeReq('http://localhost/api/produits'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toHaveLength(1);
    // TICK-133 — filtrage par restaurantId
    expect(mockProduitModel.find).toHaveBeenCalledWith({ restaurantId: FAKE_TENANT_ID, actif: true });
  });

  it('base vide → 200 + tableau vide', async () => {
    mockProduitChain.lean.mockResolvedValueOnce([]);
    const res = await GET(makeReq('http://localhost/api/produits'));
    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual([]);
  });

  it('?all=true sans session → 401', async () => {
    mockRequireAdmin.mockResolvedValueOnce(NO_AUTH);
    const res = await GET(makeReq('http://localhost/api/produits?all=true'));
    expect(res.status).toBe(401);
  });

  it('?all=true avec session admin → 200 + tous les produits du tenant', async () => {
    mockRequireAdmin.mockResolvedValueOnce(ADMIN_SESSION);
    mockProduitChain.lean.mockResolvedValueOnce(mockProduits);
    const res = await GET(makeReq('http://localhost/api/produits?all=true'));
    expect(res.status).toBe(200);
    // TICK-133 — filtrage par restaurantId même pour admin
    expect(mockProduitModel.find).toHaveBeenCalledWith({ restaurantId: FAKE_TENANT_ID });
  });
});

describe('POST /api/produits', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTenantId.mockResolvedValue(FAKE_TENANT_ID);
  });

  it('sans session → 401', async () => {
    mockRequireAdmin.mockResolvedValueOnce(NO_AUTH);
    const res = await POST(makeReq('http://localhost/api/produits', 'POST', { nom: 'Test' }));
    expect(res.status).toBe(401);
  });

  it('body invalide (prix manquant) → 400', async () => {
    mockRequireAdmin.mockResolvedValueOnce(ADMIN_SESSION);
    const res = await POST(makeReq('http://localhost/api/produits', 'POST', {
      nom: 'Test', description: 'Desc', categorie: 'Cat',
    }));
    expect(res.status).toBe(400);
  });

  it('body valide + session → 201 + restaurantId injecté', async () => {
    mockRequireAdmin.mockResolvedValueOnce(ADMIN_SESSION);
    mockProduitModel.create.mockResolvedValueOnce({ _id: 'new1', nom: 'Burger', prix: 850, taux_tva: 10, restaurantId: FAKE_TENANT_ID });
    const res = await POST(makeReq('http://localhost/api/produits', 'POST', {
      nom: 'Burger', description: 'Desc', categorie: 'Burgers', prix: 850,
    }));
    expect(res.status).toBe(201);
    expect(mockProduitModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ restaurantId: FAKE_TENANT_ID })
    );
  });

  it('body avec taux_tva valide (20) → 201', async () => {
    mockRequireAdmin.mockResolvedValueOnce(ADMIN_SESSION);
    mockProduitModel.create.mockResolvedValueOnce({ _id: 'new2', nom: 'Bière', prix: 500, taux_tva: 20 });
    const res = await POST(makeReq('http://localhost/api/produits', 'POST', {
      nom: 'Bière', description: 'Desc', categorie: 'Boissons', prix: 500, taux_tva: 20,
    }));
    expect(res.status).toBe(201);
  });

  it('body avec taux_tva invalide (7) → 400', async () => {
    mockRequireAdmin.mockResolvedValueOnce(ADMIN_SESSION);
    const res = await POST(makeReq('http://localhost/api/produits', 'POST', {
      nom: 'Test', description: 'Desc', categorie: 'Cat', prix: 500, taux_tva: 7,
    }));
    expect(res.status).toBe(400);
  });

  it('body sans taux_tva → 201 (défaut 10)', async () => {
    mockRequireAdmin.mockResolvedValueOnce(ADMIN_SESSION);
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
