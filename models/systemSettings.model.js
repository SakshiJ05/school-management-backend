import mongoose from 'mongoose';

const templateSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    subject: { type: String, default: '' },
    body: { type: String, default: '' },
  },
  { _id: false },
);

const systemSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'global', unique: true },
    schoolYear: { type: String, default: '2025-26' },
    timezone: { type: String, default: 'Asia/Kolkata' },
    currency: { type: String, default: 'INR' },
    maintenanceMode: { type: Boolean, default: false },
    maintenanceMessage: { type: String, default: 'System under maintenance. Please try again later.' },
    emailTemplates: [templateSchema],
    smsTemplates: [templateSchema],
  },
  { timestamps: true },
);

export default mongoose.models.SystemSettings || mongoose.model('SystemSettings', systemSettingsSchema);
