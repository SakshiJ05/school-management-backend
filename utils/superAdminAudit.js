import mongoose from 'mongoose';
import AuditLog from '../models/auditLog.model.js';

export async function logSuperAdminAction(req, { action, module, resourceId = '', meta = {} }) {
  if (mongoose.connection.readyState !== 1 || !req.superAdmin) return;
  try {
    await AuditLog.create({
      userId: req.superAdmin._id,
      actorType: 'super_admin',
      actorEmail: req.superAdmin.email,
      action,
      resource: module,
      module,
      resourceId: String(resourceId),
      meta,
      ip: req.ip || req.headers['x-forwarded-for'] || '',
    });
  } catch {
    /* non-blocking */
  }
}
