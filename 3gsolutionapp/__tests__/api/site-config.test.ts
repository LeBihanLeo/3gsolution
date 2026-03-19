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
  });

  it('document existant → retourne la config', async () => {
    mockSiteConfigModel.findOne.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue({ nomRestaurant: 'Le Bistrot', updatedAt: new Date() }),
    });
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.nomRestaurant).toBe('Le Bistrot');
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
    const updated = { nomRestaurant: 'Le Bistrot', updatedAt: new Date() };
    mockSiteConfigModel.findOneAndUpdate.mockReturnValueOnce({
      lean: vi.fn().mockResolvedValue(updated),
    });
    const res = await PUT(makeReq({ nomRestaurant: 'Le Bistrot' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.nomRestaurant).toBe('Le Bistrot');
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
