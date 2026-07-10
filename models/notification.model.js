import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', index: true, default: null },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    message: { type: String, required: true, trim: true, maxlength: 2000 },
    targetRole: {
      type: String,
      enum: ['super_admin', 'admin', 'teacher', 'student', 'all'],
      required: true,
      index: true,
    },
    targetUserId: { type: mongoose.Schema.Types.ObjectId, index: true, default: null },
    isRead: { type: Boolean, default: false },
    readBy: [{ type: mongoose.Schema.Types.ObjectId }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, required: true },
  },
  { timestamps: true },
);

notificationSchema.index({ tenantId: 1, targetRole: 1, createdAt: -1 });
notificationSchema.index({ targetUserId: 1, createdAt: -1 });

export default mongoose.models.Notification || mongoose.model('Notification', notificationSchema);
