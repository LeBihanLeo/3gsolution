// TICK-138 — Tests API superadmin restaurants
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';
import mongoose from 'mongoose';

// ── Mocks hoistés ────────────────────────────────────────────────────────────
const { mockRequireSuperadmin, mockRestaurantCreate, mockRestaurantFind,
        mockRestaurantFindById, mockRestaurantFindByIdAndUpdate,
        mockRestaurantDeleteOne, mockProduitCountDocuments,
        mockCommandeCountDocuments, mockProduitDeleteMany } = vi.hoisted(() => {
  const findChain = { select: vi.fn().mockReturnThis(), lean: vi.fn().mockResolvedValue([]) };
  return {
    mockRequireSuperadmin: vi.fn(),
    mockRestaurantCreate: vi.fn(),
    mockRestaurantFind: vi.fn().mockReturnValue(findChain),
    mockRestaurantFindById: vi.fn(),
    mockRestaurantFindByIdAndUpdate: vi.fn(),
    mockRestaurantDeleteOne: vi.fn(),
    mockProduitCountDocuments: vi.fn().mockResolvedValue(0),
    mockCommandeCountDocuments: vi.fn().mockResolvedValue(0),
    mockProduitDeleteMany: vi.fn().mockResolvedValue({ deletedCount: 0 }),
  };
});

