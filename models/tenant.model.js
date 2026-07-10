import mongoose from 'mongoose';

const tenantSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    subdomain: { type: String, default: '', trim: true },
    email: { type: String, default: '', trim: true },
    phone: { type: String, default: '' },
    address: { type: String, default: '' },
    logoUrl: { type: String, default: '' },
    theme: {
      primaryColor: { type: String, default: '#2563eb' },
      secondaryColor: { type: String, default: '#7c3aed' },
      accentColor: { type: String, default: '#059669' },
    },
    plan: { type: String, enum: ['free', 'standard', 'enterprise'], default: 'standard' },
    status: { type: String, enum: ['active', 'suspended'], default: 'active' },
  },
  { timestamps: true },
);

export default mongoose.models.Tenant || mongoose.model('Tenant', tenantSchema);
