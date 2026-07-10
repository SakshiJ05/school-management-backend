import mongoose from 'mongoose';
import Notification from '../models/notification.model.js';
import User from '../models/user.model.js';

export function notificationRole(role) {
  if (['admin', 'school_admin', 'principal', 'accountant'].includes(role)) return 'admin';
  if (role === 'parent') return 'student';
  return role;
}

export async function createNotification(data) {
  if (mongoose.connection.readyState !== 1) return null;
  return Notification.create(data);
}

export async function notifyTenantAdmins({ tenantId, title, message, createdBy }) {
  if (!tenantId || !createdBy) return null;
  return createNotification({ tenantId, title, message, targetRole: 'admin', createdBy });
}

export async function notifySuperAdmins({ title, message, createdBy }) {
  if (!createdBy) return null;
  return createNotification({ tenantId: null, title, message, targetRole: 'super_admin', createdBy });
}

export async function notifyLinkedStudent({ tenantId, studentId, title, message, createdBy }) {
  if (!tenantId || !studentId || !createdBy || mongoose.connection.readyState !== 1) return null;
  const user = await User.findOne({ tenantId, linkedStudentId: studentId, status: 'active' }).select('_id').lean();
  if (!user) return null;
  return createNotification({
    tenantId,
    title,
    message,
    targetRole: 'student',
    targetUserId: user._id,
    createdBy,
  });
}

export function notifySafely(promise, context) {
  Promise.resolve(promise).catch((err) => console.warn(`Notification skipped (${context}):`, err.message));
}
