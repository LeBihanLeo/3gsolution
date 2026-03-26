import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ISiteConfig extends Document {
  nomRestaurant: string;
  banniereUrl?: string;
  couleurBordureGauche?: string;
  couleurBordureDroite?: string;
  // TICK-100 — Horaires d'ouverture
  horaireOuverture: string;   // format "HH:MM", ex: "11:30"
  horaireFermeture: string;   // format "HH:MM", ex: "14:00"
  // TICK-105 — Fermeture manuelle du jour
  fermeeAujourdhui: boolean;
  updatedAt: Date;
}

const SiteConfigSchema = new Schema<ISiteConfig>(
  {
    nomRestaurant: { type: String, required: true, default: 'Mon Restaurant' },
    banniereUrl: { type: String },
    couleurBordureGauche: { type: String },
    couleurBordureDroite: { type: String },
    // TICK-100
    horaireOuverture: { type: String, required: true, default: '11:30' },
    horaireFermeture: { type: String, required: true, default: '14:00' },
    // TICK-105
    fermeeAujourdhui: { type: Boolean, required: true, default: false },
  },
  { timestamps: { createdAt: false, updatedAt: true } }
);

const SiteConfig: Model<ISiteConfig> =
  (mongoose.models.SiteConfig as Model<ISiteConfig>) ||
  mongoose.model<ISiteConfig>('SiteConfig', SiteConfigSchema);

export default SiteConfig;
