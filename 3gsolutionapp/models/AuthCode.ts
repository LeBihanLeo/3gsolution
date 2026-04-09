// TICK-143 — Modèle AuthCode : code opaque échangé dans le flow OAuth cross-domain (Sprint 19)
// Usage unique, TTL 30s, jamais exposé dans les URLs (Auth Code Exchange pattern)
import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IAuthCode extends Document {
  code: string;
  userId: string;
  email: string;
  name?: string;
  returnTo: string; // domaine restaurant validé par assertKnownDomain
  createdAt: Date;
}

const AuthCodeSchema = new Schema<IAuthCode>(
  {
    code: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true },
    email: { type: String, required: true },
    name: { type: String },
    returnTo: { type: String, required: true },
    createdAt: { type: Date, default: Date.now, expires: 30 }, // TTL 30s via index MongoDB
  },
  { versionKey: false }
);

const AuthCode: Model<IAuthCode> =
  (mongoose.models.AuthCode as Model<IAuthCode>) ||
  mongoose.model<IAuthCode>('AuthCode', AuthCodeSchema);

export default AuthCode;
