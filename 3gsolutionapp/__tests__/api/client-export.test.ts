// TICK-081 — Tests GET /api/client/export
// TICK-140 — nomRestaurant inclus par commande (populate — tous restaurants confondus)
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockLean, mockSort, mockPopulate, mockSelectCommandes, mockFindCommandes } = vi.hoisted(() => {
  const mockLean = vi.fn();
  const mockSort = vi.fn(() => ({ lean: mockLean }));
  const mockPopulate = vi.fn(() => ({ sort: mockSort }));
  const mockSelectCommandes = vi.fn(() => ({ populate: mockPopulate }));
  const mockFindCommandes = vi.fn(() => ({ select: mockSelectCommandes }));
  return { mockLean, mockSort, mockPopulate, mockSelectCommandes, mockFindCommandes };
});

const mockFindByIdSelect = vi.hoisted(() => vi.fn());
const mockFindByIdLean = vi.hoisted(() => vi.fn());

vi.mock('@/lib/mongodb', () => ({ connectDB: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('@/models/Client', () => ({
  default: {
    findById: vi.fn(() => ({
      select: mockFindByIdSelect,
    })),
  },
}));
vi.mock('@/models/Commande', () => ({
  default: { find: mockFindCommandes },
}));
// TICK-140 — Restaurant mocké pour enregistrement du modèle (utilisé par populate)
vi.mock('@/models/Restaurant', () => ({ default: {} }));

import { getServerSession } from 'next-auth';
import Client from '@/models/Client';
import { logger } from '@/lib/logger';
import { GET } from '@/app/api/client/export/route';

const clientSession = { user: { id: 'client123', role: 'client', email: 'test@test.com' } };

const fakeClient = {
  email: 'test@test.com',
  nom: 'Jean Test',
  provider: 'credentials',
  createdAt: new Date('2026-01-01').toISOString(),
};

// TICK-140 — commande avec restaurantId peuplé (populate retourne un objet)
const fakeCommande = {
  _id: 'cmd1',
  createdAt: new Date('2026-02-01').toISOString(),
  statut: 'prete',
  produits: [{ produitId: 'p1', nom: 'Burger', prix: 850, quantite: 1, options: [] }],
  total: 850,
  retrait: { type: 'immediat' },
  restaurantId: { nomRestaurant: 'Le Bon Burger' },
};

describe('GET /api/client/export', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindByIdSelect.mockReturnValue({ lean: mockFindByIdLean });
    mockFindByIdLean.mockResolvedValue(fakeClient);
    mockLean.mockResolvedValue([fakeCommande]);
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

  it('client introuvable → 404', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(clientSession);
    mockFindByIdLean.mockResolvedValueOnce(null);
    const res = await GET();
    expect(res.status).toBe(404);
  });

  it('succès → 200 avec Content-Disposition attachment', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(clientSession);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/json');
    expect(res.headers.get('Content-Disposition')).toContain('attachment');
    expect(res.headers.get('Content-Disposition')).toContain('mes-donnees-3g.json');
  });

  it('succès → payload contient exportDate, compte et commandes', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(clientSession);
    const res = await GET();
    const text = await res.text();
    const payload = JSON.parse(text);
    expect(payload.exportDate).toBeDefined();
    expect(payload.compte.email).toBe('test@test.com');
    expect(payload.compte.nom).toBe('Jean Test');
    expect(payload.commandes).toHaveLength(1);
    expect(payload.commandes[0].id).toBe('cmd1');
  });

  it('TICK-140 — nomRestaurant inclus dans chaque commande exportée', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(clientSession);
    const res = await GET();
    const payload = JSON.parse(await res.text());
    expect(payload.commandes[0].nomRestaurant).toBe('Le Bon Burger');
  });

  it('TICK-140 — nomRestaurant fallback "Restaurant inconnu" si populate échoue', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(clientSession);
    mockLean.mockResolvedValueOnce([{ ...fakeCommande, restaurantId: null }]);
    const res = await GET();
    const payload = JSON.parse(await res.text());
    expect(payload.commandes[0].nomRestaurant).toBe('Restaurant inconnu');
  });

  it('TICK-140 — Commande.find sans filtre restaurantId (tous restaurants confondus)', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(clientSession);
    mockLean.mockResolvedValueOnce([]);
    await GET();
    expect(mockFindCommandes).toHaveBeenCalledWith({ clientId: 'client123' });
  });

  it('TICK-140 — populate appelé avec restaurantId et nomRestaurant', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(clientSession);
    mockLean.mockResolvedValueOnce([]);
    await GET();
    expect(mockPopulate).toHaveBeenCalledWith('restaurantId', 'nomRestaurant');
  });

  it('log client_data_exported avec clientId', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(clientSession);
    await GET();
    expect(vi.mocked(logger.info)).toHaveBeenCalledWith(
      'client_data_exported',
      { clientId: 'client123' }
    );
  });

  it('Client.findById excluant les champs sensibles', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(clientSession);
    await GET();
    expect(mockFindByIdSelect).toHaveBeenCalledWith(
      expect.stringContaining('-passwordHash')
    );
    expect(mockFindByIdSelect).toHaveBeenCalledWith(
      expect.stringContaining('-emailVerifyToken')
    );
    expect(mockFindByIdSelect).toHaveBeenCalledWith(
      expect.stringContaining('-passwordResetToken')
    );
  });

  it('erreur DB → 500', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(clientSession);
    mockFindByIdLean.mockRejectedValueOnce(new Error('db error'));
    const res = await GET();
    expect(res.status).toBe(500);
  });
});
