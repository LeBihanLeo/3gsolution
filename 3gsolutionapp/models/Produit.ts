import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IOption {
  nom: string;
  prix: number; // en centimes
}

export interface IProduit extends Document {
  nom: string;
  description: string;
  categorie: string;
  prix: number; // en centimes (ex: 850 = 8,50€)
  taux_tva: 0 | 5.5 | 10 | 20; // taux TVA applicable — défaut 10 (restauration standard) — TICK-126
  options: IOption[];
  imageUrl?: string; // URL Vercel Blob (optionnel) — TICK-036
  actif: boolean;
  createdAt: Date;
}

const OptionSchema = new Schema<IOption>(
  {
    nom: { type: String, required: true },
    prix: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const ProduitSchema = new Schema<IProduit>(
  {
    nom: { type: String, required: true },
    description: { type: String, required: true },
    categorie: { type: String, required: true },
    prix: { type: Number, required: true, min: 0 },
    taux_tva: { type: Number, enum: [0, 5.5, 10, 20], default: 10, required: true }, // TICK-126
    options: { type: [OptionSchema], default: [] },
    imageUrl: { type: String }, // optionnel — TICK-036
    actif: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const Produit: Model<IProduit> =
  (mongoose.models.Produit as Model<IProduit>) ||
  mongoose.model<IProduit>('Produit', ProduitSchema);

export default Produit;
