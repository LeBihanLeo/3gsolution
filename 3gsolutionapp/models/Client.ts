// TICK-065 — Modèle Mongoose Client
import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IClient extends Document {
  _id: mongoose.Types.ObjectId;
  email: string;
  nom: string; // TICK-087 — obligatoire
  telephone?: string;
  passwordHash?: string;
  provider: 'credentials' | 'google' | 'both';
  emailVerified: boolean;
  emailVerifyToken?: string;
  emailVerifyTokenExpiry?: Date;
  passwordResetToken?: string;
  passwordResetTokenExpiry?: Date;
  role: 'client';
  createdAt: Date;
  updatedAt: Date;
}

const ClientSchema = new Schema<IClient>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    nom: { type: String, required: true, trim: true }, // TICK-087 — obligatoire
    telephone: { type: String, trim: true },
    passwordHash: { type: String },
    provider: {
      type: String,
      enum: ['credentials', 'google', 'both'],
      required: true,
    },
    emailVerified: { type: Boolean, default: false, required: true },
    emailVerifyToken: { type: String },
    emailVerifyTokenExpiry: { type: Date },
    passwordResetToken: { type: String },
    passwordResetTokenExpiry: { type: Date },
    role: {
      type: String,
      enum: ['client'],
      default: 'client',
      immutable: true,
    },
  },
  { timestamps: true }
);

const Client: Model<IClient> =
  (mongoose.models.Client as Model<IClient>) ||
  mongoose.model<IClient>('Client', ClientSchema);

export default Client;
