import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';
import mongoose from 'mongoose';

const FAKE_TENANT_ID = new mongoose.Types.ObjectId('aaaaaaaaaaaaaaaaaaaaaaaa');

const { mockChain, mockRequireAdmin, mockGetTenantId } = vi.hoisted(() => {
  const chain = {
    sort: vi.fn().mockReturnThis(),
    lean: vi.fn().mockResolvedValue([]),
  };
  return {
    mockChain: chain,
    mockRequireAdmin: vi.fn(),
    mockGetTenantId: vi.fn(),
  };
});

vi.mock('@/lib/mongodb', () => ({ connectDB: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('@/lib/assertAdmin', () => ({ requireAdmin: mockRequireAdmin }));
vi.mock('@/lib/tenant', () => ({ getTenantId: mockGetTenantId, resolveTenantForAdmin: mockGetTenantId }));
vi.mock('@/models/Commande', () => ({
  default: { find: vi.fn().mockReturnValue(mockChain) },
}));

import { GET } from '@/app/api/commandes/route';

const ADMIN_SESSION = { session: { user: { role: 'admin' } }, error: null };
const NO_AUTH = { session: null, error: NextResponse.json({ error: 'Non autorisé.' }, { status: 401 }) };

const mockCommandes = [
  { _id: '1', statut: 'payee', client: { nom: 'Jean' }, total: 850, createdAt: new Date() },
];

describe('GET /api/commandes (admin)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTenantId.mockResolvedValue(FAKE_TENANT_ID);
  });

  it('sans session → 401', async () => {
    mockRequireAdmin.mockResolvedValueOnce(NO_AUTH);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('avec session admin → 200 + liste des commandes scopées par tenant', async () => {
    mockRequireAdmin.mockResolvedValueOnce(ADMIN_SESSION);
    mockChain.lean.mockResolvedValueOnce(mockCommandes);
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toHaveLength(1);
  });
});
