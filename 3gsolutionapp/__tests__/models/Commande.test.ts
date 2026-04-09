import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import mongoose from 'mongoose';
import { connect, closeDatabase, clearDatabase } from '../helpers/mongoMemory';
import Commande from '@/models/Commande';

beforeAll(async () => connect());
afterAll(async () => closeDatabase());
afterEach(async () => clearDatabase());

const validProduitSnapshot = {
  produitId: new mongoose.Types.ObjectId(),
  nom: 'Burger Classic',
  prix: 850,
  quantite: 1,
  options: [],
};

// TICK-133 — restaurantId est requis depuis Sprint 18 (multi-tenant)
const RESTAURANT_ID = new mongoose.Types.ObjectId().toString();

const validCommande = {
  stripeSessionId: 'cs_test_abc123',
  statut: 'payee' as const,
  client: { nom: 'Jean Dupont', telephone: '0612345678' },
  retrait: { type: 'immediat' as const },
  produits: [validProduitSnapshot],
  total: 850,
  restaurantId: RESTAURANT_ID,
};

describe('Modèle Commande', () => {
  it('crée une commande valide', async () => {
    const commande = await Commande.create(validCommande);
    expect(commande._id).toBeDefined();
    expect(commande.statut).toBe('payee');
  });

  it('rejette un statut hors enum', async () => {
    await expect(
      Commande.create({ ...validCommande, statut: 'invalide' })
    ).rejects.toThrow(mongoose.Error.ValidationError);
  });

  it('index unique sur stripeSessionId — doublon provoque E11000', async () => {
    await Commande.create(validCommande);
    await expect(
      Commande.create({ ...validCommande, stripeSessionId: 'cs_test_abc123' })
    ).rejects.toThrow();
  });

  it('rejette si snapshot produit manque nom', async () => {
    await expect(
      Commande.create({
        ...validCommande,
        produits: [{ produitId: new mongoose.Types.ObjectId(), prix: 100, quantite: 1, options: [] }],
      })
    ).rejects.toThrow(mongoose.Error.ValidationError);
  });

  it('rejette si snapshot produit manque quantite', async () => {
    await expect(
      Commande.create({
        ...validCommande,
        produits: [{ produitId: new mongoose.Types.ObjectId(), nom: 'Test', prix: 100, options: [] }],
      })
    ).rejects.toThrow(mongoose.Error.ValidationError);
  });

  it('total en centimes stocké tel quel', async () => {
    const commande = await Commande.create({ ...validCommande, total: 1750 });
    expect(commande.total).toBe(1750);
  });

  it('accepte des champs optionnels : email et commentaire', async () => {
    const commande = await Commande.create({
      ...validCommande,
      client: { nom: 'Jean', telephone: '0612345678', email: 'jean@example.com' },
      commentaire: 'Sans cornichons',
    });
    expect(commande.client.email).toBe('jean@example.com');
    expect(commande.commentaire).toBe('Sans cornichons');
  });

  it('accepte retrait de type creneau avec horaire', async () => {
    const commande = await Commande.create({
      ...validCommande,
      retrait: { type: 'creneau', creneau: '12:00 – 12:15' },
    });
    expect(commande.retrait.type).toBe('creneau');
    expect(commande.retrait.creneau).toBe('12:00 – 12:15');
  });
});
