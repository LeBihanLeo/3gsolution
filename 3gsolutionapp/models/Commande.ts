import mongoose, { Schema, Document, Model } from 'mongoose';

export type StatutCommande = 'en_attente_paiement' | 'payee' | 'en_preparation' | 'prete' | 'recuperee' | 'remboursee' | 'partiellement_remboursee' | 'dispute' | 'charge_echouee';

export interface IProduitSnapshot {
  produitId: mongoose.Types.ObjectId;
  nom: string;       // snapshot au moment de la commande
  prix: number;      // en centimes
  quantite: number;
  taux_tva: number;  // 0 | 5.5 | 10 | 20 — snapshot fiscal — TICK-129
  options: { nom: string; prix: number }[];
}

export interface ICommande extends Document {
  stripeSessionId: string;
  // Lien vers le PaymentIntent — utilisé pour relier un remboursement/dispute Stripe à la commande
  stripePaymentIntentId?: string;
  stripeDisputeId?: string;
  statut: StatutCommande;
  client: {
    nom: string;
    telephone: string;
    email?: string;
  };
  retrait: {
    type: 'immediat' | 'creneau';
    creneau?: string; // ex: "12:00 – 12:15" (format TICK-028)
  };
  produits: IProduitSnapshot[];
  commentaire?: string;
  total: number; // en centimes
  // TICK-075 — Lien vers le compte client (null pour commandes invité)
  clientId?: mongoose.Types.ObjectId;
  // TICK-134 — multi-tenant : chaque commande appartient à un restaurant
  restaurantId: mongoose.Types.ObjectId;
  // TICK-057 — RGPD Art. 5(1)(e) : date de purge automatique (createdAt + 12 mois)
  purgeAt: Date;
  // Horodatages de transition d'état
  enPreparationAt?: Date;
  preteAt?: Date;
  // Horodatage de récupération effective (posé par le PATCH statut → recuperee)
  recupereeAt?: Date;
  // Horodatage de remboursement (posé par le webhook charge.refunded)
  rembourseAt?: Date;
  // Montant remboursé en centimes (remboursement partiel ou total)
  montantRembourse?: number;
  // Horodatage de création de la dispute (posé par le webhook charge.dispute.created)
  disputeAt?: Date;
  // URL du reçu Stripe (charge.receipt_url) — stocké à la création de la commande
  receiptUrl?: string;
  // Charge.failed : capture échouée après session complétée (cas rare mais critique)
  chargeEchoueeAt?: Date;
  chargeEchoueeRaison?: string;
  createdAt: Date;
}

const ProduitSnapshotSchema = new Schema<IProduitSnapshot>(
  {
    produitId: { type: Schema.Types.ObjectId, required: true },
    nom: { type: String, required: true },
    prix: { type: Number, required: true },
    quantite: { type: Number, required: true, min: 1 },
    taux_tva: { type: Number, enum: [0, 5.5, 10, 20], default: 10 }, // TICK-129
    options: {
      type: [
        {
          nom: { type: String, required: true },
          prix: { type: Number, required: true },
          _id: false,
        },
      ],
      default: [],
    },
  },
  { _id: false }
);

const CommandeSchema = new Schema<ICommande>(
  {
    stripeSessionId: { type: String, required: true, unique: true },
    stripePaymentIntentId: { type: String, index: true, sparse: true },
    statut: {
      type: String,
      enum: ['en_attente_paiement', 'payee', 'en_preparation', 'prete', 'recuperee', 'remboursee', 'partiellement_remboursee', 'dispute', 'charge_echouee'] as StatutCommande[],
      default: 'en_attente_paiement',
    },
    client: {
      nom: { type: String, required: true },
      telephone: { type: String, required: true },
      email: { type: String },
    },
    retrait: {
      type: {
        type: String,
        enum: ['immediat', 'creneau'],
        required: true,
      },
      creneau: { type: String },
    },
    produits: { type: [ProduitSnapshotSchema], required: true },
    commentaire: { type: String },
    total: { type: Number, required: true, min: 0 },
    // TICK-075 — Référence client (optionnel — null pour commandes invité)
    clientId: { type: Schema.Types.ObjectId, ref: 'Client', index: true },
    // TICK-134 — multi-tenant
    restaurantId: { type: Schema.Types.ObjectId, ref: 'Restaurant', required: true, index: true },
    // TICK-057 — RGPD Art. 5(1)(e) : durée de conservation 12 mois (obligation comptable)
    // Calculée automatiquement si absente (migration des commandes existantes)
    enPreparationAt: { type: Date },
    preteAt: { type: Date },
    recupereeAt: { type: Date, index: true },
    rembourseAt: { type: Date },
    montantRembourse: { type: Number },
    stripeDisputeId: { type: String, index: true, sparse: true },
    disputeAt: { type: Date },
    receiptUrl: { type: String },
    chargeEchoueeAt: { type: Date },
    chargeEchoueeRaison: { type: String },
    purgeAt: {
      type: Date,
      // TTL index : MongoDB supprime automatiquement le document après cette date
      // Note : la suppression TTL supprime le document entier.
      // Si seule l'anonymisation est souhaitée, utiliser le DELETE admin à la place.
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// TICK-060 — RGPD Art. 5(1)(e) : index TTL MongoDB pour suppression automatique des documents expirés
// expireAfterSeconds: 0 → MongoDB supprime le document dès que Date.now() >= purgeAt
// Le daemon TTL s'exécute toutes les 60 s — délai acceptable pour un usage RGPD
// IMPORTANT : l'index doit être créé sur MongoDB Atlas après le premier déploiement.
// Vérification : db.commandes.getIndexes() doit afficher purgeAt_1 avec expireAfterSeconds: 0
CommandeSchema.index({ purgeAt: 1 }, { expireAfterSeconds: 0 });

const Commande: Model<ICommande> =
  (mongoose.models.Commande as Model<ICommande>) ||
  mongoose.model<ICommande>('Commande', CommandeSchema);

export default Commande;
