// TICK-144 — Modèle RelayToken : bridge server-to-server → session NextAuth côté client (Sprint 19)
// TTL 10s — juste le temps du chargement de la page /auth/completing, usage unique
import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IRelayToken extends Document {
  token: string;
  userId: string;
  email: string;
  name?: string;
  createdAt: Date;
}

const RelayTokenSchema = new Schema<IRelayToken>(
  {
    token: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true },
    email: { type: String, required: true },
    name: { type: String },
    createdAt: { type: Date, default: Date.now, expires: 10 }, // TTL 10s
  },
  { versionKey: false }
);

const RelayToken: Model<IRelayToken> =
  (mongoose.models.RelayToken as Model<IRelayToken>) ||
  mongoose.model<IRelayToken>('RelayToken', RelayTokenSchema);

export default RelayToken;
