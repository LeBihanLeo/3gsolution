import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockCreate, mockFindOne } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockFindOne: vi.fn(),
}));

vi.mock('@/lib/mongodb', () => ({ connectDB: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('@/lib/email', () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('bcryptjs', () => ({ default: { hash: vi.fn().mockResolvedValue('hashed_password') } }));
vi.mock('@/models/Client', () => ({
  default: { create: mockCreate, findOne: mockFindOne },
}));

import { POST } from '@/app/api/client/register/route';

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/client/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// Payload valide de base (TICK-087 : nom obligatoire)
const VALID_PAYLOAD = { email: 'test@example.com', password: 'Password1!', nom: 'Jean' };

describe('POST /api/client/register', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindOne.mockResolvedValue(null);
    mockCreate.mockResolvedValue({ _id: 'abc123' });
  });

  it('inscrit un client valide → 201', async () => {
    const res = await POST(makeRequest(VALID_PAYLOAD));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.message).toContain('Vérifiez votre email');
  });

  // TICK-087 — nom obligatoire
  it('nom absent → 400 avec erreur de champ', async () => {
    const res = await POST(makeRequest({ email: 'test@example.com', password: 'Password1!' }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.errors.nom).toBeDefined();
  });

  it('nom vide → 400 avec erreur de champ', async () => {
    const res = await POST(makeRequest({ ...VALID_PAYLOAD, nom: '' }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.errors.nom).toBeDefined();
  });

  it('email invalide → 400 avec erreur de champ', async () => {
    const res = await POST(makeRequest({ ...VALID_PAYLOAD, email: 'invalide' }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.errors.email).toBeDefined();
  });

  it('mot de passe sans majuscule → 400', async () => {
    const res = await POST(makeRequest({ ...VALID_PAYLOAD, password: 'password1!' }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.errors.password).toBeDefined();
  });

  it('mot de passe sans chiffre → 400', async () => {
    const res = await POST(makeRequest({ ...VALID_PAYLOAD, password: 'Password!' }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.errors.password).toBeDefined();
  });

  it('email déjà existant → 409', async () => {
    mockFindOne.mockResolvedValueOnce({ _id: 'existing' });
    const res = await POST(makeRequest(VALID_PAYLOAD));
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.error).toContain('existe déjà');
  });

  it('ne retourne pas le hash ni le token', async () => {
    const res = await POST(makeRequest(VALID_PAYLOAD));
    const data = await res.json();
    expect(data).not.toHaveProperty('passwordHash');
    expect(data).not.toHaveProperty('emailVerifyToken');
  });

  it('corps invalide → 400', async () => {
    const req = new NextRequest('http://localhost/api/client/register', {
      method: 'POST',
      body: 'not-json',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
