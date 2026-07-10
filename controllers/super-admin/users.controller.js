import bcrypt from 'bcryptjs';
import User from '../../models/user.model.js';
import Tenant from '../../models/tenant.model.js';
import { ROLES } from '../../config/permissions.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { logSuperAdminAction } from '../../utils/superAdminAudit.js';
import { mirrorUserToSqlSafe } from '../../utils/sqlMirror.js';

const MANAGEABLE_ROLES = [...ROLES];

export const listUsers = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(5, Number(req.query.limit) || 15));
  const skip = (page - 1) * limit;
  const role = req.query.role;
  const q = String(req.query.q || '').trim();
  const schoolId = req.query.schoolId;

  const filter = {};
  if (role) filter.role = role;
  if (schoolId) filter.tenantId = schoolId;
  if (q) {
    filter.$or = [
      { name: new RegExp(q, 'i') },
      { email: new RegExp(q, 'i') },
    ];
  }

  const [items, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    User.countDocuments(filter),
  ]);

  const tenantIds = [...new Set(items.map((u) => String(u.tenantId)))];
  const tenants = await Tenant.find({ _id: { $in: tenantIds } }).select('name slug').lean();
  const tenantMap = new Map(tenants.map((t) => [String(t._id), t]));

  res.json({
    items: items.map((u) => ({
      id: u._id,
      name: u.name,
      email: u.email,
      role: u.role,
      status: u.status,
      school: tenantMap.get(String(u.tenantId)) || null,
      createdAt: u.createdAt,
    })),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    roles: MANAGEABLE_ROLES,
  });
});

export const createUser = asyncHandler(async (req, res) => {
  const { name, email, password, role, schoolId } = req.body || {};
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const normalizedRole = String(role || '').trim().toLowerCase();

  if (!name || !normalizedEmail || !password || !normalizedRole) {
    return res.status(400).json({ message: 'name, email, password and role are required' });
  }
  if (!MANAGEABLE_ROLES.includes(normalizedRole)) {
    return res.status(400).json({ message: `Invalid role. Allowed: ${MANAGEABLE_ROLES.join(', ')}` });
  }
  if (String(password).length < 8) {
    return res.status(400).json({ message: 'Password must be at least 8 characters' });
  }
  if (!schoolId) {
    return res.status(400).json({ message: 'schoolId is required' });
  }
  const tenant = await Tenant.findById(schoolId);
  if (!tenant) return res.status(404).json({ message: 'School not found' });

  const dup = await User.findOne({ tenantId: schoolId, email: normalizedEmail });
  if (dup) return res.status(409).json({ message: 'A user with this email already exists in this school' });

  const user = await User.create({
    tenantId: schoolId,
    email: normalizedEmail,
    passwordHash: await bcrypt.hash(String(password), 10),
    name: String(name).trim(),
    role: normalizedRole,
  });
  mirrorUserToSqlSafe({
    name: user.name,
    email: user.email,
    passwordHash: user.passwordHash,
    role: user.role,
    status: user.status,
    tenantRef: tenant.slug,
  });
  await logSuperAdminAction(req, {
    action: 'CREATE',
    module: 'users',
    resourceId: user._id,
    meta: { email: normalizedEmail, role: normalizedRole },
  });
  res.status(201).json({
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    school: { id: tenant._id, name: tenant.name },
  });
});

export const toggleUserBlock = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  user.status = user.status === 'suspended' ? 'active' : 'suspended';
  await user.save();
  await logSuperAdminAction(req, {
    action: user.status === 'active' ? 'UNBLOCK' : 'BLOCK',
    module: 'users',
    resourceId: user._id,
    meta: { email: user.email },
  });
  res.json({ id: user._id, status: user.status });
});

export const resetUserPassword = asyncHandler(async (req, res) => {
  const password = String(req.body?.password || 'Reset@12345');
  if (password.length < 8) {
    return res.status(400).json({ message: 'Password must be at least 8 characters' });
  }
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  user.passwordHash = await bcrypt.hash(password, 10);
  await user.save();
  await logSuperAdminAction(req, {
    action: 'RESET_PASSWORD',
    module: 'users',
    resourceId: user._id,
    meta: { email: user.email },
  });
  res.json({ message: 'Password reset successfully' });
});

export const updateUserRole = asyncHandler(async (req, res) => {
  const role = String(req.body?.role || '').trim();
  if (!MANAGEABLE_ROLES.includes(role)) {
    return res.status(400).json({ message: `Invalid role. Allowed: ${MANAGEABLE_ROLES.join(', ')}` });
  }
  const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true });
  if (!user) return res.status(404).json({ message: 'User not found' });
  mirrorUserToSqlSafe({
    name: user.name,
    email: user.email,
    passwordHash: user.passwordHash,
    role: user.role,
    status: user.status,
    tenantRef: String(user.tenantId),
  });
  await logSuperAdminAction(req, {
    action: 'CHANGE_ROLE',
    module: 'users',
    resourceId: user._id,
    meta: { role, email: user.email },
  });
  res.json({ id: user._id, role: user.role });
});