vi.mock('@/lib/mongodb', () => ({ connectDB: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/superadmin-guard', () => ({ requireSuperadmin: mockRequireSuperadmin }));
vi.mock('bcryptjs', () => ({ default: { hash: vi.fn().mockResolvedValue('hashed_password') } }));

vi.mock('@/models/Restaurant', () => ({
  default: {
    find: mockRestaurantFind,
    findById: mockRestaurantFindById,
    findByIdAndUpdate: mockRestaurantFindByIdAndUpdate,
    deleteOne: mockRestaurantDeleteOne,
    create: mockRestaurantCreate,
  },
}));

vi.mock('@/models/Produit', () => ({
  default: {
    countDocuments: mockProduitCountDocuments,
    deleteMany: mockProduitDeleteMany,
  },
}));

vi.mock('@/models/Commande', () => ({
  default: { countDocuments: mockCommandeCountDocuments },
}));

import { GET, POST } from '@/app/api/superadmin/restaurants/route';
import { PUT, DELETE } from '@/app/api/superadmin/restaurants/[id]/route';

const AUTH_OK = { email: 'super@admin.com', error: null };
const AUTH_FAIL = {
  email: null,
  error: NextResponse.json({ error: 'Non autorisé.' }, { status: 401 }),
};

const VALID_ID = new mongoose.Types.ObjectId().toString();
const INVALID_ID = 'not-an-objectid';

// ── Helpers ──────────────────────────────────────────────────────────────────
function makeRequest(body?: unknown, method = 'POST'): Request {
  return new Request('http://localhost/api/superadmin/restaurants', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

// ── GET /api/superadmin/restaurants ──────────────────────────────────────────
describe('GET /api/superadmin/restaurants', () => {
  beforeEach(() => vi.clearAllMocks());

  it('401 si non authentifié', async () => {
    mockRequireSuperadmin.mockResolvedValueOnce(AUTH_FAIL);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('200 + liste vide', async () => {
    mockRequireSuperadmin.mockResolvedValueOnce(AUTH_OK);
    const findChain = { select: vi.fn().mockReturnThis(), lean: vi.fn().mockResolvedValue([]) };
    mockRestaurantFind.mockReturnValueOnce(findChain);
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toEqual([]);
  });

  it('200 + liste avec comptes de produits et commandes', async () => {
    mockRequireSuperadmin.mockResolvedValueOnce(AUTH_OK);
    const fakeResto = {
      _id: new mongoose.Types.ObjectId(VALID_ID),
      nomRestaurant: 'Resto A',
      slug: 'resto-a',
      domaine: 'www.restoa.com',
      adminEmail: 'admin@restoa.com',
      createdAt: new Date(),
    };
    const findChain = {
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([fakeResto]),
    };
    mockRestaurantFind.mockReturnValueOnce(findChain);
    mockProduitCountDocuments.mockResolvedValueOnce(5);
    mockCommandeCountDocuments.mockResolvedValueOnce(12);

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toHaveLength(1);
    expect(json.data[0].nbProduits).toBe(5);
    expect(json.data[0].nbCommandes).toBe(12);
  });
});

// ── POST /api/superadmin/restaurants ─────────────────────────────────────────
describe('POST /api/superadmin/restaurants', () => {
  const validBody = {
    nomRestaurant: 'Resto A',
    slug: 'resto-a',
    domaine: 'www.restoa.com',
    adminEmail: 'admin@restoa.com',
    adminPassword: 'password123',
    stripeSecretKey: 'sk_test_123',
    stripePublishableKey: 'pk_test_123',
    stripeWebhookSecret: 'whsec_123',
  };

  beforeEach(() => vi.clearAllMocks());

  it('401 si non authentifié', async () => {
    mockRequireSuperadmin.mockResolvedValueOnce(AUTH_FAIL);
    const res = await POST(makeRequest(validBody) as never);
    expect(res.status).toBe(401);
  });

  it('400 si body invalide', async () => {
    mockRequireSuperadmin.mockResolvedValueOnce(AUTH_OK);
    const res = await POST(makeRequest({ nomRestaurant: 'Test' }) as never);
    expect(res.status).toBe(400);
  });

  it('400 si slug avec caractères invalides', async () => {
    mockRequireSuperadmin.mockResolvedValueOnce(AUTH_OK);
    const res = await POST(
      makeRequest({ ...validBody, slug: 'Resto A!' }) as never
    );
    expect(res.status).toBe(400);
  });

  it('201 + restaurant créé', async () => {
    mockRequireSuperadmin.mockResolvedValueOnce(AUTH_OK);
    mockRestaurantCreate.mockResolvedValueOnce({
      _id: new mongoose.Types.ObjectId(VALID_ID),
      slug: 'resto-a',
    });
    const res = await POST(makeRequest(validBody) as never);
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data.slug).toBe('resto-a');
  });

  it('409 si slug/domaine déjà utilisé (duplicate key)', async () => {
    mockRequireSuperadmin.mockResolvedValueOnce(AUTH_OK);
    const dupError = Object.assign(new Error('Duplicate'), { code: 11000 });
    mockRestaurantCreate.mockRejectedValueOnce(dupError);
    const res = await POST(makeRequest(validBody) as never);
    expect(res.status).toBe(409);
  });
});

// ── PUT /api/superadmin/restaurants/[id] ─────────────────────────────────────
describe('PUT /api/superadmin/restaurants/[id]', () => {
  beforeEach(() => vi.clearAllMocks());

  it('401 si non authentifié', async () => {
    mockRequireSuperadmin.mockResolvedValueOnce(AUTH_FAIL);
    const res = await PUT(makeRequest({ nomRestaurant: 'X' }, 'PUT') as never, makeParams(VALID_ID));
    expect(res.status).toBe(401);
  });

  it('400 si ID invalide', async () => {
    mockRequireSuperadmin.mockResolvedValueOnce(AUTH_OK);
    const res = await PUT(makeRequest({ nomRestaurant: 'X' }, 'PUT') as never, makeParams(INVALID_ID));
    expect(res.status).toBe(400);
  });

  it('404 si restaurant introuvable', async () => {
    mockRequireSuperadmin.mockResolvedValueOnce(AUTH_OK);
    mockRestaurantFindByIdAndUpdate.mockResolvedValueOnce(null);
    const res = await PUT(makeRequest({ nomRestaurant: 'X' }, 'PUT') as never, makeParams(VALID_ID));
    expect(res.status).toBe(404);
  });

  it('200 si mise à jour réussie', async () => {
    mockRequireSuperadmin.mockResolvedValueOnce(AUTH_OK);
    mockRestaurantFindByIdAndUpdate.mockResolvedValueOnce({
      _id: new mongoose.Types.ObjectId(VALID_ID),
      slug: 'resto-a',
      nomRestaurant: 'Nouveau Nom',
    });
    const res = await PUT(
      makeRequest({ nomRestaurant: 'Nouveau Nom' }, 'PUT') as never,
      makeParams(VALID_ID)
    );
    expect(res.status).toBe(200);
  });

  it('re-hash le mot de passe si adminPassword fourni', async () => {
    mockRequireSuperadmin.mockResolvedValueOnce(AUTH_OK);
    mockRestaurantFindByIdAndUpdate.mockResolvedValueOnce({
      _id: new mongoose.Types.ObjectId(VALID_ID),
      slug: 'resto-a',
      nomRestaurant: 'Resto A',
    });
    const bcrypt = await import('bcryptjs');
    const res = await PUT(
      makeRequest({ adminPassword: 'new_password_123' }, 'PUT') as never,
      makeParams(VALID_ID)
    );
    expect(res.status).toBe(200);
    expect(bcrypt.default.hash).toHaveBeenCalledWith('new_password_123', 12);
  });
});

// ── DELETE /api/superadmin/restaurants/[id] ───────────────────────────────────
describe('DELETE /api/superadmin/restaurants/[id]', () => {
  beforeEach(() => vi.clearAllMocks());

  it('401 si non authentifié', async () => {
    mockRequireSuperadmin.mockResolvedValueOnce(AUTH_FAIL);
    const res = await DELETE(new Request('http://localhost') as never, makeParams(VALID_ID));
    expect(res.status).toBe(401);
  });

  it('400 si ID invalide', async () => {
    mockRequireSuperadmin.mockResolvedValueOnce(AUTH_OK);
    const res = await DELETE(new Request('http://localhost') as never, makeParams(INVALID_ID));
    expect(res.status).toBe(400);
  });

  it('409 si des commandes existent (protection comptable)', async () => {
    mockRequireSuperadmin.mockResolvedValueOnce(AUTH_OK);
    mockCommandeCountDocuments.mockResolvedValueOnce(3);
    const res = await DELETE(new Request('http://localhost') as never, makeParams(VALID_ID));
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toContain('3 commande(s)');
  });

  it('404 si restaurant introuvable', async () => {
    mockRequireSuperadmin.mockResolvedValueOnce(AUTH_OK);
    mockCommandeCountDocuments.mockResolvedValueOnce(0);
    mockRestaurantFindById.mockResolvedValueOnce(null);
    const res = await DELETE(new Request('http://localhost') as never, makeParams(VALID_ID));
    expect(res.status).toBe(404);
  });

  it('200 + suppression cascade produits', async () => {
    mockRequireSuperadmin.mockResolvedValueOnce(AUTH_OK);
    mockCommandeCountDocuments.mockResolvedValueOnce(0);
    mockRestaurantFindById.mockResolvedValueOnce({ _id: VALID_ID });
    mockProduitDeleteMany.mockResolvedValueOnce({ deletedCount: 2 });
    mockRestaurantDeleteOne.mockResolvedValueOnce({ deletedCount: 1 });

    const res = await DELETE(new Request('http://localhost') as never, makeParams(VALID_ID));
    expect(res.status).toBe(200);
    expect(mockProduitDeleteMany).toHaveBeenCalledWith({ restaurantId: VALID_ID });
    expect(mockRestaurantDeleteOne).toHaveBeenCalledWith({ _id: VALID_ID });
  });
});
