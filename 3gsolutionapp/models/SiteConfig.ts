import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ISiteConfig extends Document {
  nomRestaurant: string;
  banniereUrl?: string;
  updatedAt: Date;
}

const SiteConfigSchema = new Schema<ISiteConfig>(
  {
    nomRestaurant: { type: String, required: true, default: 'Mon Restaurant' },
    banniereUrl: { type: String },
  },
  { timestamps: { createdAt: false, updatedAt: true } }
);

const SiteConfig: Model<ISiteConfig> =
  (mongoose.models.SiteConfig as Model<ISiteConfig>) ||
  mongoose.model<ISiteConfig>('SiteConfig', SiteConfigSchema);

export default SiteConfig;
