// @deprecated TICK-135 — SiteConfig remplacé par Restaurant (multi-tenant).
// Conservé pour compatibilité descendante. Utiliser getTenantRestaurant() à la place.
import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ISiteConfig extends Document {
  nomRestaurant: string;
  banniereUrl?: string;
  // TICK-122 — couleurPrincipale remplace couleurBordureGauche/Droite
  couleurPrincipale: string;  // hex ex: "#E63946" — défaut: "#E63946"
  /** @deprecated Use couleurPrincipale */
  couleurBordureGauche?: string;
  /** @deprecated Use couleurPrincipale */
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
    // TICK-122 — couleurPrincipale
    couleurPrincipale: { type: String, required: true, default: '#E63946' },
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
