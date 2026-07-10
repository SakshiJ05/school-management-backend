import mongoose from 'mongoose';

const siteConfigSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, unique: true },
    branding: {
      schoolName: { type: String, default: 'PathshalaPro School' },
      tagline: { type: String, default: '' },
      logoUrl: { type: String, default: '' },
    },
    theme: {
      primaryColor: { type: String, default: '#2563eb' },
      secondaryColor: { type: String, default: '#7c3aed' },
    },
    modules: {
      library: { type: Boolean, default: true },
      transport: { type: Boolean, default: false },
      onlinePayments: { type: Boolean, default: true },
    },
    dynamicPages: [
      {
        key: String,
        title: String,
        content: String,
        updatedAt: Date,
      },
    ],
    smsEnabled: { type: Boolean, default: false },
    emailEnabled: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export default mongoose.models.SiteConfig || mongoose.model('SiteConfig', siteConfigSchema);
