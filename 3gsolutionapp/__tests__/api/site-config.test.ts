// TICK-135 — La route /api/site-config utilise maintenant Restaurant + lib/tenant (multi-tenant Sprint 18)
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockRestaurantModel, mockGetTenantRestaurant } = vi.hoisted(() => ({
  mockRestaurantModel: { findByIdAndUpdate: vi.fn() },
  mockGetTenantRestaurant: vi.fn(),
}));

vi.mock('@/lib/mongodb', () => ({ connectDB: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('@/models/Restaurant', () => ({ default: mockRestaurantModel }));
vi.mock('@/lib/tenant', () => ({
  getTenantId: vi.fn().mockResolvedValue('restaurant_test_id'),
  getTenantRestaurant: mockGetTenantRestaurant,
}));
// generatePalette est une fonction pure — on la mock pour éviter des dépendances internes
vi.mock('@/lib/palette', () => ({
  generatePalette: vi.fn().mockReturnValue({ primary: '#E63946', light: '#f5c6ca' }),
}));

import { getServerSession } from 'next-auth';
import { GET, PUT } from '@/app/api/site-config/route';

const makeReq = (body: unknown) =>
  new NextRequest('http://localhost/api/site-config', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('GET /api/site-config', () => {
  beforeEach(() => vi.clearAllMocks());

  it('aucun document en base → retourne valeurs par défaut', async () => {
    mockGetTenantRestaurant.mockResolvedValueOnce(null);
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.nomRestaurant).toBe('Mon Restaurant');
    // TICK-100 — valeurs par défaut horaires
    expect(json.data.horaireOuverture).toBe('11:30');
    expect(json.data.horaireFermeture).toBe('14:00');
    // TICK-105
    expect(json.data.fermeeAujourdhui).toBe(false);
  });

  it('document existant → retourne la config avec horaires', async () => {
    mockGetTenantRestaurant.mockResolvedValueOnce({
      nom: 'Le Bistrot',
      horaireOuverture: '12:00',
      horaireFermeture: '15:00',
      fermeeAujourdhui: true,
      couleurPrimaire: '#E63946',
    });
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.nomRestaurant).toBe('Le Bistrot');
    expect(json.data.horaireOuverture).toBe('12:00');
    expect(json.data.horaireFermeture).toBe('15:00');
    expect(json.data.fermeeAujourdhui).toBe(true);
  });

  it('document ancien sans horaires → merge defaults HH:MM', async () => {
    mockGetTenantRestaurant.mockResolvedValueOnce({
      nom: 'Ancien Restaurant',
      fermeeAujourdhui: false,
      // horaireOuverture et horaireFermeture absents (vieux document)
    });
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.nomRestaurant).toBe('Ancien Restaurant');
    expect(json.data.horaireOuverture).toBe('11:30');
    expect(json.data.horaireFermeture).toBe('14:00');
  });
});

describe('PUT /api/site-config', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sans session → 401', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(null);
    const res = await PUT(makeReq({ nomRestaurant: 'Test' }));
    expect(res.status).toBe(401);
  });

  it('banniereUrl invalide (ni https ni /) → 400', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { role: 'admin' } } as NonNullable<Awaited<ReturnType<typeof getServerSession>>>);
    const res = await PUT(makeReq({ nomRestaurant: 'Test', banniereUrl: 'ftp://invalid.com' }));
    expect(res.status).toBe(400);
  });

  it('body valide → 200 + restaurant mis à jour', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { role: 'admin' } } as NonNullable<Awaited<ReturnType<typeof getServerSession>>>);
    const updated = { nom: 'Le Bistrot', horaireOuverture: '11:30', horaireFermeture: '14:00', fermeeAujourdhui: false };
    mockRestaurantModel.findByIdAndUpdate.mockReturnValueOnce({
      lean: vi.fn().mockResolvedValue(updated),
    });
    const res = await PUT(makeReq({ nomRestaurant: 'Le Bistrot' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    // La route retourne le document Restaurant brut — champ `nom` (pas `nomRestaurant`)
    expect(json.data.nom).toBe('Le Bistrot');
  });

  // TICK-100 — Horaires d'ouverture
  it('horaireOuverture format invalide → 400', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { role: 'admin' } } as NonNullable<Awaited<ReturnType<typeof getServerSession>>>);
    const res = await PUT(makeReq({ nomRestaurant: 'Test', horaireOuverture: '25:00', horaireFermeture: '14:00' }));
    expect(res.status).toBe(400);
  });

  it('fermeture <= ouverture → 400', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { role: 'admin' } } as NonNullable<Awaited<ReturnType<typeof getServerSession>>>);
    const res = await PUT(makeReq({ nomRestaurant: 'Test', horaireOuverture: '14:00', horaireFermeture: '12:00' }));
    expect(res.status).toBe(400);
  });

  it('horaires valides → 200', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { role: 'admin' } } as NonNullable<Awaited<ReturnType<typeof getServerSession>>>);
    const updated = { nom: 'Test', horaireOuverture: '11:00', horaireFermeture: '14:00' };
    mockRestaurantModel.findByIdAndUpdate.mockReturnValueOnce({
      lean: vi.fn().mockResolvedValue(updated),
    });
    const res = await PUT(makeReq({ nomRestaurant: 'Test', horaireOuverture: '11:00', horaireFermeture: '14:00' }));
    expect(res.status).toBe(200);
  });

  // TICK-105 — fermeeAujourdhui
  it('fermeeAujourdhui: true → 200', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { role: 'admin' } } as NonNullable<Awaited<ReturnType<typeof getServerSession>>>);
    const updated = { nom: 'Test', fermeeAujourdhui: true };
    mockRestaurantModel.findByIdAndUpdate.mockReturnValueOnce({
      lean: vi.fn().mockResolvedValue(updated),
    });
    const res = await PUT(makeReq({ nomRestaurant: 'Test', fermeeAujourdhui: true }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.fermeeAujourdhui).toBe(true);
  });

  // Toggle fermeeAujourdhui sans les autres champs (mise à jour partielle)
  it('fermeeAujourdhui seul (sans nomRestaurant) → 200 update partiel', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { role: 'admin' } } as NonNullable<Awaited<ReturnType<typeof getServerSession>>>);
    const updated = { nom: 'Existant', fermeeAujourdhui: false };
    mockRestaurantModel.findByIdAndUpdate.mockReturnValueOnce({
      lean: vi.fn().mockResolvedValue(updated),
    });
    const res = await PUT(makeReq({ fermeeAujourdhui: false }));
    expect(res.status).toBe(200);
  });

  it('banniereUrl avec chemin relatif (/images/...) → 200', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { role: 'admin' } } as NonNullable<Awaited<ReturnType<typeof getServerSession>>>);
    mockRestaurantModel.findByIdAndUpdate.mockReturnValueOnce({
      lean: vi.fn().mockResolvedValue({ nom: 'Test', banniere: '/images/banner.jpg' }),
    });
    const res = await PUT(makeReq({ nomRestaurant: 'Test', banniereUrl: '/images/banner.jpg' }));
    expect(res.status).toBe(200);
  });
});
