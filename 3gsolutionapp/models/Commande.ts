import mongoose, { Schema, Document, Model } from 'mongoose';

export type StatutCommande = 'en_attente_paiement' | 'payee' | 'prete';

export interface IProduitSnapshot {
  produitId: mongoose.Types.ObjectId;
  nom: string;       // snapshot au moment de la commande
  prix: number;      // en centimes
  quantite: number;
  options: { nom: string; prix: number }[];
}

export interface ICommande extends Document {
  stripeSessionId: string;
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
  createdAt: Date;
}

const ProduitSnapshotSchema = new Schema<IProduitSnapshot>(
  {
    produitId: { type: Schema.Types.ObjectId, required: true },
    nom: { type: String, required: true },
    prix: { type: Number, required: true },
    quantite: { type: Number, required: true, min: 1 },
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
    statut: {
      type: String,
      enum: ['en_attente_paiement', 'payee', 'prete'] as StatutCommande[],
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
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const Commande: Model<ICommande> =
  (mongoose.models.Commande as Model<ICommande>) ||
  mongoose.model<ICommande>('Commande', CommandeSchema);

export default Commande;
