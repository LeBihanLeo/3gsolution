// TICK-135 — Tests GET/PUT /api/site-config (migré vers Restaurant multi-tenant)
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';

const FAKE_TENANT_ID = new mongoose.Types.ObjectId('aaaaaaaaaaaaaaaaaaaaaaaa');

const { mockRestaurantModel, mockRequireAdmin, mockGetTenantId } = vi.hoisted(() => ({
  mockRestaurantModel: {
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn(),
  },
  mockRequireAdmin: vi.fn(),
  mockGetTenantId: vi.fn(),
}));

vi.mock('@/lib/mongodb', () => ({ connectDB: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('@/models/Restaurant', () => ({ default: mockRestaurantModel }));
vi.mock('@/lib/assertAdmin', () => ({ requireAdmin: mockRequireAdmin }));
vi.mock('@/lib/tenant', () => ({ getTenantId: mockGetTenantId, resolveTenantForAdmin: mockGetTenantId }));
vi.mock('@/lib/palette', () => ({ generatePalette: vi.fn().mockReturnValue({ primary: '#E63946' }) }));

import { GET, PUT } from '@/app/api/site-config/route';

const ADMIN_SESSION = { session: { user: { id: FAKE_TENANT_ID.toString(), role: 'admin' } }, error: null };
const NO_AUTH = { session: null, error: NextResponse.json({ error: 'Non autorisé.' }, { status: 401 }) };

const makeReq = (body: unknown) =>
  new NextRequest('http://localhost/api/site-config', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('GET /api/site-config', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTenantId.mockResolvedValue(FAKE_TENANT_ID);
  });

  it('aucun document en base → retourne valeurs par défaut', async () => {
    mockRestaurantModel.findById.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue(null),
    });
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.nomRestaurant).toBe('Mon Restaurant');
    expect(json.data.horaireOuverture).toBe('11:30');
    expect(json.data.horaireFermeture).toBe('14:00');
    expect(json.data.fermeeAujourdhui).toBe(false);
  });

  it('document Restaurant existant → retourne la config avec horaires', async () => {
    mockRestaurantModel.findById.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue({
        nomRestaurant: 'Le Bistrot',
        horaireOuverture: '12:00',
        horaireFermeture: '15:00',
        fermeeAujourdhui: true,
        couleurPrincipale: '#E63946',
        stripePublishableKey: 'pk_test_abc',
      }),
    });
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.nomRestaurant).toBe('Le Bistrot');
    expect(json.data.horaireOuverture).toBe('12:00');
    expect(json.data.horaireFermeture).toBe('15:00');
    expect(json.data.fermeeAujourdhui).toBe(true);
    // TICK-135 — stripePublishableKey inclus dans la réponse publique
    expect(json.data.stripePublishableKey).toBe('pk_test_abc');
  });

  it('stripeSecretKey absent de la réponse (projection)', async () => {
    mockRestaurantModel.findById.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue({ nomRestaurant: 'Test', couleurPrincipale: '#E63946' }),
    });
    const res = await GET();
    const json = await res.json();
    expect(json.data.stripeSecretKey).toBeUndefined();
    expect(json.data.stripeWebhookSecret).toBeUndefined();
  });
});

describe('PUT /api/site-config', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTenantId.mockResolvedValue(FAKE_TENANT_ID);
  });

  it('sans session → 401', async () => {
    mockRequireAdmin.mockResolvedValueOnce(NO_AUTH);
    const res = await PUT(makeReq({ nomRestaurant: 'Test' }));
    expect(res.status).toBe(401);
  });

  it('banniereUrl invalide (ni https ni /) → 400', async () => {
    mockRequireAdmin.mockResolvedValueOnce(ADMIN_SESSION);
    const res = await PUT(makeReq({ nomRestaurant: 'Test', banniereUrl: 'ftp://invalid.com' }));
    expect(res.status).toBe(400);
  });

  it('body valide → 200 + restaurant mis à jour', async () => {
    mockRequireAdmin.mockResolvedValueOnce(ADMIN_SESSION);
    const updated = { nomRestaurant: 'Le Bistrot', horaireOuverture: '11:30', horaireFermeture: '14:00', fermeeAujourdhui: false };
    mockRestaurantModel.findByIdAndUpdate.mockReturnValueOnce({
      lean: vi.fn().mockResolvedValue(updated),
    });
    const res = await PUT(makeReq({ nomRestaurant: 'Le Bistrot' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.nomRestaurant).toBe('Le Bistrot');
    // TICK-135 — findByIdAndUpdate appelé avec le restaurantId du tenant
    expect(mockRestaurantModel.findByIdAndUpdate).toHaveBeenCalledWith(
      FAKE_TENANT_ID,
      expect.anything(),
      expect.anything()
    );
  });

  it('horaireOuverture format invalide → 400', async () => {
    mockRequireAdmin.mockResolvedValueOnce(ADMIN_SESSION);
    const res = await PUT(makeReq({ nomRestaurant: 'Test', horaireOuverture: '25:00', horaireFermeture: '14:00' }));
    expect(res.status).toBe(400);
  });

  it('fermeture <= ouverture → 400', async () => {
    mockRequireAdmin.mockResolvedValueOnce(ADMIN_SESSION);
    const res = await PUT(makeReq({ nomRestaurant: 'Test', horaireOuverture: '14:00', horaireFermeture: '12:00' }));
    expect(res.status).toBe(400);
  });

  it('horaires valides → 200', async () => {
    mockRequireAdmin.mockResolvedValueOnce(ADMIN_SESSION);
    const updated = { nomRestaurant: 'Test', horaireOuverture: '11:00', horaireFermeture: '14:00' };
    mockRestaurantModel.findByIdAndUpdate.mockReturnValueOnce({ lean: vi.fn().mockResolvedValue(updated) });
    const res = await PUT(makeReq({ nomRestaurant: 'Test', horaireOuverture: '11:00', horaireFermeture: '14:00' }));
    expect(res.status).toBe(200);
  });

  it('fermeeAujourdhui: true → 200', async () => {
    mockRequireAdmin.mockResolvedValueOnce(ADMIN_SESSION);
    const updated = { nomRestaurant: 'Test', fermeeAujourdhui: true };
    mockRestaurantModel.findByIdAndUpdate.mockReturnValueOnce({ lean: vi.fn().mockResolvedValue(updated) });
    const res = await PUT(makeReq({ nomRestaurant: 'Test', fermeeAujourdhui: true }));
    expect(res.status).toBe(200);
    expect((await res.json()).data.fermeeAujourdhui).toBe(true);
  });

  it('fermeeAujourdhui seul → 200 update partiel', async () => {
    mockRequireAdmin.mockResolvedValueOnce(ADMIN_SESSION);
    const updated = { nomRestaurant: 'Existant', fermeeAujourdhui: false };
    mockRestaurantModel.findByIdAndUpdate.mockReturnValueOnce({ lean: vi.fn().mockResolvedValue(updated) });
    const res = await PUT(makeReq({ fermeeAujourdhui: false }));
    expect(res.status).toBe(200);
  });

  it('banniereUrl avec chemin relatif (/images/...) → 200', async () => {
    mockRequireAdmin.mockResolvedValueOnce(ADMIN_SESSION);
    mockRestaurantModel.findByIdAndUpdate.mockReturnValueOnce({ lean: vi.fn().mockResolvedValue({ nomRestaurant: 'Test' }) });
    const res = await PUT(makeReq({ nomRestaurant: 'Test', banniereUrl: '/images/banner.jpg' }));
    expect(res.status).toBe(200);
  });
});
