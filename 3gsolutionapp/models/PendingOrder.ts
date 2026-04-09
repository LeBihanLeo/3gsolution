// PendingOrder — snapshot de commande avant paiement Stripe
//
// Pourquoi ce modèle existe :
//   Stripe limite chaque valeur de métadonnée à 500 caractères.
//   Le JSON de 4 items avec options dépasse facilement cette limite,
//   causant une troncature silencieuse et l'échec du parse dans le webhook.
//
//   Solution : stocker le snapshot complet ici (TTL 1h) et ne passer
//   que le `_id` (24 chars) dans les métadonnées Stripe.
//
// TTL : 24 heures — Stripe peut retenter la livraison d'un webhook jusqu'à 3 jours
//   en cas d'erreur réseau ou d'indisponibilité temporaire. 1h était insuffisant :
//   si le premier appel échouait et que Stripe retentait plusieurs heures plus tard,
//   le PendingOrder était déjà purgé et la commande ne pouvait pas être créée
//   (argent encaissé mais commande perdue). 24h couvre les retries Stripe tout en
//   restant raisonnable. Les documents sont de toute façon supprimés explicitement
//   par handleSessionCompleted et handleSessionExpired.

import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IPendingOrder extends Document {
  client: {
    nom: string;
    telephone: string;
    email?: string;
  };
  retrait: {
    type: 'creneau';
    creneau: string;
  };
  commentaire?: string;
  produits: Array<{
    produitId: string;
    nom: string;
    prix: number;
    quantite: number;
    taux_tva: number;
    options: Array<{ nom: string; prix: number }>;
  }>;
  clientId?: string;
  restaurantId: string; // TICK-134 — multi-tenant
  createdAt: Date;
}

const PendingOrderSchema = new Schema<IPendingOrder>(
  {
    client: { type: Schema.Types.Mixed, required: true },
    retrait: { type: Schema.Types.Mixed, required: true },
    commentaire: { type: String },
    produits: { type: [Schema.Types.Mixed], required: true },
    clientId: { type: String },
    restaurantId: { type: String, required: true }, // TICK-134 — multi-tenant
    createdAt: { type: Date, default: Date.now, expires: 86400 }, // 24h = 24 * 3600
  },
  { versionKey: false }
);

const PendingOrder: Model<IPendingOrder> =
  (mongoose.models.PendingOrder as Model<IPendingOrder>) ||
  mongoose.model<IPendingOrder>('PendingOrder', PendingOrderSchema);

export default PendingOrder;
