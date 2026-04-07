#!/usr/bin/env tsx
// TICK-131 — Seed : crée un restaurant par défaut pour le développement local
// Usage : npx tsx scripts/seed-restaurant.ts
import { config } from 'dotenv';
// dotenv/config charge .env par défaut — Next.js utilise .env.local
config({ path: '.env.local' });
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { connectDB } from '../lib/mongodb';
import Restaurant from '../models/Restaurant';

async function seed() {
  await connectDB();

  const domaine = 'localhost:3000';
  const existing = await Restaurant.findOne({ domaine });

  if (existing) {
    console.log(`[seed] Restaurant "${existing.nomRestaurant}" (${domaine}) déjà présent — aucune action.`);
    await mongoose.disconnect();
    return;
  }

  const adminEmail = process.env.ADMIN_EMAIL ?? 'admin@localhost.dev';
  const adminPassword = process.env.ADMIN_PASSWORD ?? 'admin123';
  const adminPasswordHash = await bcrypt.hash(adminPassword, 12);

  const stripePublishableKey = process.env.STRIPE_PUBLISHABLE_KEY ?? 'pk_test_placeholder';
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY ?? 'sk_test_placeholder';
  const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? 'whsec_placeholder';

  const restaurant = await Restaurant.create({
    slug: 'restaurant-local',
    domaine,
    domainesAlternatifs: ['127.0.0.1:3000'],
    nomRestaurant: process.env.NOM_RESTAURANT ?? '3G Solution',
    couleurPrincipale: '#E63946',
    horaireOuverture: '11:30',
    horaireFermeture: '14:00',
    fermeeAujourdhui: false,
    adminEmail,
    adminPasswordHash,
    stripePublishableKey,
    stripeSecretKey,
    stripeWebhookSecret,
  });

  console.log(`[seed] Restaurant créé : "${restaurant.nomRestaurant}" (id: ${restaurant._id}, domaine: ${domaine})`);
  console.log(`[seed] Admin : ${adminEmail}`);
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('[seed] Erreur :', err);
  process.exit(1);
});
