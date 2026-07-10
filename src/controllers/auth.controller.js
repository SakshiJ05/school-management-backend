import bcrypt from 'bcryptjs';
import { Op } from 'sequelize';
import { User, School, RefreshToken, AuditLog } from '../models/index.js';
import { comparePassword, hashPassword } from '../utils/password.js';
import { jwtConfig } from '../config/jwt.js';
import { sendOtpEmail } from '../services/mail.service.js';
import {
  signAccessToken,
  signRefreshTokenValue,
  storeRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens,
  refreshExpiresAt,
  setRefreshCookie,
  clearRefreshCookie,
} from '../services/token.service.js';
import { ok, fail } from '../utils/apiResponse.js';
const registerOtpStore = new Map();
const OTP_TTL_MS = 10 * 60 * 1000;
const REGISTER_ROLES = new Set(['school_admin', 'teacher', 'student', 'parent']);

function normalizeRole(role) {
  const normalized = String(role || '').trim().toLowerCase();
  return normalized === 'admin' ? 'school_admin' : normalized;
}

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function storeOtp(email, otp) {
  registerOtpStore.set(email, {
    hash: bcrypt.hashSync(otp, 10),
    expiresAt: Date.now() + OTP_TTL_MS,
  });
}

function verifyStoredOtp(email, otp) {
  const entry = registerOtpStore.get(email);
  if (!entry || entry.expiresAt < Date.now()) {
    registerOtpStore.delete(email);
    return false;
  }
  return bcrypt.compareSync(otp, entry.hash);
}

function publicUser(user, school = null) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    schoolId: user.school_id,
    schoolCode: school?.code || null,
    schoolName: school?.name || null,
    schoolSubdomain: school?.subdomain || null,
    lastLogin: user.last_login,
  };
}

async function writeAudit(userId, schoolId, action, module, req, details = {}) {
  await AuditLog.create({
    user_id: userId,
    school_id: schoolId,
    action,
    module,
    details,
    ip_address: req.ip || req.headers['x-forwarded-for'] || '',
  });
}

export async function requestRegisterOtp(req, res) {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!email) return fail(res, 'Email is required', 400);

    const exists = await User.findOne({ where: { email } });
    if (exists) return fail(res, 'Email already registered', 409);

    const otp = generateOtp();
    storeOtp(email, otp);
    const mail = await sendOtpEmail(email, otp, 'account verification');

    return ok(
      res,
      {
        sent: true,
        devOtp: mail.dev ? otp : undefined,
      },
      mail.dev ? 'OTP generated. Check backend console in dev mode.' : 'OTP sent to your email',
    );
  } catch (err) {
    console.error('Register OTP error:', err);
    return fail(res, 'Could not send OTP', 500);
  }
}

