// TICK-131 — Modèle Restaurant : remplace SiteConfig singleton pour l'architecture multi-tenant.
// Chaque document représente un restaurant client avec sa configuration, ses credentials
// admin et ses clés Stripe. SiteConfig est conservé le temps de la migration (TICK-135).
import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IRestaurant extends Document {
  // Identification
  nom: string;
  domaine: string; // ex: "resto-a.com"
  slug: string;    // ex: "resto-a"

  // Vitrine
  description?: string;
  banniere?: string;           // URL image bannière
  couleurPrimaire: string;     // hex — défaut: "#E63946"
  couleurSecondaire: string;   // hex — défaut: "#ffffff"
  horaireOuverture: string;    // format "HH:MM"
  horaireFermeture: string;    // format "HH:MM"
  fermeeAujourdhui: boolean;

  // Auth admin (remplace ADMIN_EMAIL / ADMIN_PASSWORD_HASH env vars)
  adminEmail: string;
  adminPasswordHash: string;   // select: false — jamais exposé par défaut
  adminTotpSecret?: string;    // select: false — secret TOTP base32, absent si 2FA désactivé

  // Stripe Connect — account_id OAuth (acct_xxx), jamais de clé secrète stockée
  stripeAccountId?: string;              // acct_xxx — pas secret, mais limité via select
  stripeOnboardingComplete: boolean;     // true = flow OAuth finalisé
  // Note : commission plateforme configurée via STRIPE_APPLICATION_FEE_PERCENT (env var) — pas en DB

  createdAt: Date;
  updatedAt: Date;
}

const RestaurantSchema = new Schema<IRestaurant>(
  {
    // Identification
    nom: { type: String, required: true },
    domaine: { type: String, required: true, unique: true },
    slug: { type: String, required: true, unique: true },

    // Vitrine
    description: { type: String },
    banniere: { type: String },
    couleurPrimaire: { type: String, default: '#E63946' },
    couleurSecondaire: { type: String, default: '#ffffff' },
    horaireOuverture: { type: String, default: '11:30' },
    horaireFermeture: { type: String, default: '14:00' },
    fermeeAujourdhui: { type: Boolean, default: false },

    // Auth admin — SECURITE : select: false → jamais retourné par défaut
    adminEmail: { type: String, required: true },
    adminPasswordHash: { type: String, required: true, select: false },
    adminTotpSecret: { type: String, select: false },

    // Stripe Connect — account_id uniquement, pas de clés secrètes en DB
    stripeAccountId: { type: String, index: true, sparse: true },
    stripeOnboardingComplete: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const Restaurant: Model<IRestaurant> =
  (mongoose.models.Restaurant as Model<IRestaurant>) ||
  mongoose.model<IRestaurant>('Restaurant', RestaurantSchema);

export default Restaurant;
