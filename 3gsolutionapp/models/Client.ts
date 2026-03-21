import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IClient extends Document {
  email: string;
  passwordHash?: string;       // absent pour les comptes OAuth-only
  googleId?: string;           // identifiant Google (sub)
  provider: 'credentials' | 'google';
  nom?: string;
  actif: boolean;              // false = soft-delete (compte supprimé)
  consentementMarketing: boolean; // opt-in programme de fidélité (futur)
  consentementDate: Date;      // timestamp de la case cochée — preuve RGPD
  lastLoginAt: Date;
  // RGPD Art. 5(1)(e) — gliding window : lastLoginAt + 36 mois
  // Mis à jour à chaque connexion. Index TTL → suppression automatique après inactivité.
  purgeAt: Date;
  createdAt: Date;
}

const ClientSchema = new Schema<IClient>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String },
    googleId: { type: String },
    provider: {
      type: String,
      enum: ['credentials', 'google'],
      required: true,
    },
    nom: { type: String, trim: true },
    actif: { type: Boolean, default: true },
    consentementMarketing: { type: Boolean, default: false },
    consentementDate: { type: Date, required: true },
    lastLoginAt: { type: Date, required: true },
    purgeAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Index TTL RGPD — suppression automatique après inactivité de 36 mois
// expireAfterSeconds: 0 → MongoDB supprime dès que Date.now() >= purgeAt
// IMPORTANT : le daemon TTL s'exécute toutes les ~60 s (délai acceptable)
ClientSchema.index({ purgeAt: 1 }, { expireAfterSeconds: 0 });

// Index sparse sur googleId — unique parmi les comptes Google, null non indexé
ClientSchema.index({ googleId: 1 }, { unique: true, sparse: true });

const Client: Model<IClient> =
  (mongoose.models.Client as Model<IClient>) ||
  mongoose.model<IClient>('Client', ClientSchema);

export default Client;
