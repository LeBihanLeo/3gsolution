// TICK-106 — Tests GET /api/admin/commandes/export
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';

const FAKE_TENANT_ID = new mongoose.Types.ObjectId('aaaaaaaaaaaaaaaaaaaaaaaa');

const { mockCommandeFind, mockLogger, mockRequireAdmin, mockGetTenantId } = vi.hoisted(() => ({
  mockCommandeFind: vi.fn(),
  mockLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
  mockRequireAdmin: vi.fn(),
  mockGetTenantId: vi.fn(),
}));

vi.mock('@/lib/mongodb', () => ({ connectDB: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('@/models/Commande', () => ({ default: { find: mockCommandeFind } }));
vi.mock('@/lib/logger', () => ({ logger: mockLogger }));
vi.mock('@/lib/assertAdmin', () => ({ requireAdmin: mockRequireAdmin }));
vi.mock('@/lib/tenant', () => ({ getTenantId: mockGetTenantId, resolveTenantForAdmin: mockGetTenantId }));

import { GET } from '@/app/api/admin/commandes/export/route';

const ADMIN_SESSION = { session: { user: { role: 'admin', email: 'admin@test.fr' } }, error: null };
const NO_AUTH = { session: null, error: NextResponse.json({ error: 'Non autorisé.' }, { status: 401 }) };

const mockCommande = {
  _id: { toString: () => 'abc123def456' },
  statut: 'recuperee',
  client: { nom: 'Jean Dupont', telephone: '0612345678', email: 'jean@test.fr' },
  retrait: { type: 'creneau', creneau: '12:30 – 12:45' },
  produits: [
    { nom: 'Burger', prix: 800, quantite: 1, taux_tva: 10, options: [] },
    { nom: 'Frites', prix: 300, quantite: 2, taux_tva: 10, options: [{ nom: 'Sel', prix: 0 }] },
  ],
  total: 1400,
  createdAt: new Date('2026-03-26T10:34:00.000Z'),
};

function makeReq(params = '') {
  return new NextRequest(`http://localhost/api/admin/commandes/export${params}`);
}

describe('GET /api/admin/commandes/export', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTenantId.mockResolvedValue(FAKE_TENANT_ID);
  });

  it('sans session → 401', async () => {
    mockRequireAdmin.mockResolvedValueOnce(NO_AUTH);
    const res = await GET(makeReq());
    expect(res.status).toBe(401);
  });

  it('date invalide → 400', async () => {
    mockRequireAdmin.mockResolvedValueOnce(ADMIN_SESSION);
    const res = await GET(makeReq('?from=invalid&to=also-invalid'));
    expect(res.status).toBe(400);
  });

  it('aucune commande → CSV avec seulement l\'en-tête', async () => {
    mockRequireAdmin.mockResolvedValueOnce(ADMIN_SESSION);
    mockCommandeFind.mockReturnValueOnce({
      sort: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([]),
    });
    const res = await GET(makeReq('?from=2026-03-26&to=2026-03-26'));
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/csv');
    const text = await res.text();
    expect(text).toContain('Date;Heure;Numéro;Client');
    const lines = text.split('\n').filter(Boolean);
    expect(lines).toHaveLength(1);
  });

  it('commandes existantes → CSV avec BOM + données', async () => {
    mockRequireAdmin.mockResolvedValueOnce(ADMIN_SESSION);
    mockCommandeFind.mockReturnValueOnce({
      sort: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([mockCommande]),
    });
    const res = await GET(makeReq('?from=2026-03-26&to=2026-03-26'));
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('Date;Heure;Numéro;Client');
    expect(text).toContain('Jean Dupont');
    expect(text).toContain('#DEF456');
    expect(text).toContain('1,27 €');
    expect(text).toContain('14,00 €');
  });

  it('Content-Disposition contient le nom de fichier avec les dates', async () => {
    mockRequireAdmin.mockResolvedValueOnce(ADMIN_SESSION);
    mockCommandeFind.mockReturnValueOnce({
      sort: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([]),
    });
    const res = await GET(makeReq('?from=2026-03-01&to=2026-03-31'));
    const disposition = res.headers.get('Content-Disposition') ?? '';
    expect(disposition).toContain('commandes-2026-03-01-2026-03-31.csv');
  });

  it('log commandes_exported_csv appelé avec les bons paramètres', async () => {
    mockRequireAdmin.mockResolvedValueOnce(ADMIN_SESSION);
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

  it('CSV contient les colonnes TVA appliquée, Total HT, Total TVA', async () => {
    mockRequireAdmin.mockResolvedValueOnce(ADMIN_SESSION);
    mockCommandeFind.mockReturnValueOnce({
      sort: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([mockCommande]),
    });
    const text = await (await GET(makeReq('?from=2026-03-26&to=2026-03-26'))).text();
    expect(text).toContain('TVA appliquée');
    expect(text).toContain('Total HT (€)');
    expect(text).toContain('Total TVA (€)');
  });

  it('TVA 10% taux unique → colonne "TVA appliquée" = "10 %"', async () => {
    mockRequireAdmin.mockResolvedValueOnce(ADMIN_SESSION);
    mockCommandeFind.mockReturnValueOnce({
      sort: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([mockCommande]),
    });
    expect(await (await GET(makeReq('?from=2026-03-26&to=2026-03-26'))).text()).toContain('10 %');
  });

  it('commande mixte (10% + 20%) → colonne "TVA appliquée" = "10 % / 20 %"', async () => {
    const commandeMixte = {
      ...mockCommande,
      produits: [
        { nom: 'Burger', prix: 1100, quantite: 1, taux_tva: 10, options: [] },
        { nom: 'Bière', prix: 500, quantite: 1, taux_tva: 20, options: [] },
      ],
      total: 1600,
    };
    mockRequireAdmin.mockResolvedValueOnce(ADMIN_SESSION);
    mockCommandeFind.mockReturnValueOnce({
      sort: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([commandeMixte]),
    });
    expect(await (await GET(makeReq('?from=2026-03-26&to=2026-03-26'))).text()).toContain('10 % / 20 %');
  });

  it('produit avec taux_tva=0 → Total HT = Total TTC, Total TVA = 0,00', async () => {
    const commandeExo = {
      ...mockCommande,
      produits: [{ nom: 'Eau', prix: 100, quantite: 1, taux_tva: 0, options: [] }],
      total: 100,
    };
    mockRequireAdmin.mockResolvedValueOnce(ADMIN_SESSION);
    mockCommandeFind.mockReturnValueOnce({
      sort: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([commandeExo]),
    });
    const text = await (await GET(makeReq('?from=2026-03-26&to=2026-03-26'))).text();
    expect(text).toContain('1,00');
    expect(text).toContain('0,00');
  });
});
