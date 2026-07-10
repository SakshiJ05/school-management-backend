import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { jwtConfig } from '../config/jwt.js';
import { RefreshToken } from '../models/index.js';

export function signAccessToken(user, school = null) {
  const payload = {
    sub: user.id,
    role: user.role,
    email: user.email,
    schoolId: user.school_id || null,
    schoolCode: school?.code || null,
    purpose: 'access',
  };
  return jwt.sign(payload, jwtConfig.accessSecret, { expiresIn: jwtConfig.accessExpiresIn });
}

export function signRefreshTokenValue() {
  return crypto.randomBytes(48).toString('hex');
}

export async function storeRefreshToken(userId, token, expiresAt) {
  await RefreshToken.create({ user_id: userId, token, expires_at: expiresAt });
}

export async function revokeRefreshToken(token) {
  await RefreshToken.destroy({ where: { token } });
}

export async function revokeAllUserTokens(userId) {
  await RefreshToken.destroy({ where: { user_id: userId } });
}

export function verifyAccessToken(token) {
  const payload = jwt.verify(token, jwtConfig.accessSecret);
  if (payload.purpose !== 'access') throw new Error('Invalid token type');
  return payload;
}

export function refreshExpiresAt() {
  const ms = parseDuration(jwtConfig.refreshExpiresIn);
  return new Date(Date.now() + ms);
}

function parseDuration(str) {
  const m = /^(\d+)([smhd])$/.exec(str || '7d');
  if (!m) return 7 * 24 * 60 * 60 * 1000;
  const n = Number(m[1]);
  const unit = { s: 1000, m: 60000, h: 3600000, d: 86400000 }[m[2]];
  return n * unit;
}

export function setRefreshCookie(res, token) {
  res.cookie(jwtConfig.cookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: parseDuration(jwtConfig.refreshExpiresIn),
    path: '/api/auth',
  });
}

export function clearRefreshCookie(res) {
  res.clearCookie(jwtConfig.cookieName, { path: '/api/auth' });
}
