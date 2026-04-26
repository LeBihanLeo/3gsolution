// TICK-189/190 — Tests API /api/admin/onboarding (GET + PATCH)
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Mocks hoisted ──────────────────────────────────────────────────────────────

const { mockRestaurantModel, mockGetServerSession } = vi.hoisted(() => ({
  mockRestaurantModel: {
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn(),
  },
  mockGetServerSession: vi.fn(),
}));

vi.mock('@/lib/mongodb', () => ({ connectDB: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.mock('next-auth', () => ({ getServerSession: mockGetServerSession }));
vi.mock('@/models/Restaurant', () => ({ default: mockRestaurantModel }));

import { GET, PATCH } from '@/app/api/admin/onboarding/route';

// ── Helpers ───────────────────────────────────────────────────────────────────

const RESTAURANT_ID = 'rest_abc123';

function adminSession(restaurantId = RESTAURANT_ID) {
  return { user: { role: 'admin', restaurantId } };
}

function makeReq(body: unknown, method = 'PATCH') {
  return new NextRequest('http://localhost/api/admin/onboarding', {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ── GET ────────────────────────────────────────────────────────────────────────

describe('GET /api/admin/onboarding', () => {
  beforeEach(() => vi.clearAllMocks());

  it('403 si non connecté', async () => {
    mockGetServerSession.mockResolvedValueOnce(null);
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it('403 si rôle client', async () => {
    mockGetServerSession.mockResolvedValueOnce({ user: { role: 'client', restaurantId: RESTAURANT_ID } });
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it('404 si restaurant introuvable', async () => {
    mockGetServerSession.mockResolvedValueOnce(adminSession());
    mockRestaurantModel.findById.mockReturnValueOnce({ select: vi.fn().mockReturnThis(), lean: vi.fn().mockResolvedValueOnce(null) });
    const res = await GET();
    expect(res.status).toBe(404);
  });

  it('retourne onboardingCompleted=false et steps=[] par défaut', async () => {
    mockGetServerSession.mockResolvedValueOnce(adminSession());
    mockRestaurantModel.findById.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValueOnce({ onboardingCompleted: false, onboardingStepsCompleted: [] }),
    });
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.completed).toBe(false);
    expect(json.steps).toEqual([]);
  });

  it('retourne onboardingCompleted=true avec les étapes', async () => {
    mockGetServerSession.mockResolvedValueOnce(adminSession());
    mockRestaurantModel.findById.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValueOnce({
        onboardingCompleted: true,
        onboardingStepsCompleted: ['personnalisation', 'menu'],
      }),
    });
    const res = await GET();
    const json = await res.json();
    expect(json.completed).toBe(true);
    expect(json.steps).toContain('personnalisation');
    expect(json.steps).toContain('menu');
  });
});

// ── PATCH ─────────────────────────────────────────────────────────────────────

describe('PATCH /api/admin/onboarding', () => {
  beforeEach(() => vi.clearAllMocks());

  it('403 si non connecté', async () => {
    mockGetServerSession.mockResolvedValueOnce(null);
    const res = await PATCH(makeReq({ stepId: 'menu' }));
    expect(res.status).toBe(403);
  });

  it('422 si payload invalide', async () => {
    mockGetServerSession.mockResolvedValueOnce(adminSession());
    const res = await PATCH(makeReq({ stepId: 'invalid_step' }));
    expect(res.status).toBe(422);
  });

  it('422 si stepId inconnu', async () => {
    mockGetServerSession.mockResolvedValueOnce(adminSession());
    const res = await PATCH(makeReq({ stepId: 'pirate' }));
    expect(res.status).toBe(422);
  });

  it('marque une étape valide', async () => {
    mockGetServerSession.mockResolvedValueOnce(adminSession());
    mockRestaurantModel.findByIdAndUpdate.mockResolvedValueOnce({});
    const res = await PATCH(makeReq({ stepId: 'menu' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.step).toBe('menu');
    expect(mockRestaurantModel.findByIdAndUpdate).toHaveBeenCalledWith(
      RESTAURANT_ID,
      { $addToSet: { onboardingStepsCompleted: 'menu' } }
    );
  });

  it('marque toutes les étapes (completeAll)', async () => {
    mockGetServerSession.mockResolvedValueOnce(adminSession());
    mockRestaurantModel.findByIdAndUpdate.mockResolvedValueOnce({});
    const res = await PATCH(makeReq({ completeAll: true }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.completed).toBe(true);
    expect(mockRestaurantModel.findByIdAndUpdate).toHaveBeenCalledWith(
      RESTAURANT_ID,
      { $set: { onboardingCompleted: true } }
    );
  });

  it('400 si corps JSON malformé', async () => {
    mockGetServerSession.mockResolvedValueOnce(adminSession());
    const req = new NextRequest('http://localhost/api/admin/onboarding', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: 'not-json',
    });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
  });

  it('accepte toutes les étapes valides', async () => {
    const validSteps = ['personnalisation', 'menu', 'stripe', 'commandes', '2fa'];
    for (const stepId of validSteps) {
      mockGetServerSession.mockResolvedValueOnce(adminSession());
      mockRestaurantModel.findByIdAndUpdate.mockResolvedValueOnce({});
      const res = await PATCH(makeReq({ stepId }));
      expect(res.status).toBe(200);
    }
  });
});
