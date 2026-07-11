import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../models/user.model.js';
import Tenant from '../models/tenant.model.js';
import { readDb } from '../utils/db.js';
import { isTokenRevoked } from '../utils/tokenBlacklist.js';
import { devAuthAllowed } from '../utils/superAdminDev.js';

const isProduction = process.env.NODE_ENV === 'production';
// In production JWT_SECRET MUST be provided — never fall back to a public string.
const JWT_SECRET = process.env.JWT_SECRET || (isProduction ? '' : 'edusmart-dev-only-change-me');
if (isProduction && !JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required in production.');
}

export function userToPublic(user) {
  const id = user._id?.toString() || user.id;
  return {
    id,
    email: user.email,
    username: user.username || '',
    name: user.name,
    role: user.role,
    status: user.status || 'active',
    tenantId: user.tenantId?.toString?.() || user.tenantId || '',
    tenantSlug: user.tenantSlug || '',
    avatarUrl: user.avatarUrl || '',
    linkedStudentId: user.linkedStudentId?.toString?.() || user.linkedStudentId || '',
    linkedTeacherId: user.linkedTeacherId?.toString?.() || user.linkedTeacherId || '',
  };
}

export function signSession(user, tenantSlug = '') {
  const sub = user._id?.toString() || user.id;
  const tenantId = user.tenantId?.toString?.() || user.tenantId;
  return jwt.sign(
    { sub, role: user.role, tenantId, tenantSlug, purpose: 'session' },
    JWT_SECRET,
    // No refresh token on this route, so the session token itself must outlive
    // normal usage gaps. Shorten via JWT_EXPIRES_IN if that trade-off changes.
    { expiresIn: process.env.JWT_EXPIRES_IN || '30d' },
  );
}

async function resolveJsonUser(token) {
  const db = readDb();
  if (token === 'demo-token') {
    if (!devAuthAllowed()) return null;
    return db.users.find((u) => u.role === 'admin') || db.users[0] || null;
  }
  const payload = jwt.verify(token, JWT_SECRET);
  if (payload.purpose && payload.purpose !== 'session') return null;
  const user = db.users.find((u) => u.id === payload.sub);
  if (user) {
    user.tenantId = user.tenantId || payload.tenantId || 'tenant_demo';
    user.tenantSlug = user.tenantSlug || payload.tenantSlug || 'demo-school';
  }
  return user;
}

async function resolveMongoUser(token) {
  if (token === 'demo-token' && mongoose.connection.readyState === 1) {
    if (!devAuthAllowed()) return null;
    const admin = await User.findOne({ role: 'admin' }).lean();
    return admin;
  }
  const payload = jwt.verify(token, JWT_SECRET);
  if (payload.purpose && payload.purpose !== 'session') return null;
  const user = await User.findById(payload.sub).lean();
  if (!user) return null;
  if (payload.tenantId && String(user.tenantId) !== String(payload.tenantId)) return null;
  const tenant = await Tenant.findById(user.tenantId).lean();
  user.tenantSlug = tenant?.slug || payload.tenantSlug || '';
  return user;
}

export async function authFromRequest(req) {
  const auth = req.headers.authorization || '';
  const m = /^Bearer\s+(.+)$/i.exec(auth);
  if (!m) return null;
  const token = m[1].trim();
  if (isTokenRevoked(token)) return null;
  try {
    if (mongoose.connection.readyState === 1) {
      const mongoUser = await resolveMongoUser(token);
      if (mongoUser) return mongoUser;
    }
    return await resolveJsonUser(token);
  } catch {
    try {
      return await resolveJsonUser(token);
    } catch {
      return null;
    }
  }
}

export function requireAuth(req, res, next) {
  authFromRequest(req)
    .then((user) => {
      if (!user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      if (user.status && user.status !== 'active') {
        return res.status(403).json({ message: 'Account is not active' });
      }
      req.user = user;
      req.tenantId = user.tenantId?.toString?.() || user.tenantId;
      next();
    })
    .catch(() => res.status(401).json({ message: 'Invalid or expired session' }));
}

export function optionalAuth(req, _res, next) {
  authFromRequest(req)
    .then((user) => {
      if (user) {
        req.user = user;
        req.tenantId = user.tenantId?.toString?.() || user.tenantId;
      }
      next();
    })
    .catch(() => next());
}

export { JWT_SECRET, bcrypt };
