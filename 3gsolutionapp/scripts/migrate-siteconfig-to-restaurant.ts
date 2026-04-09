// TICK-135 — Migration SiteConfig → Restaurant
//
// Ce script lit le document SiteConfig existant et crée un document Restaurant
// équivalent avec les credentials admin et les clés Stripe depuis les variables d'env.
//
// Usage :
//   npx tsx scripts/migrate-siteconfig-to-restaurant.ts
//
// Prérequis :
//   - MONGODB_URI dans .env.local
//   - ADMIN_EMAIL et ADMIN_PASSWORD_HASH dans .env.local
//   - NEXTAUTH_URL dans .env.local (utilisé pour le domaine)

import 'dotenv/config';
import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('MONGODB_URI manquant dans .env.local');
  process.exit(1);
}

const SiteConfigSchema = new mongoose.Schema({
  nomRestaurant: String,
  banniereUrl: String,
  couleurPrincipale: String,
  horaireOuverture: String,
  horaireFermeture: String,
  fermeeAujourdhui: Boolean,
}, { strict: false });

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
  console.log('✅ MongoDB connecté');

  const SiteConfigModel = mongoose.models.SiteConfig ?? mongoose.model('SiteConfig', SiteConfigSchema);
  const RestaurantModel = mongoose.models.Restaurant ?? mongoose.model('Restaurant', RestaurantSchema);

  // Vérifier si un restaurant existe déjà pour éviter les doublons
  const restaurantCount = await RestaurantModel.countDocuments();
  if (restaurantCount > 0) {
    console.log(`⚠️  ${restaurantCount} restaurant(s) déjà présent(s) en base.`);
    console.log('   Migration ignorée. Supprimez les restaurants existants pour re-migrer.');
    await mongoose.disconnect();
    return;
  }

  // Lire le SiteConfig existant
  const siteConfig = await SiteConfigModel.findOne().lean() as Record<string, unknown> | null;

  const nextAuthUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
  const domaine = new URL(nextAuthUrl).host;

  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;

  if (!adminEmail || !adminPasswordHash) {
    console.error('❌ ADMIN_EMAIL ou ADMIN_PASSWORD_HASH manquants dans .env.local');
    console.error('   Ces variables sont nécessaires pour créer les credentials admin du restaurant.');
    await mongoose.disconnect();
    process.exit(1);
  }

  const restaurantData = {
    nom: (siteConfig?.nomRestaurant as string) ?? 'Mon Restaurant',
    domaine,
    slug: domaine.split('.')[0].replace(/:/g, '-'), // "localhost:3000" → "localhost-3000"
    banniere: (siteConfig?.banniereUrl as string) ?? undefined,
    couleurPrimaire: (siteConfig?.couleurPrincipale as string) ?? '#E63946',
    couleurSecondaire: '#ffffff',
    horaireOuverture: (siteConfig?.horaireOuverture as string) ?? '11:30',
    horaireFermeture: (siteConfig?.horaireFermeture as string) ?? '14:00',
    fermeeAujourdhui: (siteConfig?.fermeeAujourdhui as boolean) ?? false,
    adminEmail,
    adminPasswordHash,
    stripePublishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    stripeSecretKey: process.env.STRIPE_SECRET_KEY,
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  };

  if (siteConfig) {
    console.log(`📋 SiteConfig trouvé : "${restaurantData.nom}"`);
  } else {
    console.log('📋 Aucun SiteConfig trouvé — création avec valeurs par défaut');
  }

  const restaurant = await RestaurantModel.create(restaurantData);

  console.log(`✅ Restaurant créé :`);
  console.log(`   - id      : ${restaurant._id}`);
  console.log(`   - nom     : ${restaurant.nom}`);
  console.log(`   - domaine : ${restaurant.domaine}`);
  console.log(`   - admin   : ${restaurant.adminEmail}`);
  console.log('');
  console.log('👉 Ajoutez dans .env.local :');
  console.log(`   DEV_TENANT_ID=${restaurant._id}`);
  console.log('');
  console.log('⚠️  SiteConfig conservé en base (marqué @deprecated dans models/SiteConfig.ts).');
  console.log('   Vous pouvez le supprimer manuellement après validation : db.siteconfigs.drop()');

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
