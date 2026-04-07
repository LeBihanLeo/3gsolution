import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { connect, closeDatabase, clearDatabase } from '../helpers/mongoMemory';
import Restaurant from '@/models/Restaurant';

const BASE = {
  slug: 'resto-a',
  domaine: 'www.resto-a.com',
  nomRestaurant: 'Resto A',
  adminEmail: 'admin@resto-a.com',
  adminPasswordHash: '$2b$12$hash',
  stripeSecretKey: 'sk_test_abc',
  stripeWebhookSecret: 'whsec_abc',
  stripePublishableKey: 'pk_test_abc',
};

beforeAll(async () => {
  await connect();
  // Garantit que tous les index uniques sont créés avant les tests
  await Restaurant.syncIndexes();
});
afterAll(async () => closeDatabase());
afterEach(async () => clearDatabase());

describe('Modèle Restaurant (TICK-131)', () => {
  it('crée un document valide avec les champs requis', async () => {
    const r = await Restaurant.create(BASE);
    expect(r.slug).toBe('resto-a');
    expect(r.domaine).toBe('www.resto-a.com');
    expect(r.nomRestaurant).toBe('Resto A');
    expect(r.couleurPrincipale).toBe('#E63946');
    expect(r.horaireOuverture).toBe('11:30');
    expect(r.horaireFermeture).toBe('14:00');
    expect(r.fermeeAujourdhui).toBe(false);
    expect(r.createdAt).toBeInstanceOf(Date);
    expect(r.updatedAt).toBeInstanceOf(Date);
  });

  it('stripeSecretKey et stripeWebhookSecret sont exclus par select:false', async () => {
    await Restaurant.create(BASE);
    const found = await Restaurant.findOne({ domaine: 'www.resto-a.com' });
    expect(found).not.toBeNull();
    expect((found as unknown as Record<string, unknown>).stripeSecretKey).toBeUndefined();
    expect((found as unknown as Record<string, unknown>).stripeWebhookSecret).toBeUndefined();
  });

  it('adminPasswordHash est exclu par select:false', async () => {
    await Restaurant.create(BASE);
    const found = await Restaurant.findOne({ domaine: 'www.resto-a.com' });
    expect((found as unknown as Record<string, unknown>).adminPasswordHash).toBeUndefined();
  });

  it('stripePublishableKey est inclus (clé publique)', async () => {
    await Restaurant.create(BASE);
    const found = await Restaurant.findOne({ domaine: 'www.resto-a.com' });
    expect(found?.stripePublishableKey).toBe('pk_test_abc');
  });

  it('index unique sur domaine — doublon rejeté', async () => {
    await Restaurant.create(BASE);
    await expect(
      Restaurant.create({ ...BASE, slug: 'outro-slug', adminEmail: 'autre@email.com' })
    ).rejects.toThrow();
  });

  it('index unique sur slug — doublon rejeté', async () => {
    await Restaurant.create(BASE);
    await expect(
      Restaurant.create({ ...BASE, domaine: 'www.autre.com', adminEmail: 'autre@email.com' })
    ).rejects.toThrow();
  });

  it('index unique sur adminEmail — doublon rejeté', async () => {
    await Restaurant.create(BASE);
    await expect(
      Restaurant.create({ ...BASE, domaine: 'www.autre.com', slug: 'autre-slug' })
    ).rejects.toThrow();
  });

  it('domainesAlternatifs optionnel', async () => {
    const r = await Restaurant.create({ ...BASE, domainesAlternatifs: ['resto-a.com'] });
    expect(r.domainesAlternatifs).toContain('resto-a.com');
  });

  it('échoue si nomRestaurant absent', async () => {
    const { nomRestaurant: _, ...without } = BASE;
    await expect(Restaurant.create(without)).rejects.toThrow();
  });
});
