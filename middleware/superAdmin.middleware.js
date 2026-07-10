import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import SuperAdmin from '../models/superAdmin.model.js';
import { JWT_SECRET } from './auth.middleware.js';
import { DEV_SUPER_ADMIN, DEV_SUPER_ADMIN_ID, devAuthAllowed } from '../utils/superAdminDev.js';

export function signSuperAdminToken(admin) {
  return jwt.sign(
    {
      sub: admin._id.toString(),
      role: 'super_admin',
      purpose: 'super_admin_session',
      email: admin.email,
    },
    JWT_SECRET,
    { expiresIn: process.env.SUPER_ADMIN_JWT_EXPIRES_IN || '8h' },
  );
}

export async function verifyToken(req, res, next) {
  const auth = req.headers.authorization || '';
  const m = /^Bearer\s+(.+)$/i.exec(auth);
  if (!m) {
    return res.status(401).json({ message: 'Unauthorized — token required' });
  }
  try {
    const payload = jwt.verify(m[1].trim(), JWT_SECRET);
    if (payload.purpose !== 'super_admin_session' || payload.role !== 'super_admin') {
      return res.status(401).json({ message: 'Invalid super admin session' });
    }
    if (devAuthAllowed() && payload.sub === DEV_SUPER_ADMIN_ID && payload.email === DEV_SUPER_ADMIN.email) {
      req.superAdmin = {
        _id: DEV_SUPER_ADMIN_ID,
        email: DEV_SUPER_ADMIN.email,
        name: DEV_SUPER_ADMIN.name,
        status: 'active',
      };
      return next();
    }
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: 'Database unavailable' });
    }
    const admin = await SuperAdmin.findById(payload.sub).lean();
    if (!admin || admin.status !== 'active') {
      return res.status(401).json({ message: 'Super admin account inactive or not found' });
    }
    req.superAdmin = admin;
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

export function isSuperAdmin(req, res, next) {
  if (!req.superAdmin) {
    return res.status(403).json({ message: 'Super admin access required' });
  }
  next();
}
