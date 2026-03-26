import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockSiteConfigModel } = vi.hoisted(() => ({
  mockSiteConfigModel: {
    findOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
  },
}));

vi.mock('@/lib/mongodb', () => ({ connectDB: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('@/models/SiteConfig', () => ({ default: mockSiteConfigModel }));

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
    mockSiteConfigModel.findOne.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue(null),
    });
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
    mockSiteConfigModel.findOne.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue({
        nomRestaurant: 'Le Bistrot',
        horaireOuverture: '12:00',
        horaireFermeture: '15:00',
        fermeeAujourdhui: true,
        updatedAt: new Date(),
      }),
    });
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.nomRestaurant).toBe('Le Bistrot');
    expect(json.data.horaireOuverture).toBe('12:00');
    expect(json.data.horaireFermeture).toBe('15:00');
    expect(json.data.fermeeAujourdhui).toBe(true);
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
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: {} } as NonNullable<Awaited<ReturnType<typeof getServerSession>>>);
    const res = await PUT(makeReq({ nomRestaurant: 'Test', banniereUrl: 'ftp://invalid.com' }));
    expect(res.status).toBe(400);
  });

  it('body valide → 200 + config upserted', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: {} } as NonNullable<Awaited<ReturnType<typeof getServerSession>>>);
    const updated = { nomRestaurant: 'Le Bistrot', horaireOuverture: '11:30', horaireFermeture: '14:00', fermeeAujourdhui: false, updatedAt: new Date() };
    mockSiteConfigModel.findOneAndUpdate.mockReturnValueOnce({
      lean: vi.fn().mockResolvedValue(updated),
    });
    const res = await PUT(makeReq({ nomRestaurant: 'Le Bistrot' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.nomRestaurant).toBe('Le Bistrot');
  });

  // TICK-100 — Horaires d'ouverture
  it('horaireOuverture format invalide → 400', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: {} } as NonNullable<Awaited<ReturnType<typeof getServerSession>>>);
    const res = await PUT(makeReq({ nomRestaurant: 'Test', horaireOuverture: '25:00', horaireFermeture: '14:00' }));
    expect(res.status).toBe(400);
  });

  it('fermeture <= ouverture → 400', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: {} } as NonNullable<Awaited<ReturnType<typeof getServerSession>>>);
    const res = await PUT(makeReq({ nomRestaurant: 'Test', horaireOuverture: '14:00', horaireFermeture: '12:00' }));
    expect(res.status).toBe(400);
  });

  it('horaires valides → 200', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: {} } as NonNullable<Awaited<ReturnType<typeof getServerSession>>>);
    const updated = { nomRestaurant: 'Test', horaireOuverture: '11:00', horaireFermeture: '14:00' };
    mockSiteConfigModel.findOneAndUpdate.mockReturnValueOnce({
      lean: vi.fn().mockResolvedValue(updated),
    });
    const res = await PUT(makeReq({ nomRestaurant: 'Test', horaireOuverture: '11:00', horaireFermeture: '14:00' }));
    expect(res.status).toBe(200);
  });

  // TICK-105 — fermeeAujourdhui
  it('fermeeAujourdhui: true → 200', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: {} } as NonNullable<Awaited<ReturnType<typeof getServerSession>>>);
    const updated = { nomRestaurant: 'Test', fermeeAujourdhui: true };
    mockSiteConfigModel.findOneAndUpdate.mockReturnValueOnce({
      lean: vi.fn().mockResolvedValue(updated),
    });
    const res = await PUT(makeReq({ nomRestaurant: 'Test', fermeeAujourdhui: true }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.fermeeAujourdhui).toBe(true);
  });

  it('banniereUrl avec chemin relatif (/images/...) → 200', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: {} } as NonNullable<Awaited<ReturnType<typeof getServerSession>>>);
    mockSiteConfigModel.findOneAndUpdate.mockReturnValueOnce({
      lean: vi.fn().mockResolvedValue({ nomRestaurant: 'Test' }),
    });
    const res = await PUT(makeReq({ nomRestaurant: 'Test', banniereUrl: '/images/banner.jpg' }));
    expect(res.status).toBe(200);
  });
});
