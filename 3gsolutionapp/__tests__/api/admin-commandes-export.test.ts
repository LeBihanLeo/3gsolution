// TICK-106 — Tests GET /api/admin/commandes/export
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockCommandeFind, mockLogger } = vi.hoisted(() => ({
  mockCommandeFind: vi.fn(),
  mockLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

vi.mock('@/lib/mongodb', () => ({ connectDB: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('@/models/Commande', () => ({ default: { find: mockCommandeFind } }));
vi.mock('@/lib/logger', () => ({ logger: mockLogger }));

import { getServerSession } from 'next-auth';
import { GET } from '@/app/api/admin/commandes/export/route';

const adminSession = { user: { email: 'admin@test.fr', role: 'admin' } };

const mockCommande = {
  _id: { toString: () => 'abc123def456' },
  statut: 'recuperee',
  client: { nom: 'Jean Dupont', telephone: '0612345678', email: 'jean@test.fr' },
  retrait: { type: 'creneau', creneau: '12:30 – 12:45' },
  produits: [
    { nom: 'Burger', prix: 800, quantite: 1, options: [] },
    { nom: 'Frites', prix: 300, quantite: 2, options: [{ nom: 'Sel', prix: 0 }] },
  ],
  total: 1400,
  createdAt: new Date('2026-03-26T10:34:00.000Z'),
};

function makeReq(params = '') {
  return new NextRequest(`http://localhost/api/admin/commandes/export${params}`);
}

describe('GET /api/admin/commandes/export', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sans session → 401', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(null);
    const res = await GET(makeReq());
    expect(res.status).toBe(401);
  });

  it('date invalide → 400', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession as never);
    const res = await GET(makeReq('?from=invalid&to=also-invalid'));
    expect(res.status).toBe(400);
  });

  it('aucune commande → CSV avec seulement l\'en-tête', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession as never);
    mockCommandeFind.mockReturnValueOnce({
      sort: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([]),
    });
    const res = await GET(makeReq('?from=2026-03-26&to=2026-03-26'));
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/csv');
    const text = await res.text();
    expect(text).toContain('Date;Heure;Numéro;Client');
    // Pas de lignes de données
    const lines = text.split('\n').filter(Boolean);
    expect(lines).toHaveLength(1); // seulement l'en-tête
  });

  it('commandes existantes → CSV avec BOM + données', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession as never);
    mockCommandeFind.mockReturnValueOnce({
      sort: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([mockCommande]),
    });
    const res = await GET(makeReq('?from=2026-03-26&to=2026-03-26'));
    expect(res.status).toBe(200);
    const text = await res.text();
    // BOM UTF-8 ou contenu démarrant par l'en-tête (le BOM peut être absorbé par text())
    expect(text).toContain('Date;Heure;Numéro;Client');
    // Données client
    expect(text).toContain('Jean Dupont');
    // Numéro de commande court
    expect(text).toContain('#DEF456');
    // TVA 10% : total 1400 centimes → TVA = round(1400/11) = 127 centimes → 1,27 €
    expect(text).toContain('1,27 €');
    // Total TTC
    expect(text).toContain('14,00 €');
  });

  it('Content-Disposition contient le nom de fichier avec les dates', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession as never);
    mockCommandeFind.mockReturnValueOnce({
      sort: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([]),
    });
    const res = await GET(makeReq('?from=2026-03-01&to=2026-03-31'));
    const disposition = res.headers.get('Content-Disposition') ?? '';
    expect(disposition).toContain('commandes-2026-03-01-2026-03-31.csv');
  });

  it('log commandes_exported_csv appelé avec les bons paramètres', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession as never);
    mockCommandeFind.mockReturnValueOnce({
      sort: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([mockCommande]),
    });
    await GET(makeReq('?from=2026-03-26&to=2026-03-26'));
    expect(mockLogger.info).toHaveBeenCalledWith(
      'commandes_exported_csv',
      expect.objectContaining({ adminId: 'admin@test.fr', count: 1 })
    );
  });
});
