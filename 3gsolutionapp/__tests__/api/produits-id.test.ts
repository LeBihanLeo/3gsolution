import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockModel } = vi.hoisted(() => ({
  mockModel: {
    // TICK-133 — la route utilise findOneAndUpdate/findOneAndDelete (filtre { _id, restaurantId })
    findOneAndUpdate: vi.fn(),
    findOneAndDelete: vi.fn(),
    // Alias pour rétrocompatibilité des tests qui utilisent l'ancienne API
    get findByIdAndUpdate() { return this.findOneAndUpdate; },
    get findByIdAndDelete() { return this.findOneAndDelete; },
  },
}));

vi.mock('@/lib/mongodb', () => ({ connectDB: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('@/models/Produit', () => ({ default: mockModel }));
// TICK-133 — getTenantId utilisé par les routes produits (multi-tenant)
vi.mock('@/lib/tenant', () => ({ getTenantId: vi.fn().mockResolvedValue('restaurant_test_id') }));

import { getServerSession } from 'next-auth';
import { PUT, PATCH, DELETE } from '@/app/api/produits/[id]/route';

const mockProduit = { _id: 'abc123', nom: 'Burger', actif: true };

const makeReq = (method: string, body?: unknown) =>
  new NextRequest('http://localhost/api/produits/abc123', {
    method,
    headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });

const params = { params: Promise.resolve({ id: 'abc123' }) };

describe('PUT /api/produits/[id]', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sans session → 401', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(null);
    const res = await PUT(makeReq('PUT', { nom: 'Nouveau' }), params);
    expect(res.status).toBe(401);
  });

  it('ID inexistant → 404', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { role: 'admin' } } as NonNullable<Awaited<ReturnType<typeof getServerSession>>>);
    mockModel.findByIdAndUpdate.mockResolvedValueOnce(null);
    const res = await PUT(makeReq('PUT', { nom: 'Nouveau' }), params);
    expect(res.status).toBe(404);
  });

  it('mise à jour valide → 200 + produit mis à jour', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { role: 'admin' } } as NonNullable<Awaited<ReturnType<typeof getServerSession>>>);
    mockModel.findByIdAndUpdate.mockResolvedValueOnce({ ...mockProduit, nom: 'Nouveau' });
    const res = await PUT(makeReq('PUT', { nom: 'Nouveau' }), params);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.nom).toBe('Nouveau');
  });
});

describe('PATCH /api/produits/[id] (toggle actif)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sans session → 401', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(null);
    const res = await PATCH(makeReq('PATCH', { actif: false }), params);
    expect(res.status).toBe(401);
  });

  it('toggle actif → valeur inversée retournée', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { role: 'admin' } } as NonNullable<Awaited<ReturnType<typeof getServerSession>>>);
    mockModel.findByIdAndUpdate.mockResolvedValueOnce({ ...mockProduit, actif: false });
    const res = await PATCH(makeReq('PATCH', { actif: false }), params);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.actif).toBe(false);
  });
});

describe('DELETE /api/produits/[id]', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sans session → 401', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(null);
    const res = await DELETE(makeReq('DELETE'), params);
    expect(res.status).toBe(401);
  });

  it('ID inexistant → 404', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { role: 'admin' } } as NonNullable<Awaited<ReturnType<typeof getServerSession>>>);
    mockModel.findByIdAndDelete.mockResolvedValueOnce(null);
    const res = await DELETE(makeReq('DELETE'), params);
    expect(res.status).toBe(404);
  });

  it('suppression réussie → 200', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { role: 'admin' } } as NonNullable<Awaited<ReturnType<typeof getServerSession>>>);
    mockModel.findByIdAndDelete.mockResolvedValueOnce(mockProduit);
    const res = await DELETE(makeReq('DELETE'), params);
    expect(res.status).toBe(200);
  });
});
