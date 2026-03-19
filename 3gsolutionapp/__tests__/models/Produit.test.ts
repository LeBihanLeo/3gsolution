import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import mongoose from 'mongoose';
import { connect, closeDatabase, clearDatabase } from '../helpers/mongoMemory';
import Produit from '@/models/Produit';

beforeAll(async () => connect());
afterAll(async () => closeDatabase());
afterEach(async () => clearDatabase());

describe('Modèle Produit', () => {
  it('crée un produit valide avec les champs obligatoires', async () => {
    const produit = await Produit.create({
      nom: 'Burger Classic',
      description: 'Un bon burger',
      categorie: 'Burgers',
      prix: 850,
    });
    expect(produit._id).toBeDefined();
    expect(produit.nom).toBe('Burger Classic');
    expect(produit.actif).toBe(true); // valeur par défaut
    expect(produit.options).toEqual([]);
  });

  it('rejette un produit avec prix négatif', async () => {
    await expect(
      Produit.create({ nom: 'Test', description: 'Desc', categorie: 'Cat', prix: -10 })
    ).rejects.toThrow(mongoose.Error.ValidationError);
  });

  it('rejette un produit sans nom', async () => {
    await expect(
      Produit.create({ description: 'Desc', categorie: 'Cat', prix: 500 })
    ).rejects.toThrow(mongoose.Error.ValidationError);
  });

  it('actif est true par défaut', async () => {
    const produit = await Produit.create({
      nom: 'Test', description: 'Desc', categorie: 'Cat', prix: 100,
    });
    expect(produit.actif).toBe(true);
  });

  it('sauvegarde un sous-document option avec nom et prix', async () => {
    const produit = await Produit.create({
      nom: 'Burger',
      description: 'Desc',
      categorie: 'Burgers',
      prix: 850,
      options: [{ nom: 'Supplément fromage', prix: 50 }],
    });
    expect(produit.options).toHaveLength(1);
    expect(produit.options[0].nom).toBe('Supplément fromage');
    expect(produit.options[0].prix).toBe(50);
  });

  it('imageUrl absent → champ omis dans le document', async () => {
    const produit = await Produit.create({
      nom: 'Sans image', description: 'Desc', categorie: 'Cat', prix: 100,
    });
    expect(produit.imageUrl).toBeUndefined();
  });

  it('sauvegarde imageUrl si fourni', async () => {
    const produit = await Produit.create({
      nom: 'Avec image',
      description: 'Desc',
      categorie: 'Cat',
      prix: 100,
      imageUrl: 'https://example.com/image.jpg',
    });
    expect(produit.imageUrl).toBe('https://example.com/image.jpg');
  });
});
