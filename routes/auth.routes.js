import express from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../models/user.model.js';
import Tenant from '../models/tenant.model.js';
import { readDb, writeDb } from '../utils/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { findUserForLogin, loginResponse } from '../utils/authStore.js';
import {
  requireAuth,
  signSession,
  userToPublic,
  JWT_SECRET,
  authFromRequest,
} from '../middleware/auth.middleware.js';
import { ROLES } from '../config/permissions.js';
import { revokeToken } from '../utils/tokenBlacklist.js';
import { sendOtpEmail, isMailConfigured } from '../services/mail.service.js';
import { mirrorUserToSqlSafe } from '../utils/sqlMirror.js';
import { devAuthAllowed } from '../utils/superAdminDev.js';
import { rateLimit, loginRateLimit } from '../middleware/rateLimit.middleware.js';

const router = express.Router();
const VALID_ROLES = new Set(ROLES);

// Throttle OTP generation (email spam / enumeration) and OTP verification (brute force).
const otpRequestLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyFn: (req) => `otp-req:${req.ip}:${String(req.body?.email || '').toLowerCase()}`,
});
const otpVerifyLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyFn: (req) => `otp-verify:${req.ip}:${String(req.body?.email || '').toLowerCase()}`,
});

function makeId(prefix) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

router.post(
  '/login',
  loginRateLimit,
  asyncHandler(async (req, res) => {
    const { email, password, tenantSlug } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }
    const found = await findUserForLogin(email, password, tenantSlug);
    if (!found) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    if (found.user.status && found.user.status !== 'active') {
      return res.status(403).json({ message: 'Account is not active' });
    }
    res.json(loginResponse(found));
  }),
);

router.get(
  '/me',
  asyncHandler(async (req, res) => {
    const user = await authFromRequest(req);
    if (!user) return res.status(401).json({ message: 'Unauthorized' });
    res.json(userToPublic(user));
  }),
);

router.post(
  '/logout',
  asyncHandler(async (req, res) => {
    const auth = req.headers.authorization || '';
    const m = /^Bearer\s+(.+)$/i.exec(auth);
    if (m) revokeToken(m[1].trim());
    res.json({ message: 'Logged out successfully' });
  }),
);


// In-memory store for registration OTPs (keyed by email)
const registerOtpStore = new Map();

router.post(
  '/register/request-otp',
  otpRequestLimit,
  asyncHandler(async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    // Check if email already registered
    if (mongoose.connection.readyState === 1) {
      const exists = await User.findOne({ email });
      if (exists) return res.status(409).json({ message: 'Email already registered' });
    } else {
      const db = readDb();
      if (db.users.some((u) => String(u.email).toLowerCase() === email)) {
        return res.status(409).json({ message: 'Email already registered' });
      }
    }

    // With no SMTP configured the code could never reach the user, and `/register`
    // would then reject every attempt against an OTP nobody can read. Skip the
    // challenge entirely rather than locking signup shut.
    if (!isMailConfigured()) {
      console.warn('[AUTH] SMTP not configured — registration OTP skipped for', email);
      return res.json({
        message: 'Email verification is unavailable. Continue to create your account.',
        data: { sent: false, otpRequired: false },
      });
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = Date.now() + 90 * 1000; // 90 seconds (buffer for email delivery)

    const result = await sendOtpEmail(email, otp, 'registration');
    if (!result.sent) {
      // Delivery failed (blocked port, bad credentials). Blocking signup on an OTP
      // the user can never read helps nobody — skip the challenge, as when SMTP
      // is absent, and leave the failure in the logs.
      console.warn('[AUTH] OTP email failed — registration OTP skipped for', email);
      return res.json({
        message: 'Email verification is unavailable. Continue to create your account.',
        data: { sent: false, otpRequired: false },
      });
    }

    // Store only after delivery, so a failed send never blocks the next attempt.
    registerOtpStore.set(email, { otpHash: bcrypt.hashSync(otp, 10), expiresAt });
    res.json({ message: 'OTP sent to your email', data: { sent: true, otpRequired: true } });
  }),
);

