/**
 * Razorpay integration via the REST API (no SDK dependency) + HMAC signature
 * verification. Gracefully disabled when keys are absent, so the app runs fine
 * without billing configured.
 *
 * Env: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET
 */
import crypto from 'crypto';

const KEY_ID = process.env.RAZORPAY_KEY_ID || '';
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';
const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || '';
const API = 'https://api.razorpay.com/v1';

export function isRazorpayEnabled() {
  return Boolean(KEY_ID && KEY_SECRET);
}

export function razorpayKeyId() {
  return KEY_ID;
}

function authHeader() {
  return `Basic ${Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString('base64')}`;
}

/** amount is in the plan's major unit (₹); Razorpay expects paise. */
export async function createOrder({ amount, currency = 'INR', receipt, notes }) {
  if (!isRazorpayEnabled()) throw new Error('Razorpay is not configured');
  const resp = await fetch(`${API}/orders`, {
    method: 'POST',
    headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount: Math.round(Number(amount) * 100), currency, receipt, notes: notes || {} }),
  });
  if (!resp.ok) throw new Error(`Razorpay order failed: ${resp.status} ${await resp.text()}`);
  return resp.json();
}

export async function getOrder(orderId) {
  if (!isRazorpayEnabled()) throw new Error('Razorpay is not configured');
  const resp = await fetch(`${API}/orders/${orderId}`, { headers: { Authorization: authHeader() } });
  if (!resp.ok) throw new Error(`Razorpay get order failed: ${resp.status}`);
  return resp.json();
}

function safeEqual(a, b) {
  const ba = Buffer.from(String(a || ''));
  const bb = Buffer.from(String(b || ''));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

/** Checkout callback signature: HMAC_SHA256(order_id|payment_id, key_secret). */
export function verifyPaymentSignature({ orderId, paymentId, signature }) {
  if (!KEY_SECRET) return false;
  const expected = crypto.createHmac('sha256', KEY_SECRET).update(`${orderId}|${paymentId}`).digest('hex');
  return safeEqual(expected, signature);
}

/** Webhook signature: HMAC_SHA256(rawBody, webhook_secret). */
export function verifyWebhookSignature(rawBody, signature) {
  if (!WEBHOOK_SECRET) return false;
  const expected = crypto.createHmac('sha256', WEBHOOK_SECRET).update(rawBody).digest('hex');
  return safeEqual(expected, signature);
}
