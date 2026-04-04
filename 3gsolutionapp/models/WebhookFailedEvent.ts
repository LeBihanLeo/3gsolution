// DLQ (Dead Letter Queue) — Événements webhook Stripe ayant échoué
// Permet de rejouer manuellement les événements via le Dashboard admin ou l'API.
// TTL automatique : 30 jours (MongoDB purge les événements résolus ou anciens).
import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IWebhookFailedEvent extends Document {
  stripeEventId: string;   // Identifiant Stripe (idempotence au re-stockage)
  eventType: string;       // ex: "checkout.session.completed"
  payload: string;         // Corps brut du webhook (JSON stringifié) — pour replay
  error: string;           // Message d'erreur qui a causé l'échec
  resolvedAt?: Date;       // Posé manuellement quand le problème est résolu
  createdAt: Date;
}

const WebhookFailedEventSchema = new Schema<IWebhookFailedEvent>(
  {
    stripeEventId: { type: String, required: true, unique: true },
    eventType: { type: String, required: true },
    payload: { type: String, required: true },
    error: { type: String, required: true },
    resolvedAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// TTL index : suppression automatique après 30 jours
// Les événements Stripe ne sont retentés que 3 jours → 30 jours suffisent pour debug
WebhookFailedEventSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 30 * 24 * 60 * 60 }
);

const WebhookFailedEvent: Model<IWebhookFailedEvent> =
  (mongoose.models.WebhookFailedEvent as Model<IWebhookFailedEvent>) ||
  mongoose.model<IWebhookFailedEvent>('WebhookFailedEvent', WebhookFailedEventSchema);

export default WebhookFailedEvent;
