import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockCommandeModel } = vi.hoisted(() => ({
  mockCommandeModel: { findByIdAndUpdate: vi.fn() },
}));

vi.mock('@/lib/mongodb', () => ({ connectDB: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('@/models/Commande', () => ({ default: mockCommandeModel }));

import { getServerSession } from 'next-auth';
import { PATCH } from '@/app/api/commandes/[id]/statut/route';

const makeReq = (body: unknown) =>
  new NextRequest('http://localhost/api/commandes/abc/statut', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

const params = { params: Promise.resolve({ id: 'abc123' }) };

describe('PATCH /api/commandes/[id]/statut', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sans session → 401', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(null);
    const res = await PATCH(makeReq({ statut: 'prete' }), params);
    expect(res.status).toBe(401);
  });

  it('body { statut: "prete" } valide → 200 + commande mise à jour', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: {} } as NonNullable<Awaited<ReturnType<typeof getServerSession>>>);
    mockCommandeModel.findByIdAndUpdate.mockResolvedValueOnce({ _id: 'abc123', statut: 'prete' });
    const res = await PATCH(makeReq({ statut: 'prete' }), params);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.statut).toBe('prete');
  });

  it('body { statut: "payee" } → 400', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: {} } as NonNullable<Awaited<ReturnType<typeof getServerSession>>>);
    const res = await PATCH(makeReq({ statut: 'payee' }), params);
    expect(res.status).toBe(400);
  });

  it('ID inexistant → 404', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: {} } as NonNullable<Awaited<ReturnType<typeof getServerSession>>>);
    mockCommandeModel.findByIdAndUpdate.mockResolvedValueOnce(null);
    const res = await PATCH(makeReq({ statut: 'prete' }), params);
    expect(res.status).toBe(404);
  });
});
