import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';

const FAKE_TENANT_STR = 'aaaaaaaaaaaaaaaaaaaaaaaa';

// ── vi.hoisted ────────────────────────────────────────────────────────────────
const { mockModel, mockRequireAdmin, mockGetTenantId } = vi.hoisted(() => ({
  mockModel: { findOneAndUpdate: vi.fn(), findOneAndDelete: vi.fn() },
  mockRequireAdmin: vi.fn(),
  mockGetTenantId: vi.fn(),
}));

vi.mock('@/lib/mongodb', () => ({ connectDB: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('@/models/Produit', () => ({ default: mockModel }));
vi.mock('@/lib/assertAdmin', () => ({ requireAdmin: mockRequireAdmin }));
vi.mock('@/lib/tenant', () => ({ getTenantId: mockGetTenantId, resolveTenantForAdmin: mockGetTenantId }));

import { PUT, PATCH, DELETE } from '@/app/api/produits/[id]/route';

const FAKE_TENANT_ID = new mongoose.Types.ObjectId(FAKE_TENANT_STR);
const ADMIN_SESSION = { session: { user: { role: 'admin' } }, error: null };
const NO_AUTH = { session: null, error: NextResponse.json({ error: 'Non autorisé.' }, { status: 401 }) };

const mockProduit = { _id: 'abc123', nom: 'Burger', actif: true, restaurantId: FAKE_TENANT_ID };

const makeReq = (method: string, body?: unknown) =>
  new NextRequest('http://localhost/api/produits/abc123', {
    method,
    headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });

const params = { params: Promise.resolve({ id: 'abc123' }) };

describe('PUT /api/produits/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTenantId.mockResolvedValue(FAKE_TENANT_ID);
  });

  it('sans session → 401', async () => {
    mockRequireAdmin.mockResolvedValueOnce(NO_AUTH);
    const res = await PUT(makeReq('PUT', { nom: 'Nouveau' }), params);
    expect(res.status).toBe(401);
  });

  it('ID inexistant → 404', async () => {
    mockRequireAdmin.mockResolvedValueOnce(ADMIN_SESSION);
    mockModel.findOneAndUpdate.mockResolvedValueOnce(null);
    const res = await PUT(makeReq('PUT', { nom: 'Nouveau' }), params);
    expect(res.status).toBe(404);
  });

  it('mise à jour valide → 200 + filtre cross-tenant', async () => {
    mockRequireAdmin.mockResolvedValueOnce(ADMIN_SESSION);
    mockModel.findOneAndUpdate.mockResolvedValueOnce({ ...mockProduit, nom: 'Nouveau' });
    const res = await PUT(makeReq('PUT', { nom: 'Nouveau' }), params);
    expect(res.status).toBe(200);
    expect((await res.json()).data.nom).toBe('Nouveau');
    expect(mockModel.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ restaurantId: FAKE_TENANT_ID }),
      expect.anything(),
      expect.anything()
    );
  });
});

describe('PATCH /api/produits/[id] (toggle actif)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTenantId.mockResolvedValue(FAKE_TENANT_ID);
  });

  it('sans session → 401', async () => {
    mockRequireAdmin.mockResolvedValueOnce(NO_AUTH);
    const res = await PATCH(makeReq('PATCH', { actif: false }), params);
    expect(res.status).toBe(401);
  });

  it('toggle actif → 200 + filtre cross-tenant', async () => {
    mockRequireAdmin.mockResolvedValueOnce(ADMIN_SESSION);
    mockModel.findOneAndUpdate.mockResolvedValueOnce({ ...mockProduit, actif: false });
    const res = await PATCH(makeReq('PATCH', { actif: false }), params);
    expect(res.status).toBe(200);
    expect((await res.json()).data.actif).toBe(false);
    expect(mockModel.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ restaurantId: FAKE_TENANT_ID }),
      expect.anything(),
      expect.anything()
    );
  });
});

describe('DELETE /api/produits/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTenantId.mockResolvedValue(FAKE_TENANT_ID);
  });

  it('sans session → 401', async () => {
    mockRequireAdmin.mockResolvedValueOnce(NO_AUTH);
    const res = await DELETE(makeReq('DELETE'), params);
    expect(res.status).toBe(401);
  });

  it('ID inexistant → 404', async () => {
    mockRequireAdmin.mockResolvedValueOnce(ADMIN_SESSION);
    mockModel.findOneAndDelete.mockResolvedValueOnce(null);
    const res = await DELETE(makeReq('DELETE'), params);
    expect(res.status).toBe(404);
  });

  it('suppression réussie → 200 + filtre cross-tenant', async () => {
    mockRequireAdmin.mockResolvedValueOnce(ADMIN_SESSION);
    mockModel.findOneAndDelete.mockResolvedValueOnce(mockProduit);
    const res = await DELETE(makeReq('DELETE'), params);
    expect(res.status).toBe(200);
    expect(mockModel.findOneAndDelete).toHaveBeenCalledWith(
      expect.objectContaining({ restaurantId: FAKE_TENANT_ID })
    );
  });
});
