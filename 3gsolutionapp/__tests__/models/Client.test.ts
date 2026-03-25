import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { connect, closeDatabase, clearDatabase } from '../helpers/mongoMemory';
import Client from '@/models/Client';

beforeAll(async () => {
  await connect();
  // Force la création des index (unique email)
  await Client.createIndexes();
});
afterAll(async () => closeDatabase());
afterEach(async () => clearDatabase());

// TICK-087 — nom est désormais obligatoire
const validClient = {
  email: 'test@example.com',
  nom: 'Jean Test',
  provider: 'credentials' as const,
  emailVerified: false,
};

describe('Modèle Client', () => {
  it('crée un client valide avec champs obligatoires', async () => {
    const client = await Client.create(validClient);
    expect(client._id).toBeDefined();
    expect(client.email).toBe('test@example.com');
    expect(client.nom).toBe('Jean Test');
    expect(client.role).toBe('client');
    expect(client.emailVerified).toBe(false);
  });

  // TICK-087 — nom obligatoire
  it('rejette un client sans nom', async () => {
    await expect(
      Client.create({ email: 'nonon@example.com', provider: 'credentials', emailVerified: false })
    ).rejects.toThrow();
  });

  it('normalise email en lowercase', async () => {
    const client = await Client.create({ ...validClient, email: 'Test@EXAMPLE.COM' });
    expect(client.email).toBe('test@example.com');
  });

  it('rejette un doublon email', async () => {
    await Client.create(validClient);
    await expect(Client.create(validClient)).rejects.toThrow();
  });

  it('rejette un provider hors enum', async () => {
    await expect(
      Client.create({ ...validClient, provider: 'facebook' })
    ).rejects.toThrow();
  });

  it('role est toujours "client" (immutable)', async () => {
    const client = await Client.create(validClient);
    expect(client.role).toBe('client');
  });

  it('accepte un client Google avec emailVerified true', async () => {
    const client = await Client.create({
      email: 'google@example.com',
      provider: 'google',
      emailVerified: true,
      nom: 'Jean Dupont',
    });
    expect(client.provider).toBe('google');
    expect(client.emailVerified).toBe(true);
    expect(client.nom).toBe('Jean Dupont');
  });

  it('accepte les champs optionnels de token', async () => {
    const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const client = await Client.create({
      ...validClient,
      emailVerifyToken: 'abc123',
      emailVerifyTokenExpiry: expiry,
    });
    expect(client.emailVerifyToken).toBe('abc123');
    expect(client.emailVerifyTokenExpiry).toEqual(expiry);
  });

  it('createdAt et updatedAt sont générés automatiquement', async () => {
    const client = await Client.create(validClient);
    expect(client.createdAt).toBeInstanceOf(Date);
    expect(client.updatedAt).toBeInstanceOf(Date);
  });
});
