import mongoose from 'mongoose';

const superAdminSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    status: { type: String, enum: ['active', 'blocked'], default: 'active' },
    lastLoginAt: Date,
  },
  { timestamps: true },
);

export default mongoose.models.SuperAdmin || mongoose.model('SuperAdmin', superAdminSchema);
