import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockChain } = vi.hoisted(() => {
  const chain = {
    sort: vi.fn().mockReturnThis(),
    lean: vi.fn().mockResolvedValue([]),
  };
  return { mockChain: chain };
});

vi.mock('@/lib/mongodb', () => ({ connectDB: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('@/models/Commande', () => ({
  default: { find: vi.fn().mockReturnValue(mockChain) },
}));
// TICK-134 — getTenantId utilisé par la route admin (multi-tenant)
vi.mock('@/lib/tenant', () => ({ getTenantId: vi.fn().mockResolvedValue('restaurant_test_id') }));

import { getServerSession } from 'next-auth';
import { GET } from '@/app/api/commandes/route';

const mockCommandes = [
  { _id: '1', statut: 'payee', client: { nom: 'Jean' }, total: 850, createdAt: new Date() },
];

describe('GET /api/commandes (admin)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sans session → 401', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('avec session → 200 + liste des commandes', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { role: 'admin' } } as NonNullable<Awaited<ReturnType<typeof getServerSession>>>);
    mockChain.lean.mockResolvedValueOnce(mockCommandes);
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toHaveLength(1);
  });
});
