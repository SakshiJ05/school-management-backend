import mongoose from 'mongoose';
import { ROLES } from '../config/permissions.js';

const userSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    role: { type: String, enum: ROLES, required: true },
    phone: { type: String, default: '' },
    avatarUrl: { type: String, default: '' },
    status: { type: String, enum: ['active', 'inactive', 'suspended'], default: 'active' },
    linkedStudentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
    linkedTeacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },
    resetOtpHash: String,
    resetPasswordTokenHash: String,
    resetPasswordExpiresAt: Date,
  },
  { timestamps: true },
);

userSchema.index({ tenantId: 1, email: 1 }, { unique: true });

export default mongoose.models.User || mongoose.model('User', userSchema);
