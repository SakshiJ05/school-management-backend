import mongoose from 'mongoose';

const noticeSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    title: { type: String, required: true },
    body: { type: String, required: true },
    priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    audience: { type: [String], default: ['all'] },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    channels: { type: [String], default: ['in-app'] },
    publishedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

export default mongoose.models.Notice || mongoose.model('Notice', noticeSchema);
