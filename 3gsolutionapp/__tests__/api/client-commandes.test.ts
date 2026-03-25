// TICK-076 — Tests GET /api/client/commandes
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockFind, mockSort, mockLimit, mockLean } = vi.hoisted(() => {
  const mockLean = vi.fn();
  const mockLimit = vi.fn(() => ({ lean: mockLean }));
  const mockSort = vi.fn(() => ({ limit: mockLimit }));
  const mockFind = vi.fn(() => ({ sort: mockSort }));
  return { mockFind, mockSort, mockLimit, mockLean };
});

vi.mock('@/lib/mongodb', () => ({ connectDB: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('@/models/Commande', () => ({
  default: { find: mockFind },
}));

import { getServerSession } from 'next-auth';
import { GET } from '@/app/api/client/commandes/route';

const clientSession = { user: { id: 'client123', role: 'client', email: 'test@test.com' } };

const commandePayee = {
  _id: 'cmd1',
  statut: 'payee',
  produits: [{ nom: 'Burger', quantite: 1, prix: 850, options: [] }],
  total: 850,
  retrait: { type: 'immediat' },
  createdAt: new Date().toISOString(),
};

const commandePrete = {
  _id: 'cmd2',
  statut: 'prete',
  produits: [{ nom: 'Frites', quantite: 2, prix: 350, options: [] }],
  total: 700,
  retrait: { type: 'immediat' },
  createdAt: new Date().toISOString(),
};

describe('GET /api/client/commandes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLean.mockResolvedValue([]);
  });

  it('sans session → 401', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('rôle admin → 401', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { id: '1', role: 'admin' } });
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('aucune commande → { enCours: [], passees: [] }', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(clientSession);
    mockLean.mockResolvedValueOnce([]);
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.enCours).toEqual([]);
    expect(data.passees).toEqual([]);
  });

  it('sépare correctement enCours et passees', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(clientSession);
    mockLean.mockResolvedValueOnce([commandePayee, commandePrete]);
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.enCours).toHaveLength(1);
    expect(data.enCours[0]._id).toBe('cmd1');
    expect(data.passees).toHaveLength(1);
    expect(data.passees[0]._id).toBe('cmd2');
  });

  it('projection exclut client.telephone et client.email (vérification de la projection)', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(clientSession);
    mockLean.mockResolvedValueOnce([]);
    await GET();
    // La projection passée à find() ne doit pas inclure client.telephone ni client.email
    const projection = mockFind.mock.calls[0][1] as Record<string, unknown>;
    expect(projection['client.telephone']).toBeUndefined();
    expect(projection['client.email']).toBeUndefined();
    // Les champs autorisés sont présents
    expect(projection._id).toBe(1);
    expect(projection.statut).toBe(1);
    expect(projection.total).toBe(1);
  });

  it('requête Commande.find avec clientId', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(clientSession);
    mockLean.mockResolvedValueOnce([]);
    await GET();
    expect(mockFind).toHaveBeenCalledWith(
      { clientId: 'client123' },
      expect.objectContaining({ _id: 1, statut: 1 })
    );
  });
});
