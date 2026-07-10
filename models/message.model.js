import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    fromUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    toUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
    subject: { type: String, default: '' },
    body: { type: String, required: true },
    readAt: { type: Date },
  },
  { timestamps: true },
);

// Inbox/outbox lookups are keyed by participant within a tenant.
messageSchema.index({ tenantId: 1, toUserId: 1, createdAt: -1 });
messageSchema.index({ tenantId: 1, fromUserId: 1, createdAt: -1 });

export default mongoose.models.Message || mongoose.model('Message', messageSchema);