router.post(
  '/register',
  otpVerifyLimit,
  asyncHandler(async (req, res) => {
    const { email, password, name, role, tenantSlug, schoolCode, otp } = req.body || {};
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const normalizedRole = String(role || '').trim().toLowerCase();
    // The signup form calls this field `schoolCode`; accept either name.
    const slug = String(tenantSlug || schoolCode || '').trim().toLowerCase() || 'demo-school';

    // Verify registration OTP if store has it
    const stored = registerOtpStore.get(normalizedEmail);
    if (stored) {
      if (Date.now() > stored.expiresAt) {
        registerOtpStore.delete(normalizedEmail);
        return res.status(400).json({ message: 'OTP has expired' });
      }
      if (!otp || !bcrypt.compareSync(String(otp), stored.otpHash)) {
        return res.status(400).json({ message: 'Invalid OTP' });
      }
      registerOtpStore.delete(normalizedEmail);
    }

    if (!name || !normalizedEmail || !password || !normalizedRole) {
      return res.status(400).json({ message: 'Name, email, password, and role are required' });
    }
    if (!VALID_ROLES.has(normalizedRole)) {
      return res.status(400).json({ message: `Role must be one of: ${ROLES.join(', ')}` });
    }
    if (String(password).length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }

    if (mongoose.connection.readyState === 1) {
      let tenant = await Tenant.findOne({ slug });
      // DEMO onboarding: a School Admin may create their school together with
      // the first admin account. Staff/student roles must join an existing code.
      if (!tenant && normalizedRole === 'school_admin') {
        tenant = await Tenant.create({
          name: `${String(name).trim()}'s School`,
          slug,
          email: normalizedEmail,
          status: 'active',
          plan: 'standard',
        });
      }
      if (!tenant) {
        return res.status(400).json({
          message: `No school found with code "${slug}". Ask your School Admin for the correct code.`,
        });
      }
      const exists = await User.findOne({ tenantId: tenant._id, email: normalizedEmail });
      if (exists) return res.status(409).json({ message: 'Email already registered' });
      const user = await User.create({
        tenantId: tenant._id,
        email: normalizedEmail,
        passwordHash: bcrypt.hashSync(String(password), 10),
        role: normalizedRole,
        name: String(name).trim(),
      });
      mirrorUserToSqlSafe({
        name: user.name,
        email: user.email,
        passwordHash: user.passwordHash,
        role: user.role,
        status: user.status,
        tenantRef: tenant.slug,
      });
      const pub = userToPublic({ ...user.toObject(), tenantSlug: tenant.slug });
      return res.status(201).json({ token: signSession(user, tenant.slug), user: pub });
    }

    const db = readDb();
    if (db.users.some((u) => String(u.email).toLowerCase() === normalizedEmail)) {
      return res.status(409).json({ message: 'Email already exists' });
    }
    const tenant = (db.tenants || [])[0];
    const user = {
      id: makeId('u'),
      tenantId: tenant?.id || 'tenant_demo',
      tenantSlug: tenant?.slug || 'demo-school',
      email: normalizedEmail,
      passwordHash: bcrypt.hashSync(String(password), 10),
      role: normalizedRole,
      name: String(name).trim(),
      status: 'active',
    };
    db.users.push(user);
    writeDb(db);
    mirrorUserToSqlSafe({
      name: user.name,
      email: user.email,
      passwordHash: user.passwordHash,
      role: user.role,
      status: user.status,
      tenantRef: user.tenantSlug,
    });
    res.status(201).json({ token: signSession(user), user: userToPublic(user) });
  }),
);

router.post(
  '/forgot-password',
  otpRequestLimit,
  asyncHandler(async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const message = 'If an account exists, reset instructions have been generated.';
    if (mongoose.connection.readyState === 1) {
      const user = await User.findOne({ email });
      if (!user) return res.json({ message });
      const otp = String(Math.floor(100000 + Math.random() * 900000));
      const resetToken = jwt.sign({ sub: user._id.toString(), purpose: 'password-reset' }, JWT_SECRET, {
        expiresIn: '15m',
      });
      user.resetOtpHash = bcrypt.hashSync(otp, 10);
      user.resetPasswordTokenHash = bcrypt.hashSync(resetToken, 10);
      user.resetPasswordExpiresAt = new Date(Date.now() + 60 * 1000); // 60s OTP window
      await user.save();

      // Send the reset OTP via email
      await sendOtpEmail(email, otp, 'password reset');

      // SECURITY: never leak the OTP/token in the response in production — it
      // would allow account takeover by anyone who knows the email. Dev only.
      return res.json(devAuthAllowed() ? { message, resetToken, otp } : { message });
    }
    const db = readDb();
    const user = db.users.find((u) => String(u.email).toLowerCase() === email);
    if (!user) return res.json({ message });
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const resetToken = jwt.sign({ sub: user.id, purpose: 'password-reset' }, JWT_SECRET, { expiresIn: '15m' });
    user.resetOtpHash = bcrypt.hashSync(otp, 10);
    user.resetPasswordTokenHash = bcrypt.hashSync(resetToken, 10);
    user.resetPasswordExpiresAt = new Date(Date.now() + 60 * 1000).toISOString(); // 60s OTP window
    writeDb(db);

    // Send the reset OTP via email
    await sendOtpEmail(email, otp, 'password reset');

    res.json(devAuthAllowed() ? { message, resetToken, otp } : { message });
  }),
);

