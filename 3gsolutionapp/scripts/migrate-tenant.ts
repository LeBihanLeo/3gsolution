#!/usr/bin/env tsx
// TICK-135 — Migration SiteConfig → Restaurant
// Lit le document SiteConfig singleton existant, crée un Restaurant "seed",
// rattache tous les Produits et Commandes sans restaurantId à ce seed.
//
// Usage : npx tsx scripts/migrate-tenant.ts
// Idempotent : peut être relancé sans risque si le restaurant seed existe déjà.

import 'dotenv/config';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { connectDB } from '../lib/mongodb';
import SiteConfig from '../models/SiteConfig';
import Restaurant from '../models/Restaurant';
import Produit from '../models/Produit';
import Commande from '../models/Commande';

async function migrate() {
  await connectDB();

  // ── 1. Lire SiteConfig singleton ───────────────────────────────────────────
  const siteConfig = await SiteConfig.findOne().lean();
  console.log('[migrate] SiteConfig :', siteConfig ? 'trouvé' : 'absent (defaults utilisés)');

  const domaine = 'localhost:3000';

  // ── 2. Créer ou récupérer le Restaurant seed ────────────────────────────────
  let restaurant = await Restaurant.findOne({ domaine }).select('+adminPasswordHash +stripeSecretKey +stripeWebhookSecret');

  if (!restaurant) {
    const adminEmail = process.env.ADMIN_EMAIL ?? 'admin@localhost.dev';
    const adminPassword = process.env.ADMIN_PASSWORD ?? 'admin123';
    const adminPasswordHash = await bcrypt.hash(adminPassword, 12);

    restaurant = await Restaurant.create({
      slug: 'restaurant-local',
      domaine,
      domainesAlternatifs: ['127.0.0.1:3000'],
      nomRestaurant: siteConfig?.nomRestaurant ?? '3G Solution',
      banniereUrl: siteConfig?.banniereUrl,
      couleurPrincipale: siteConfig?.couleurPrincipale ?? '#E63946',
      horaireOuverture: siteConfig?.horaireOuverture ?? '11:30',
      horaireFermeture: siteConfig?.horaireFermeture ?? '14:00',
      fermeeAujourdhui: siteConfig?.fermeeAujourdhui ?? false,
      adminEmail,
      adminPasswordHash,
      stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY ?? 'pk_test_placeholder',
      stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? 'sk_test_placeholder',
      stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? 'whsec_placeholder',
    });
    console.log(`[migrate] Restaurant seed créé : "${restaurant.nomRestaurant}" (id: ${restaurant._id})`);
  } else {
    console.log(`[migrate] Restaurant seed existant : "${restaurant.nomRestaurant}" (id: ${restaurant._id})`);
  }

  const restaurantId = restaurant._id;

  // ── 3. Rattacher les Produits sans restaurantId ─────────────────────────────
  const produitResult = await Produit.updateMany(
    { restaurantId: { $exists: false } },
    { $set: { restaurantId } }
  );
  console.log(`[migrate] Produits rattachés : ${produitResult.modifiedCount}`);

  // ── 4. Rattacher les Commandes sans restaurantId ────────────────────────────
  const commandeResult = await Commande.updateMany(
    { restaurantId: { $exists: false } },
    { $set: { restaurantId } }
  );
  console.log(`[migrate] Commandes rattachées : ${commandeResult.modifiedCount}`);

  // ── 5. Rapport final ────────────────────────────────────────────────────────
  const produitsTotal = await Produit.countDocuments({ restaurantId });
  const commandesTotal = await Commande.countDocuments({ restaurantId });
  console.log(`[migrate] ✓ Produits liés au seed : ${produitsTotal}`);
  console.log(`[migrate] ✓ Commandes liées au seed : ${commandesTotal}`);
  console.log('[migrate] Migration terminée. SiteConfig conservé (suppression manuelle après validation).');

  await mongoose.disconnect();
}

migrate().catch((err) => {
  console.error('[migrate] Erreur :', err);
  process.exit(1);
});
