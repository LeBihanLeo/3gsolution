/**
 * TICK-164 — Migration Stripe Connect
 *
 * Supprime les anciens champs secrets Stripe (stripeSecretKey, stripePublishableKey, stripeWebhookSecret)
 * de tous les documents Restaurant et initialise stripeOnboardingComplete à false.
 *
 * À exécuter UNE SEULE FOIS après déploiement de TICK-156 en production :
 *   npx tsx scripts/migrate-stripe-connect.ts
 *
 * ATTENTION : Ce script modifie la base de données de production.
 * Les restaurants devront re-connecter leur compte Stripe via /espace-restaurateur/stripe.
 */

import { connectDB } from '../lib/mongodb';
import mongoose from 'mongoose';

// Guard de sécurité : confirmation requise pour éviter un run accidentel
const args = process.argv.slice(2);
const confirmed = args.includes('--confirm');

if (!confirmed) {
  console.error('');
  console.error('⚠️  Ce script supprime les clés Stripe de tous les restaurants en DB.');
  console.error('   Les restaurants devront re-connecter leur compte Stripe via OAuth.');
  console.error('');
  console.error('   Pour exécuter : npx tsx scripts/migrate-stripe-connect.ts --confirm');
  console.error('');
  process.exit(1);
}

async function migrate() {
  console.log('[migrate-stripe-connect] Connexion à MongoDB...');
  await connectDB();

  const db = mongoose.connection.db;
  if (!db) throw new Error('Connexion MongoDB non établie');

  const collection = db.collection('restaurants');

  const result = await collection.updateMany(
    {},
    {
      $unset: {
        stripeSecretKey: 1,
        stripePublishableKey: 1,
        stripeWebhookSecret: 1,
      },
      $set: {
        stripeOnboardingComplete: false,
      },
    }
  );

  console.log(`[migrate-stripe-connect] ${result.matchedCount} restaurants traités.`);
  console.log(`[migrate-stripe-connect] ${result.modifiedCount} restaurants modifiés.`);
  console.log('[migrate-stripe-connect] Migration terminée.');
  console.log('');
  console.log('  → Les restaurants doivent maintenant connecter leur compte Stripe via :');
  console.log('    https://<domaine-restaurant>/espace-restaurateur/stripe');

  await mongoose.disconnect();
}

migrate().catch((err) => {
  console.error('[migrate-stripe-connect] Erreur :', err);
  process.exit(1);
});
