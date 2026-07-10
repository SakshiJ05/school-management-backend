import Announcement from '../../models/announcement.model.js';
import Tenant from '../../models/tenant.model.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { logSuperAdminAction } from '../../utils/superAdminAudit.js';

export const listAnnouncements = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Number(req.query.limit) || 20);
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    Announcement.find().sort({ sentAt: -1 }).skip(skip).limit(limit).lean(),
    Announcement.countDocuments(),
  ]);
  res.json({
    items: items.map((a) => ({ id: a._id, ...a })),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

export const sendAnnouncement = asyncHandler(async (req, res) => {
  const { title, body, targetType, targetSchoolIds, channels } = req.body || {};
  if (!title || !body) {
    return res.status(400).json({ message: 'Title and body are required' });
  }
  const type = targetType === 'specific' ? 'specific' : 'all';
  let schoolIds = [];
  if (type === 'specific') {
    schoolIds = Array.isArray(targetSchoolIds) ? targetSchoolIds : [];
    if (!schoolIds.length) {
      return res.status(400).json({ message: 'Select at least one school' });
    }
    const count = await Tenant.countDocuments({ _id: { $in: schoolIds } });
    if (count !== schoolIds.length) {
      return res.status(400).json({ message: 'One or more schools not found' });
    }
  }

  const announcement = await Announcement.create({
    title: String(title).trim(),
    body: String(body).trim(),
    targetType: type,
    targetSchoolIds: schoolIds,
    channels: Array.isArray(channels) ? channels : ['in_app'],
    sentBy: req.superAdmin._id,
    sentByName: req.superAdmin.name,
    sentAt: new Date(),
  });

  await logSuperAdminAction(req, {
    action: 'SEND',
    module: 'announcements',
    resourceId: announcement._id,
    meta: { targetType: type, schools: schoolIds.length || 'all' },
  });

  res.status(201).json({ id: announcement._id, ...announcement.toObject() });
});