router.post(
  '/verify-otp',
  otpVerifyLimit,
  asyncHandler(async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const otp = String(req.body?.otp || '').trim();
    if (mongoose.connection.readyState === 1) {
      const user = await User.findOne({ email });
      const expired = !user?.resetPasswordExpiresAt || user.resetPasswordExpiresAt < new Date();
      if (!user || expired || !bcrypt.compareSync(otp, user.resetOtpHash || '')) {
        return res.status(400).json({ message: 'Invalid or expired OTP' });
      }
      const resetToken = jwt.sign({ sub: user._id.toString(), purpose: 'password-reset' }, JWT_SECRET, {
        expiresIn: '15m',
      });
      user.resetPasswordTokenHash = bcrypt.hashSync(resetToken, 10);
      await user.save();
      return res.json({ message: 'OTP verified', resetToken });
    }
    const db = readDb();
    const user = db.users.find((u) => String(u.email).toLowerCase() === email);
    const expires = user?.resetPasswordExpiresAt ? new Date(user.resetPasswordExpiresAt).getTime() : 0;
    if (!user || !user.resetOtpHash || expires < Date.now() || !bcrypt.compareSync(otp, user.resetOtpHash)) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }
    const resetToken = jwt.sign({ sub: user.id, purpose: 'password-reset' }, JWT_SECRET, { expiresIn: '15m' });
    user.resetPasswordTokenHash = bcrypt.hashSync(resetToken, 10);
    writeDb(db);
    res.json({ message: 'OTP verified', resetToken });
  }),
);

router.post(
  '/reset-password',
  asyncHandler(async (req, res) => {
    const { token, password } = req.body || {};
    if (!token || !password) return res.status(400).json({ message: 'Token and password required' });
    if (String(password).length < 8) return res.status(400).json({ message: 'Password must be at least 8 characters' });
    const payload = jwt.verify(String(token), JWT_SECRET);
    if (payload.purpose !== 'password-reset') return res.status(400).json({ message: 'Invalid reset token' });

    if (mongoose.connection.readyState === 1) {
      const user = await User.findById(payload.sub);
      if (!user?.resetPasswordTokenHash || !bcrypt.compareSync(String(token), user.resetPasswordTokenHash)) {
        return res.status(400).json({ message: 'Invalid or expired reset token' });
      }
      user.passwordHash = bcrypt.hashSync(String(password), 10);
      user.resetOtpHash = undefined;
      user.resetPasswordTokenHash = undefined;
      user.resetPasswordExpiresAt = undefined;
      await user.save();
      return res.json({ message: 'Password updated. Please sign in.' });
    }
    const db = readDb();
    const user = db.users.find((u) => u.id === payload.sub);
    if (!user?.resetPasswordTokenHash || !bcrypt.compareSync(String(token), user.resetPasswordTokenHash)) {
      return res.status(400).json({ message: 'Invalid or expired reset token' });
    }
    user.passwordHash = bcrypt.hashSync(String(password), 10);
    delete user.resetOtpHash;
    delete user.resetPasswordTokenHash;
    delete user.resetPasswordExpiresAt;
    writeDb(db);
    res.json({ message: 'Password updated. Please sign in.' });
  }),
);

router.post(
  '/change-password',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current and new password required' });
    }
    if (mongoose.connection.readyState === 1) {
      const user = await User.findById(req.user._id || req.user.id);
      if (!user || !bcrypt.compareSync(String(currentPassword), user.passwordHash)) {
        return res.status(400).json({ message: 'Current password is incorrect' });
      }
      user.passwordHash = bcrypt.hashSync(String(newPassword), 10);
      await user.save();
      return res.json({ message: 'Password changed successfully' });
    }
    const db = readDb();
    const user = db.users.find((u) => u.id === req.user.id);
    if (!user || !bcrypt.compareSync(String(currentPassword), user.passwordHash)) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }
    user.passwordHash = bcrypt.hashSync(String(newPassword), 10);
    writeDb(db);
    res.json({ message: 'Password changed successfully' });
  }),
);

export default router;
