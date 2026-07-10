import bcrypt from 'bcryptjs';
import { sendOtpEmail } from './mail.service.js';

const OTP_TTL_MS = 10 * 60 * 1000;
const otpStore = new Map();

function keyFor(scope, email) {
  return `${scope}:${String(email || '').trim().toLowerCase()}`;
}

export function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function requestEmailOtp(email, scope, purpose) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const otp = generateOtp();
  otpStore.set(keyFor(scope, normalizedEmail), {
    hash: bcrypt.hashSync(otp, 10),
    expiresAt: Date.now() + OTP_TTL_MS,
  });
  const mail = await sendOtpEmail(normalizedEmail, otp, purpose);
  return {
    sent: true,
    devOtp: mail.dev ? otp : undefined,
    message: mail.dev ? 'OTP generated. Check backend console in dev mode.' : 'OTP sent to email',
  };
}

export function verifyEmailOtp(email, otp, scope) {
  const key = keyFor(scope, email);
  const entry = otpStore.get(key);
  if (!entry || entry.expiresAt < Date.now()) {
    otpStore.delete(key);
    return false;
  }
  const valid = bcrypt.compareSync(String(otp || '').trim(), entry.hash);
  if (valid) otpStore.delete(key);
  return valid;
}
