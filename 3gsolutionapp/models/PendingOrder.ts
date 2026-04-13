// PendingOrder — snapshot de commande avant paiement Stripe
//
// Pourquoi ce modèle existe :
//   Stripe limite chaque valeur de métadonnée à 500 caractères.
//   Le JSON de 4 items avec options dépasse facilement cette limite,
//   causant une troncature silencieuse et l'échec du parse dans le webhook.
//
//   Solution : stocker le snapshot complet ici et ne passer
//   que le `_id` (24 chars) dans les métadonnées Stripe.
//
// TTL (TICK-177) : champ expiresAt avec index { expireAfterSeconds: 0 }.
//   La valeur est fixée à +24h lors de la création (dans checkout/route.ts).
//   Pourquoi 24h et pas 30 min (durée de la session Stripe) :
//   Stripe peut retenter la livraison d'un webhook jusqu'à 3 jours en cas
//   d'erreur réseau ou d'indisponibilité temporaire. Si le premier appel
//   échoue et que Stripe retente plusieurs heures plus tard, le PendingOrder
//   doit encore exister pour que handleSessionCompleted puisse créer la commande
//   (argent déjà encaissé). 24h couvre les retries Stripe tout en restant
//   raisonnable. Les documents sont supprimés explicitement par
//   handleSessionCompleted et handleSessionExpired (chemin nominal).

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
  expiresAt: Date;      // TICK-177 — TTL explicite (index expireAfterSeconds: 0)
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
    // TICK-177 — TTL explicite : MongoDB supprime le document quand expiresAt < now
    // expireAfterSeconds: 0 → suppression dès que la date est dépassée (toutes les ~60s)
    expiresAt: {
      type: Date,
      required: true,
      index: { expireAfterSeconds: 0 },
    },
  },
  { versionKey: false, timestamps: { createdAt: true, updatedAt: false } }
);

const PendingOrder: Model<IPendingOrder> =
  (mongoose.models.PendingOrder as Model<IPendingOrder>) ||
  mongoose.model<IPendingOrder>('PendingOrder', PendingOrderSchema);

export default PendingOrder;
