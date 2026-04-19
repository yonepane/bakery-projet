import mongoose, { Schema, Document } from 'mongoose';

export interface IBakery extends Document {
  name: string;
  subdomain: string;
  tenantDbUri: string;
  plan: 'FREE' | 'PRO';
  createdAt: Date;
  updatedAt: Date;
}

const BakerySchema: Schema = new Schema(
  {
    name: { type: String, required: true },
    subdomain: { type: String, required: true, unique: true },
    tenantDbUri: { type: String, required: true },
    plan: { type: String, enum: ['FREE', 'PRO'], default: 'FREE' },
  },
  { timestamps: true }
);

export default mongoose.model<IBakery>('Bakery', BakerySchema);
