// TICK-189 — Migration one-shot : marque onboardingCompleted=true pour tous les
// restaurants créés AVANT ce sprint (restaurants déjà configurés en production).
// Usage : npx tsx scripts/migrate-onboarding.ts
import mongoose from 'mongoose';
import Restaurant from '../models/Restaurant';

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI manquant dans les variables d\'environnement.');

  await mongoose.connect(uri);
  console.log('[migrate-onboarding] Connecté à MongoDB.');

  const result = await Restaurant.updateMany(
    { onboardingCompleted: { $ne: true } },
    {
      $set: {
        onboardingCompleted: true,
        onboardingStepsCompleted: ['personnalisation', 'menu', 'stripe', 'commandes', '2fa'],
      },
    }
  );

  console.log(`[migrate-onboarding] ${result.modifiedCount} restaurant(s) mis à jour.`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('[migrate-onboarding] Erreur :', err);
  process.exit(1);
});
