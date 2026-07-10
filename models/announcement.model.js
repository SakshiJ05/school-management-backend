import mongoose from 'mongoose';

const announcementSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    body: { type: String, required: true },
    targetType: { type: String, enum: ['all', 'specific'], default: 'all' },
    targetSchoolIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Tenant' }],
    channels: [{ type: String, enum: ['in_app', 'email', 'sms'], default: 'in_app' }],
    sentBy: { type: mongoose.Schema.Types.ObjectId, ref: 'SuperAdmin' },
    sentByName: { type: String, default: 'Super Admin' },
    sentAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

export default mongoose.models.Announcement || mongoose.model('Announcement', announcementSchema);
