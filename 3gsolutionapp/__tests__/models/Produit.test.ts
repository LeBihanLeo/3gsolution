import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import mongoose from 'mongoose';
import { connect, closeDatabase, clearDatabase } from '../helpers/mongoMemory';
import Produit from '@/models/Produit';

beforeAll(async () => connect());
afterAll(async () => closeDatabase());
afterEach(async () => clearDatabase());

// TICK-133 — restaurantId requis sur Produit (scoping multi-tenant)
const RESTAURANT_ID = new mongoose.Types.ObjectId();

const BASE = {
  nom: 'Burger Classic',
  description: 'Un bon burger',
  categorie: 'Burgers',
  prix: 850,
  restaurantId: RESTAURANT_ID,
};

describe('Modèle Produit', () => {
  it('crée un produit valide avec les champs obligatoires', async () => {
    const produit = await Produit.create(BASE);
    expect(produit._id).toBeDefined();
    expect(produit.nom).toBe('Burger Classic');
    expect(produit.actif).toBe(true); // valeur par défaut
    expect(produit.options).toEqual([]);
  });

  it('rejette un produit avec prix négatif', async () => {
    await expect(
      Produit.create({ ...BASE, prix: -10 })
    ).rejects.toThrow(mongoose.Error.ValidationError);
  });

  it('rejette un produit sans nom', async () => {
    await expect(
      Produit.create({ description: 'Desc', categorie: 'Cat', prix: 500, restaurantId: RESTAURANT_ID })
    ).rejects.toThrow(mongoose.Error.ValidationError);
  });

  it('actif est true par défaut', async () => {
    const produit = await Produit.create({ ...BASE, nom: 'Test' });
    expect(produit.actif).toBe(true);
  });

  it('sauvegarde un sous-document option avec nom et prix', async () => {
    const produit = await Produit.create({
      ...BASE,
      options: [{ nom: 'Supplément fromage', prix: 50 }],
    });
    expect(produit.options).toHaveLength(1);
    expect(produit.options[0].nom).toBe('Supplément fromage');
    expect(produit.options[0].prix).toBe(50);
  });

  it('imageUrl absent → champ omis dans le document', async () => {
    const produit = await Produit.create({ ...BASE, nom: 'Sans image' });
    expect(produit.imageUrl).toBeUndefined();
  });

  it('sauvegarde imageUrl si fourni', async () => {
    const produit = await Produit.create({
      ...BASE,
      nom: 'Avec image',
      imageUrl: 'https://example.com/image.jpg',
    });
    expect(produit.imageUrl).toBe('https://example.com/image.jpg');
  });

  // TICK-126 — taux_tva
  it('taux_tva est 10 par défaut', async () => {
    const produit = await Produit.create({ ...BASE, nom: 'Test TVA' });
    expect(produit.taux_tva).toBe(10);
  });

  it('accepte les valeurs autorisées de taux_tva (0, 5.5, 10, 20)', async () => {
    for (const taux of [0, 5.5, 10, 20] as const) {
      const produit = await Produit.create({ ...BASE, nom: `TVA ${taux}`, taux_tva: taux });
      expect(produit.taux_tva).toBe(taux);
    }
  });

  it('rejette un taux_tva non autorisé (ex: 7)', async () => {
    await expect(
      Produit.create({ ...BASE, taux_tva: 7 })
    ).rejects.toThrow(mongoose.Error.ValidationError);
  });
});
