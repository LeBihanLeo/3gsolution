// TICK-131 — Seed script : crée le restaurant de développement depuis .env.local
//
// Usage :
//   npx tsx scripts/seed-restaurant.ts
//
// Prérequis :
//   - MONGODB_URI défini dans .env.local
//   - ADMIN_EMAIL et ADMIN_PASSWORD_HASH définis (ou les valeurs par défaut ci-dessous)
//   - NEXTAUTH_URL défini (utilisé comme domaine du restaurant)

import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('MONGODB_URI manquant dans .env.local');
  process.exit(1);
}

// Schéma minimal pour le seed (évite d'importer le modèle complet)
const RestaurantSchema = new mongoose.Schema({
  nom: String,
  domaine: String,
  slug: String,
  description: String,
  banniere: String,
  couleurPrimaire: { type: String, default: '#E63946' },
  couleurSecondaire: { type: String, default: '#ffffff' },
  horaireOuverture: { type: String, default: '11:30' },
  horaireFermeture: { type: String, default: '14:00' },
  fermeeAujourdhui: { type: Boolean, default: false },
  adminEmail: String,
  adminPasswordHash: { type: String, select: false },
  stripePublishableKey: String,
  stripeSecretKey: { type: String, select: false },
  stripeWebhookSecret: { type: String, select: false },
}, { timestamps: true });

async function main() {
  await mongoose.connect(MONGODB_URI!);

  const Restaurant = mongoose.models.Restaurant ?? mongoose.model('Restaurant', RestaurantSchema);

  // Extraire le domaine depuis NEXTAUTH_URL (ex: http://localhost:3000 → localhost:3000)
  const nextAuthUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
  const domaine = new URL(nextAuthUrl).host; // ex: "localhost:3000"

  const adminEmail = process.env.ADMIN_EMAIL ?? 'admin@restaurant.fr';
  // Si ADMIN_PASSWORD_HASH est fourni (bcrypt), l'utiliser directement.
  // Sinon, hasher le mot de passe par défaut.
  let adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;
  if (!adminPasswordHash) {
    const defaultPassword = 'admin123';
    adminPasswordHash = await bcrypt.hash(defaultPassword, 12);
    console.log(`⚠️  ADMIN_PASSWORD_HASH absent — mot de passe par défaut "${defaultPassword}" hashé`);
  }

  const existing = await Restaurant.findOne({ domaine });
  if (existing) {
    console.log(`✅ Restaurant déjà existant pour le domaine "${domaine}" (id: ${existing._id})`);
    console.log('   Aucune modification effectuée. Pour le recréer, supprimez-le d\'abord.');
    await mongoose.disconnect();
    return;
  }

  const restaurant = await Restaurant.create({
    nom: 'Mon Restaurant (dev)',
    domaine,
    slug: 'dev',
    description: 'Restaurant de développement',
    couleurPrimaire: '#E63946',
    couleurSecondaire: '#ffffff',
    horaireOuverture: '11:30',
    horaireFermeture: '14:00',
    fermeeAujourdhui: false,
    adminEmail,
    adminPasswordHash,
    stripePublishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    stripeSecretKey: process.env.STRIPE_SECRET_KEY,
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  });

  console.log(`✅ Restaurant créé :`);
  console.log(`   - id      : ${restaurant._id}`);
  console.log(`   - domaine : ${restaurant.domaine}`);
  console.log(`   - admin   : ${restaurant.adminEmail}`);
  console.log('');
  console.log('👉 Ajoutez dans .env.local :');
  console.log(`   DEV_TENANT_ID=${restaurant._id}`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
