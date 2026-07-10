import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import SuperAdmin from '../../models/superAdmin.model.js';
import { signSuperAdminToken } from '../../middleware/superAdmin.middleware.js';
import { logSuperAdminAction } from '../../utils/superAdminAudit.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { DEV_SUPER_ADMIN, DEV_SUPER_ADMIN_ID, devAuthAllowed } from '../../utils/superAdminDev.js';

function devLoginResponse() {
  const token = signSuperAdminToken({
    _id: DEV_SUPER_ADMIN_ID,
    email: DEV_SUPER_ADMIN.email,
  });
  return {
    token,
    user: {
      id: DEV_SUPER_ADMIN_ID,
      email: DEV_SUPER_ADMIN.email,
      name: DEV_SUPER_ADMIN.name,
      role: 'super_admin',
    },
  };
}

export const login = asyncHandler(async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  if (devAuthAllowed() && email === DEV_SUPER_ADMIN.email && password === DEV_SUPER_ADMIN.password) {
    return res.json(devLoginResponse());
  }

  if (mongoose.connection.readyState !== 1) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const admin = await SuperAdmin.findOne({ email });
  if (!admin || admin.status !== 'active') {
    return res.status(401).json({ message: 'Invalid credentials' });
  }
  const ok = await bcrypt.compare(password, admin.passwordHash);
  if (!ok) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }
  admin.lastLoginAt = new Date();
  await admin.save();
  const token = signSuperAdminToken(admin);
  await logSuperAdminAction(
    { superAdmin: admin, ip: req.ip, headers: req.headers },
    { action: 'LOGIN', module: 'auth', meta: { email } },
  );
  res.json({
    token,
    user: { id: admin._id, email: admin.email, name: admin.name, role: 'super_admin' },
  });
});

export const me = asyncHandler(async (req, res) => {
  res.json({
    id: req.superAdmin._id,
    email: req.superAdmin.email,
    name: req.superAdmin.name,
    role: 'super_admin',
    lastLoginAt: req.superAdmin.lastLoginAt,
  });
});
