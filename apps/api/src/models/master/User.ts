import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  email: string;
  password: string;
  role: 'OWNER' | 'MANAGER' | 'EMPLOYEE';
  bakeryId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema: Schema = new Schema(
  {
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['OWNER', 'MANAGER', 'EMPLOYEE'], required: true },
    bakeryId: { type: Schema.Types.ObjectId, ref: 'Bakery' },
  },
  { timestamps: true }
);

// Note: The task mentioned 'password' but described it as 'passwordHash' in Implementation notes or context.
// I'll name the schema field 'password' as per Spec, but it will store the hash.
// I'll keep 'passwordHash' in the interface for clarity if it's what was intended, 
// but actually I'll match the schema for consistency.

export default mongoose.model<IUser>('User', UserSchema);
