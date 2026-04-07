// TICK-099 — Tests PATCH /api/commandes/[id]/statut
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';

const FAKE_TENANT_ID = new mongoose.Types.ObjectId('aaaaaaaaaaaaaaaaaaaaaaaa');

const { mockCommandeModel, mockRequireAdmin, mockGetTenantId } = vi.hoisted(() => ({
  // TICK-134 — findOne avec restaurantId (plus findById seul)
  mockCommandeModel: { findOne: vi.fn() },
  mockRequireAdmin: vi.fn(),
  mockGetTenantId: vi.fn(),
}));

vi.mock('@/lib/mongodb', () => ({ connectDB: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('@/lib/assertAdmin', () => ({ requireAdmin: mockRequireAdmin }));
vi.mock('@/lib/tenant', () => ({ getTenantId: mockGetTenantId, resolveTenantForAdmin: mockGetTenantId }));
vi.mock('@/models/Commande', () => ({ default: mockCommandeModel }));

import { PATCH } from '@/app/api/commandes/[id]/statut/route';

const makeReq = (body: unknown) =>
  new NextRequest('http://localhost/api/commandes/abc/statut', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

const params = { params: Promise.resolve({ id: 'abc123' }) };

const ADMIN_SESSION = { session: { user: { role: 'admin' } }, error: null };
const NO_AUTH = { session: null, error: NextResponse.json({ error: 'Non autorisé.' }, { status: 401 }) };

describe('PATCH /api/commandes/[id]/statut', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTenantId.mockResolvedValue(FAKE_TENANT_ID);
  });

  it('sans session → 401', async () => {
    mockRequireAdmin.mockResolvedValueOnce(NO_AUTH);
    const res = await PATCH(makeReq({ statut: 'en_preparation' }), params);
    expect(res.status).toBe(401);
  });

  it('statut invalide → 400', async () => {
    mockRequireAdmin.mockResolvedValueOnce(ADMIN_SESSION);
    const res = await PATCH(makeReq({ statut: 'payee' }), params);
    expect(res.status).toBe(400);
  });

  it('transition payee → en_preparation → 200', async () => {
    mockRequireAdmin.mockResolvedValueOnce(ADMIN_SESSION);
    const mockCommande = { _id: 'abc123', statut: 'payee', save: vi.fn().mockResolvedValue(undefined) };
    mockCommandeModel.findOne.mockResolvedValueOnce(mockCommande);
    const res = await PATCH(makeReq({ statut: 'en_preparation' }), params);
    expect(res.status).toBe(200);
    expect(mockCommande.statut).toBe('en_preparation');
    expect(mockCommande.save).toHaveBeenCalled();
  });

  it('transition en_preparation → prete → 200', async () => {
    mockRequireAdmin.mockResolvedValueOnce(ADMIN_SESSION);
    const mockCommande = { _id: 'abc123', statut: 'en_preparation', save: vi.fn().mockResolvedValue(undefined) };
    mockCommandeModel.findOne.mockResolvedValueOnce(mockCommande);
    const res = await PATCH(makeReq({ statut: 'prete' }), params);
    expect(res.status).toBe(200);
    expect(mockCommande.statut).toBe('prete');
  });

  it('transition prete → recuperee → 200 + recupereeAt posé', async () => {
    mockRequireAdmin.mockResolvedValueOnce(ADMIN_SESSION);
    const mockCommande = { _id: 'abc123', statut: 'prete', recupereeAt: undefined as Date | undefined, save: vi.fn().mockResolvedValue(undefined) };
    mockCommandeModel.findOne.mockResolvedValueOnce(mockCommande);
    const res = await PATCH(makeReq({ statut: 'recuperee' }), params);
    expect(res.status).toBe(200);
    expect(mockCommande.statut).toBe('recuperee');
    expect(mockCommande.recupereeAt).toBeInstanceOf(Date);
  });

  it('transition invalide payee → prete → 422', async () => {
    mockRequireAdmin.mockResolvedValueOnce(ADMIN_SESSION);
    const mockCommande = { _id: 'abc123', statut: 'payee', save: vi.fn() };
    mockCommandeModel.findOne.mockResolvedValueOnce(mockCommande);
    const res = await PATCH(makeReq({ statut: 'prete' }), params);
    expect(res.status).toBe(422);
  });

  it('transition invalide payee → recuperee → 422', async () => {
    mockRequireAdmin.mockResolvedValueOnce(ADMIN_SESSION);
    const mockCommande = { _id: 'abc123', statut: 'payee', save: vi.fn() };
    mockCommandeModel.findOne.mockResolvedValueOnce(mockCommande);
    const res = await PATCH(makeReq({ statut: 'recuperee' }), params);
    expect(res.status).toBe(422);
  });

  it('ID inexistant → 404', async () => {
    mockRequireAdmin.mockResolvedValueOnce(ADMIN_SESSION);
    mockCommandeModel.findOne.mockResolvedValueOnce(null);
    const res = await PATCH(makeReq({ statut: 'en_preparation' }), params);
    expect(res.status).toBe(404);
  });
});
