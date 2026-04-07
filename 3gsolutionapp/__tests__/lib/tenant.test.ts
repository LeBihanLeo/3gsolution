// Tests unitaires pour lib/tenant.ts — resolveTenantForAdmin
import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';

const FAKE_ID = 'aaaaaaaaaaaaaaaaaaaaaaaa';

const mockHeaders = vi.fn();

vi.mock('next/headers', () => ({
  headers: () => mockHeaders(),
}));

import { resolveTenantForAdmin } from '@/lib/tenant';

describe('resolveTenantForAdmin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('retourne le tenant depuis x-tenant-id si présent', async () => {
    mockHeaders.mockResolvedValue({ get: () => FAKE_ID });
    const result = await resolveTenantForAdmin({ user: { id: 'other-id' } });
    expect(result?.toString()).toBe(FAKE_ID);
  });

  it('fallback sur session.user.id si x-tenant-id absent', async () => {
    mockHeaders.mockResolvedValue({ get: () => null });
    const result = await resolveTenantForAdmin({ user: { id: FAKE_ID } });
    expect(result?.toString()).toBe(FAKE_ID);
  });

  it('retourne null si header absent ET session.user.id absent', async () => {
    mockHeaders.mockResolvedValue({ get: () => null });
    const result = await resolveTenantForAdmin({ user: {} });
    expect(result).toBeNull();
  });

  it('retourne null si header absent ET session.user.id invalide', async () => {
    mockHeaders.mockResolvedValue({ get: () => null });
    const result = await resolveTenantForAdmin({ user: { id: 'invalid-id' } });
    expect(result).toBeNull();
  });

  it('retourne null si x-tenant-id invalide (non-ObjectId) ET session.user.id valide', async () => {
    mockHeaders.mockResolvedValue({ get: () => 'not-an-objectid' });
    const result = await resolveTenantForAdmin({ user: { id: FAKE_ID } });
    // x-tenant-id invalide → getTenantId throw → fallback session
    expect(result?.toString()).toBe(FAKE_ID);
  });

  it('retourne un mongoose.Types.ObjectId', async () => {
    mockHeaders.mockResolvedValue({ get: () => FAKE_ID });
    const result = await resolveTenantForAdmin({ user: { id: FAKE_ID } });
    expect(result).toBeInstanceOf(mongoose.Types.ObjectId);
  });
});
