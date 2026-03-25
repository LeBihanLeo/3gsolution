import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockFindByIdAndUpdate, mockDeleteOne, mockUpdateMany } = vi.hoisted(() => ({
  mockFindByIdAndUpdate: vi.fn(),
  mockDeleteOne: vi.fn().mockResolvedValue({}),
  mockUpdateMany: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/lib/mongodb', () => ({ connectDB: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('@/models/Client', () => ({
  default: { findByIdAndUpdate: mockFindByIdAndUpdate, deleteOne: mockDeleteOne },
}));
vi.mock('@/models/Commande', () => ({
  default: { updateMany: mockUpdateMany },
}));

import { getServerSession } from 'next-auth';
import { PATCH } from '@/app/api/client/profil/route';
import { DELETE } from '@/app/api/client/account/route';

const clientSession = { user: { id: 'client123', role: 'client', email: 'test@test.com' } };

describe('PATCH /api/client/profil', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sans session → 401', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(null);
    const req = new NextRequest('http://localhost/api/client/profil', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nom: 'Jean' }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(401);
  });

  it('rôle admin → 401', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { id: '1', role: 'admin' } });
    const req = new NextRequest('http://localhost/api/client/profil', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nom: 'Admin' }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(401);
  });

  it('nom vide → 400', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(clientSession);
    const req = new NextRequest('http://localhost/api/client/profil', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nom: '' }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
  });

  it('nom valide → 200, ne retourne pas passwordHash', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(clientSession);
    mockFindByIdAndUpdate.mockResolvedValueOnce({ _id: 'client123', nom: 'Jean', email: 'test@test.com' });
    const req = new NextRequest('http://localhost/api/client/profil', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nom: 'Jean' }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.client.nom).toBe('Jean');
    expect(data.client).not.toHaveProperty('passwordHash');
  });
});

describe('DELETE /api/client/account', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sans session → 401', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(null);
    const res = await DELETE();
    expect(res.status).toBe(401);
  });

  it('rôle admin → 401', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { id: '1', role: 'admin' } });
    const res = await DELETE();
    expect(res.status).toBe(401);
  });

  it('client → anonymise commandes + supprime compte', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(clientSession);
    const res = await DELETE();
    expect(res.status).toBe(200);
    expect(mockUpdateMany).toHaveBeenCalledWith(
      { clientId: 'client123' },
      expect.objectContaining({
        $set: expect.objectContaining({ 'client.nom': '[Supprimé]' }),
      })
    );
    expect(mockDeleteOne).toHaveBeenCalledWith({ _id: 'client123' });
  });
});
