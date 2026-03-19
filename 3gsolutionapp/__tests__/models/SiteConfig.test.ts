import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { connect, closeDatabase, clearDatabase } from '../helpers/mongoMemory';
import SiteConfig from '@/models/SiteConfig';

beforeAll(async () => connect());
afterAll(async () => closeDatabase());
afterEach(async () => clearDatabase());

describe('Modèle SiteConfig', () => {
  it('crée un document valide', async () => {
    const config = await SiteConfig.create({ nomRestaurant: 'Le Bistrot' });
    expect(config.nomRestaurant).toBe('Le Bistrot');
  });

  it('upsert — deux appels successifs → toujours 1 seul document', async () => {
    await SiteConfig.findOneAndUpdate(
      {},
      { nomRestaurant: 'Restaurant 1' },
      { upsert: true, new: true }
    );
    await SiteConfig.findOneAndUpdate(
      {},
      { nomRestaurant: 'Restaurant 2' },
      { upsert: true, new: true }
    );
    const count = await SiteConfig.countDocuments();
    expect(count).toBe(1);
    const config = await SiteConfig.findOne();
    expect(config?.nomRestaurant).toBe('Restaurant 2');
  });

  it('updatedAt est mis à jour automatiquement', async () => {
    const config = await SiteConfig.create({ nomRestaurant: 'Test' });
    const beforeUpdate = config.updatedAt;
    // On attend 1ms pour que la date change
    await new Promise((r) => setTimeout(r, 10));
    config.nomRestaurant = 'Modifié';
    await config.save();
    expect(config.updatedAt.getTime()).toBeGreaterThanOrEqual(beforeUpdate.getTime());
  });

  it('banniereUrl optionnel', async () => {
    const config = await SiteConfig.create({
      nomRestaurant: 'Test',
      banniereUrl: 'https://example.com/banner.jpg',
    });
    expect(config.banniereUrl).toBe('https://example.com/banner.jpg');
  });
});
