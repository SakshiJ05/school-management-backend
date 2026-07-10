import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    action: { type: String, required: true },
    resource: { type: String, required: true },
    module: { type: String, default: '' },
    resourceId: { type: String, default: '' },
    meta: { type: mongoose.Schema.Types.Mixed },
    ip: { type: String, default: '' },
    actorType: { type: String, enum: ['user', 'super_admin'], default: 'user' },
    actorEmail: { type: String, default: '' },
  },
  { timestamps: true },
);

export default mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema);
