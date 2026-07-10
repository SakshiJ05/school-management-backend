import AuditLog from '../../models/auditLog.model.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const listAuditLogs = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(10, Number(req.query.limit) || 25));
  const skip = (page - 1) * limit;
  const { action, user, module: mod, from, to } = req.query;

  const filter = {};
  if (action) filter.action = new RegExp(String(action), 'i');
  if (mod) filter.module = new RegExp(String(mod), 'i');
  if (user) {
    filter.$or = [
      { actorEmail: new RegExp(String(user), 'i') },
    ];
  }
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) filter.createdAt.$lte = new Date(to);
  }

  const [items, total] = await Promise.all([
    AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    AuditLog.countDocuments(filter),
  ]);

  res.json({
    items: items.map((log) => ({
      id: log._id,
      user: log.actorEmail || log.userId || '—',
      action: log.action,
      module: log.module || log.resource,
      timestamp: log.createdAt,
      ip: log.ip,
      meta: log.meta,
    })),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});
