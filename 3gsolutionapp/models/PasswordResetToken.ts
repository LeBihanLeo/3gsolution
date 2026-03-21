import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IPasswordResetToken extends Document {
  clientId: mongoose.Types.ObjectId;
  // SHA-256 du token brut envoyé par email — jamais le token en clair stocké en base
  tokenHash: string;
  expiresAt: Date;  // TTL index 1h
  used: boolean;    // passé à true atomiquement à la consommation (anti-replay)
  createdAt: Date;
}

const PasswordResetTokenSchema = new Schema<IPasswordResetToken>(
  {
    clientId: { type: Schema.Types.ObjectId, ref: 'Client', required: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    used: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Index TTL — MongoDB supprime automatiquement les tokens expirés
// expireAfterSeconds: 0 → suppression dès que Date.now() >= expiresAt
PasswordResetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const PasswordResetToken: Model<IPasswordResetToken> =
  (mongoose.models.PasswordResetToken as Model<IPasswordResetToken>) ||
  mongoose.model<IPasswordResetToken>('PasswordResetToken', PasswordResetTokenSchema);

export default PasswordResetToken;