export async function register(req, res) {
  try {
    const name = String(req.body?.name || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const role = normalizeRole(req.body?.role || 'student');
    const otp = String(req.body?.otp || '').trim();
    const schoolCode = String(req.body?.schoolCode || req.body?.school_code || '').trim().toUpperCase();

    if (!name || !email || !password || !role || !otp) {
      return fail(res, 'Name, email, password, role, and OTP are required', 400);
    }
    if (!REGISTER_ROLES.has(role)) {
      return fail(res, 'Invalid role for registration', 400);
    }
    if (password.length < 8) {
      return fail(res, 'Password must be at least 8 characters', 400);
    }
    if (!verifyStoredOtp(email, otp)) {
      return fail(res, 'Invalid or expired OTP', 400);
    }

    const exists = await User.findOne({ where: { email } });
    if (exists) return fail(res, 'Email already registered', 409);

    let school = null;
    if (schoolCode) {
      school = await School.findOne({ where: { code: schoolCode } });
      if (!school || school.status !== 'active') return fail(res, 'School code is invalid or inactive', 400);
    }

    const user = await User.create({
      school_id: school?.id || null,
      name,
      email,
      password: await hashPassword(password),
      role,
      status: 'active',
    });

    registerOtpStore.delete(email);

    const accessToken = signAccessToken(user, school);
    const refreshToken = signRefreshTokenValue();
    await storeRefreshToken(user.id, refreshToken, refreshExpiresAt());
    setRefreshCookie(res, refreshToken);
    await writeAudit(user.id, user.school_id, 'REGISTER', 'auth', req, { email, role });

    return ok(res, { accessToken, user: publicUser(user, school) }, 'Account created', 201);
  } catch (err) {
    console.error('Register error:', err);
    return fail(res, 'Registration failed', 500);
  }
}
export async function login(req, res) {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const schoolCode = String(req.body?.schoolCode || req.body?.school_code || '').trim().toUpperCase();

    if (!email || !password) {
      return fail(res, 'Email and password are required', 400);
    }

    const user = await User.findOne({ where: { email } });
    if (!user) return fail(res, 'Invalid credentials', 401);
    if (user.status === 'blocked') return fail(res, 'Account is blocked', 403);

    const valid = await comparePassword(password, user.password);
    if (!valid) return fail(res, 'Invalid credentials', 401);

    let school = null;
    if (user.role !== 'super_admin') {
      if (!user.school_id) return fail(res, 'User not assigned to a school', 403);
      school = await School.findByPk(user.school_id);
      if (!school || school.status !== 'active') {
        return fail(res, 'School is inactive or not found', 403);
      }
      if (schoolCode && school.code.toUpperCase() !== schoolCode) {
        return fail(res, 'School code does not match this account', 401);
      }
    }

    user.last_login = new Date();
    await user.save();

    const accessToken = signAccessToken(user, school);
    const refreshToken = signRefreshTokenValue();
    await storeRefreshToken(user.id, refreshToken, refreshExpiresAt());
    setRefreshCookie(res, refreshToken);

    await writeAudit(user.id, user.school_id, 'LOGIN', 'auth', req, { email });

    return ok(res, {
      accessToken,
      user: publicUser(user, school),
    }, 'Login successful');
  } catch (err) {
    console.error('Login error:', err);
    return fail(res, 'Login failed', 500);
  }
}

export async function refresh(req, res) {
  try {
    const token = req.cookies?.[jwtConfig.cookieName] || req.body?.refreshToken;
    if (!token) return fail(res, 'Refresh token required', 401);

    const row = await RefreshToken.findOne({
      where: { token, expires_at: { [Op.gt]: new Date() } },
    });
    if (!row) return fail(res, 'Invalid refresh token', 401);

    const user = await User.findByPk(row.user_id);
    if (!user || user.status === 'blocked') return fail(res, 'Account unavailable', 401);

    const school = user.school_id ? await School.findByPk(user.school_id) : null;

    await revokeRefreshToken(token);
    const newRefresh = signRefreshTokenValue();
    await storeRefreshToken(user.id, newRefresh, refreshExpiresAt());
    setRefreshCookie(res, newRefresh);

    const accessToken = signAccessToken(user, school);
    return ok(res, { accessToken, user: publicUser(user, school) }, 'Token refreshed');
  } catch (err) {
    console.error('Refresh error:', err);
    return fail(res, 'Refresh failed', 500);
  }
}

export async function logout(req, res) {
  try {
    const token = req.cookies?.[jwtConfig.cookieName] || req.body?.refreshToken;
    if (token) await revokeRefreshToken(token);
    if (req.user) {
      await writeAudit(req.user.id, req.user.school_id, 'LOGOUT', 'auth', req);
    }
    clearRefreshCookie(res);
    return ok(res, null, 'Logged out');
  } catch {
    clearRefreshCookie(res);
    return ok(res, null, 'Logged out');
  }
}

export async function me(req, res) {
  return ok(res, { user: publicUser(req.user, req.school) });
}

export async function forgotPassword(req, res) {
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!email) return fail(res, 'Email is required', 400);
  // OTP flow stub — always success to avoid email enumeration
  return ok(res, { sent: true }, 'If the email exists, an OTP has been sent');
}

export async function resetPassword(req, res) {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const otp = String(req.body?.otp || '');

  if (!email || !password) return fail(res, 'Email and new password are required', 400);
  if (process.env.NODE_ENV !== 'production' && otp !== '123456') {
    return fail(res, 'Invalid OTP (dev: use 123456)', 400);
  }

  const user = await User.findOne({ where: { email } });
  if (!user) return fail(res, 'User not found', 404);

  user.password = await bcrypt.hash(password, 10);
  await user.save();
  await revokeAllUserTokens(user.id);
  await writeAudit(user.id, user.school_id, 'RESET_PASSWORD', 'auth', req);

  return ok(res, null, 'Password updated');
}
