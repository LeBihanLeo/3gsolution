import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockFindOne, mockUpdateOne } = vi.hoisted(() => ({
  mockFindOne: vi.fn(),
  mockUpdateOne: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/lib/mongodb', () => ({ connectDB: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('@/lib/email', () => ({
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('bcryptjs', () => ({
  default: { hash: vi.fn().mockResolvedValue('hashed') },
}));
vi.mock('@/models/Client', () => ({
  default: { findOne: mockFindOne, updateOne: mockUpdateOne },
}));

import { POST as forgotPassword } from '@/app/api/client/forgot-password/route';
import { POST as resetPassword } from '@/app/api/client/reset-password/route';

function makeRequest(url: string, body: unknown) {
  return new NextRequest(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ── forgot-password ───────────────────────────────────────────────────────────
describe('POST /api/client/forgot-password', () => {
  beforeEach(() => vi.clearAllMocks());

  it('retourne toujours 200 (anti-énumération)', async () => {
    mockFindOne.mockResolvedValueOnce(null);
    const res = await forgotPassword(
      makeRequest('http://localhost/api/client/forgot-password', { email: 'unknown@test.com' })
    );
    expect(res.status).toBe(200);
  });

  it('compte credentials → envoie email reset', async () => {
    const { sendPasswordResetEmail } = await import('@/lib/email');
    mockFindOne.mockResolvedValueOnce({ _id: 'abc', provider: 'credentials' });
    await forgotPassword(
      makeRequest('http://localhost/api/client/forgot-password', { email: 'user@test.com' })
    );
    expect(sendPasswordResetEmail).toHaveBeenCalled();
    expect(mockUpdateOne).toHaveBeenCalled();
  });

  it("compte google → pas d'email envoyé, 200 quand même", async () => {
    const { sendPasswordResetEmail } = await import('@/lib/email');
    mockFindOne.mockResolvedValueOnce({ _id: 'abc', provider: 'google' });
    const res = await forgotPassword(
      makeRequest('http://localhost/api/client/forgot-password', { email: 'google@test.com' })
    );
    expect(res.status).toBe(200);
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it('corps invalide → 200 quand même', async () => {
    const req = new NextRequest('http://localhost/api/client/forgot-password', {
      method: 'POST',
      body: 'bad',
    });
    const res = await forgotPassword(req);
    expect(res.status).toBe(200);
  });
});

// ── reset-password ────────────────────────────────────────────────────────────
describe('POST /api/client/reset-password', () => {
  beforeEach(() => vi.clearAllMocks());

  it('token valide → 200 et hash mis à jour', async () => {
    mockFindOne.mockResolvedValueOnce({
      _id: 'abc',
      passwordResetToken: 'tok',
      passwordResetTokenExpiry: new Date(Date.now() + 60 * 60 * 1000),
    });
    const res = await resetPassword(
      makeRequest('http://localhost/api/client/reset-password', { token: 'tok', password: 'NewPass1!' })
    );
    expect(res.status).toBe(200);
    expect(mockUpdateOne).toHaveBeenCalledWith(
      { _id: 'abc' },
      expect.objectContaining({ $set: { passwordHash: 'hashed' } })
    );
  });

  it('token expiré → 400', async () => {
    mockFindOne.mockResolvedValueOnce({
      _id: 'abc',
      passwordResetToken: 'tok',
      passwordResetTokenExpiry: new Date(Date.now() - 1000),
    });
    const res = await resetPassword(
      makeRequest('http://localhost/api/client/reset-password', { token: 'tok', password: 'NewPass1!' })
    );
    expect(res.status).toBe(400);
  });

  it('token inexistant → 400', async () => {
    mockFindOne.mockResolvedValueOnce(null);
    const res = await resetPassword(
      makeRequest('http://localhost/api/client/reset-password', { token: 'unknown', password: 'NewPass1!' })
    );
    expect(res.status).toBe(400);
  });

  it('mot de passe faible → 400 Zod', async () => {
    const res = await resetPassword(
      makeRequest('http://localhost/api/client/reset-password', { token: 'tok', password: 'weak' })
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.errors.password).toBeDefined();
  });
});
