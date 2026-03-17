/**
 * Script de seed — insère des produits de test en base.
 *
 * Usage :
 *   npx ts-node --skip-project scripts/seed.ts
 *
 * Nécessite MONGODB_URI dans .env.local
 */

import mongoose from 'mongoose';
import * as path from 'path';
import * as fs from 'fs';

// Charge .env.local manuellement
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/\\\$/g, '$');
      process.env[key] = value;
    }
  }
}

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('❌  MONGODB_URI manquant dans .env.local');
  process.exit(1);
}

const ProduitSchema = new mongoose.Schema(
  {
    nom: String,
    description: String,
    categorie: String,
    prix: Number,
    options: [{ nom: String, prix: Number, _id: false }],
    actif: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const Produit =
  (mongoose.models.Produit as mongoose.Model<mongoose.Document>) ||
  mongoose.model('Produit', ProduitSchema);

const produits = [
  {
    nom: 'Burger Classic',
    description: 'Steak haché, salade, tomate, oignons, cornichons',
    categorie: 'Burgers',
    prix: 850,
    options: [
      { nom: 'Supplément fromage', prix: 100 },
      { nom: 'Supplément bacon', prix: 150 },
    ],
  },
  {
    nom: 'Burger BBQ',
    description: 'Steak haché, sauce BBQ, oignons caramélisés, cheddar',
    categorie: 'Burgers',
    prix: 1050,
    options: [
      { nom: 'Double steak', prix: 200 },
    ],
  },
  {
    nom: 'Frites maison',
    description: 'Frites fraîches dorées, assaisonnées',
    categorie: 'Accompagnements',
    prix: 350,
    options: [
      { nom: 'Sauce au choix', prix: 50 },
    ],
  },
  {
    nom: 'Onion rings',
    description: 'Rondelles d\'oignon panées et croustillantes',
    categorie: 'Accompagnements',
    prix: 400,
    options: [],
  },
  {
    nom: 'Coca-Cola 33cl',
    description: 'Canette bien fraîche',
    categorie: 'Boissons',
    prix: 250,
    options: [],
  },
  {
    nom: 'Eau minérale 50cl',
    description: 'Bouteille d\'eau plate ou gazeuse',
    categorie: 'Boissons',
    prix: 150,
    options: [
      { nom: 'Gazeuse', prix: 0 },
    ],
  },
];

async function seed() {
  await mongoose.connect(MONGODB_URI as string);
  console.log('✅  Connecté à MongoDB');

  const existing = await Produit.countDocuments();
  if (existing > 0) {
    console.log(`ℹ️   ${existing} produit(s) déjà en base. Seed ignoré.`);
    console.log('    Supprimez la collection "produits" pour relancer le seed.');
  } else {
    await Produit.insertMany(produits);
    console.log(`✅  ${produits.length} produits insérés.`);
  }

  await mongoose.disconnect();
  console.log('✅  Déconnecté.');
}

seed().catch((err) => {
  console.error('❌  Erreur :', err);
  process.exit(1);
});
