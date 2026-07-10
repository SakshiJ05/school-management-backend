import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../models/user.model.js';
import Tenant from '../models/tenant.model.js';
import { readDb } from './db.js';
import { signSession, userToPublic } from '../middleware/auth.middleware.js';

function normalizeSlug(tenantSlug) {
  const slug = String(tenantSlug || 'demo-school').trim().toLowerCase();
  return slug || 'demo-school';
}

async function findUserInMongo(normalizedEmail, password, slug) {
  const user = await User.findOne({ email: normalizedEmail });
  if (!user?.passwordHash || !bcrypt.compareSync(String(password), user.passwordHash)) {
    return null;
  }
  const t = await Tenant.findById(user.tenantId).lean();
  return { user, tenantSlug: t?.slug || slug, source: 'mongo' };
}

function findUserInJson(normalizedEmail, password, slug) {
  const db = readDb();
  const user = (db.users || []).find((u) => String(u.email).toLowerCase() === normalizedEmail);
  if (!user?.passwordHash || !bcrypt.compareSync(String(password), user.passwordHash)) {
    return null;
  }
  const tenant = (db.tenants || []).find((t) => t.id === user.tenantId) || db.tenants?.[0];
  return { user, tenantSlug: tenant?.slug || slug, source: 'json' };
}

export async function findUserForLogin(email, password, tenantSlug) {
  const normalizedEmail = String(email).trim().toLowerCase();
  const slug = normalizeSlug(tenantSlug);

  if (mongoose.connection.readyState === 1) {
    try {
      const mongoHit = await findUserInMongo(normalizedEmail, password, slug);
      if (mongoHit) return mongoHit;
    } catch {
      /* fall through to JSON */
    }
  }

  return findUserInJson(normalizedEmail, password, slug);
}

export function loginResponse({ user, tenantSlug }) {
  const publicUser = user?.toObject?.() ?? user;
  return {
    token: signSession(user, tenantSlug),
    user: userToPublic({ ...publicUser, tenantSlug }),
  };
}
