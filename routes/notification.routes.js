import express from 'express';
import mongoose from 'mongoose';
import Notification from '../models/notification.model.js';
import User from '../models/user.model.js';
import { authFromRequest } from '../middleware/auth.middleware.js';
import { verifyToken } from '../middleware/superAdmin.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { notificationRole } from '../services/notification.service.js';

const router = express.Router();

function notificationAuth(req, res, next) {
  authFromRequest(req)
    .then((user) => {
      if (user) {
        req.user = user;
        req.tenantId = user.tenantId?.toString?.() || user.tenantId || null;
        return next();
      }
      return verifyToken(req, res, () => {
        req.user = { ...req.superAdmin, role: 'super_admin' };
        req.tenantId = null;
        next();
      });
    })
    .catch(() => res.status(401).json({ message: 'Invalid or expired session' }));
}

function dto(row, userId) {
  const value = row.toObject ? row.toObject() : row;
  const readBy = (value.readBy || []).some((id) => String(id) === String(userId));
  return {
    id: String(value._id),
    title: value.title,
    message: value.message,
    targetRole: value.targetRole,
    targetUserId: value.targetUserId ? String(value.targetUserId) : null,
    isRead: Boolean(value.isRead || readBy),
    read: Boolean(value.isRead || readBy),
    createdAt: value.createdAt,
  };
}

router.use(notificationAuth);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    if (!['super_admin', 'admin', 'school_admin'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Only admin or super admin can create notifications' });
    }
    const { title, message, targetRole, targetUserId } = req.body || {};
    if (!title?.trim() || !message?.trim() || !targetRole) {
      return res.status(400).json({ message: 'title, message and targetRole are required' });
    }
    const allowedTargets = req.user.role === 'super_admin'
      ? ['super_admin', 'admin', 'teacher', 'student', 'all']
      : ['admin', 'teacher', 'student', 'all'];
    if (!allowedTargets.includes(targetRole)) {
      return res.status(400).json({ message: 'Invalid targetRole for this account' });
    }
    if (targetUserId && req.user.role !== 'super_admin') {
      const belongs = await User.exists({ _id: targetUserId, tenantId: req.tenantId });
      if (!belongs) return res.status(400).json({ message: 'Target user is not in your school' });
    }
    const created = await Notification.create({
      tenantId: req.user.role === 'super_admin' ? null : req.tenantId,
      title: title.trim(),
      message: message.trim(),
      targetRole,
      targetUserId: targetUserId || null,
      createdBy: req.user._id || req.user.id,
    });
    res.status(201).json(dto(created, req.user._id || req.user.id));
  }),
);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const userId = req.user._id || req.user.id;
    const role = notificationRole(req.user.role);
    const audience = {
      $or: [
        { targetUserId: userId },
        { targetUserId: null, targetRole: role },
        { targetUserId: null, targetRole: 'all' },
      ],
    };
    const scope = req.user.role === 'super_admin'
      ? { tenantId: null }
      : { $or: [{ tenantId: req.tenantId }, { tenantId: null }] };
    const rows = await Notification.find({ $and: [scope, audience] }).sort({ createdAt: -1 }).limit(100).lean();
    res.json(rows.map((row) => dto(row, userId)));
  }),
);

router.patch(
  '/:id/read',
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Notification not found' });
    const userId = req.user._id || req.user.id;
    const role = notificationRole(req.user.role);
    const audience = {
      $or: [
        { targetUserId: userId },
        { targetUserId: null, targetRole: role },
        { targetUserId: null, targetRole: 'all' },
      ],
    };
    const scope = req.user.role === 'super_admin'
      ? { tenantId: null }
      : { $or: [{ tenantId: req.tenantId }, { tenantId: null }] };
    const updated = await Notification.findOneAndUpdate(
      { _id: req.params.id, $and: [scope, audience] },
      { $addToSet: { readBy: userId } },
      { new: true },
    );
    if (!updated) return res.status(404).json({ message: 'Notification not found' });
    res.json(dto(updated, userId));
  }),
);

export default router;
