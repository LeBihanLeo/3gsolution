import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockFindOne, mockDeleteOne, mockUpdateOne } = vi.hoisted(() => ({
  mockFindOne: vi.fn(),
  mockDeleteOne: vi.fn().mockResolvedValue({}),
  mockUpdateOne: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/lib/mongodb', () => ({ connectDB: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/models/Client', () => ({
  default: { findOne: mockFindOne, deleteOne: mockDeleteOne, updateOne: mockUpdateOne },
}));

import { POST } from '@/app/api/client/verify-email/route';

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/client/verify-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const validClient = {
  _id: 'abc123',
  emailVerifyToken: 'validtoken',
  emailVerifyTokenExpiry: new Date(Date.now() + 60 * 60 * 1000),
};

describe('POST /api/client/verify-email', () => {
  beforeEach(() => vi.clearAllMocks());

  it('token valide → 200 et active le compte', async () => {
    mockFindOne.mockResolvedValueOnce(validClient);
    const res = await POST(makeRequest({ token: 'validtoken' }));
    expect(res.status).toBe(200);
    expect(mockUpdateOne).toHaveBeenCalledWith(
      { _id: 'abc123' },
      expect.objectContaining({ $set: { emailVerified: true } })
    );
  });

  it('token inexistant → 400 message générique', async () => {
    mockFindOne.mockResolvedValueOnce(null);
    const res = await POST(makeRequest({ token: 'unknown' }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Token invalide.');
  });

  it('token expiré → 400 + suppression du compte', async () => {
    mockFindOne.mockResolvedValueOnce({
      _id: 'abc123',
      emailVerifyToken: 'expired',
      emailVerifyTokenExpiry: new Date(Date.now() - 1000),
    });
    const res = await POST(makeRequest({ token: 'expired' }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('expiré');
    expect(mockDeleteOne).toHaveBeenCalledWith({ _id: 'abc123' });
  });

  it('token manquant dans le body → 400', async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it('corps invalide → 400', async () => {
    const req = new NextRequest('http://localhost/api/client/verify-email', {
      method: 'POST',
      body: 'bad',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
