// TICK-131 — Modèle tenant maître : remplace SiteConfig (singleton) en multi-tenant
// Chaque document représente un restaurant client de 3G Solution.
import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IRestaurant extends Document {
  slug: string;                        // "resto-a" — identifiant URL interne, unique
  domaine: string;                     // "www.restoA.com" — résolution tenant
  domainesAlternatifs?: string[];      // ["restoA.com"] — alias www/apex

  // Config vitrine (anciennement SiteConfig)
  nomRestaurant: string;
  banniereUrl?: string;
  couleurPrincipale: string;           // hex, défaut "#E63946"
  horaireOuverture: string;           // "HH:MM", défaut "11:30"
  horaireFermeture: string;           // "HH:MM", défaut "14:00"
  fermeeAujourdhui: boolean;          // défaut false

  // Auth admin (remplace ADMIN_EMAIL / ADMIN_PASSWORD_HASH env)
  adminEmail: string;                  // unique par restaurant
  adminPasswordHash: string;           // bcrypt hash — select: false

  // Stripe (par restaurant)
  stripeSecretKey: string;            // sk_live_... — select: false
  stripeWebhookSecret: string;        // whsec_... — select: false
  stripePublishableKey: string;       // pk_live_... (exposé au client via API)

  // Email (optionnel : si absent, variable env globale utilisée)
  emailFrom?: string;                  // "commandes@restoA.com"

  createdAt: Date;
  updatedAt: Date;
}

const RestaurantSchema = new Schema<IRestaurant>(
  {
    slug: { type: String, required: true, unique: true, trim: true },
    domaine: { type: String, required: true, unique: true, trim: true },
    domainesAlternatifs: { type: [String], default: [] },

    // Config vitrine
    nomRestaurant: { type: String, required: true },
    banniereUrl: { type: String },
    couleurPrincipale: { type: String, required: true, default: '#E63946' },
    horaireOuverture: { type: String, required: true, default: '11:30' },
    horaireFermeture: { type: String, required: true, default: '14:00' },
    fermeeAujourdhui: { type: Boolean, required: true, default: false },

    // Auth admin — select: false → jamais inclus dans les réponses par défaut
    adminEmail: { type: String, required: true, unique: true, trim: true, lowercase: true },
    adminPasswordHash: { type: String, required: true, select: false },

    // Stripe — select: false sur les clés secrètes
    stripeSecretKey: { type: String, required: true, select: false },
    stripeWebhookSecret: { type: String, required: true, select: false },
    stripePublishableKey: { type: String, required: true },

    // Email
    emailFrom: { type: String },
  },
  { timestamps: true }
);

// Index unique déjà défini via `unique: true` dans les champs,
// mais on crée un index composite sur domainesAlternatifs pour la résolution
RestaurantSchema.index({ domainesAlternatifs: 1 });

const Restaurant: Model<IRestaurant> =
  (mongoose.models.Restaurant as Model<IRestaurant>) ||
  mongoose.model<IRestaurant>('Restaurant', RestaurantSchema);

export default Restaurant;
