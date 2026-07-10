import mongoose from 'mongoose';
import AuditLog from '../models/auditLog.model.js';

export function audit(action, resource) {
  return (req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      if (res.statusCode < 400 && mongoose.connection.readyState === 1 && req.user) {
        AuditLog.create({
          tenantId: req.tenantId,
          userId: req.user._id || req.user.id,
          action,
          resource,
          resourceId: req.params?.id || body?.id || '',
          meta: { method: req.method, path: req.path },
          ip: req.ip,
        }).catch(() => {});
      }
      return originalJson(body);
    };
    next();
  };
}
