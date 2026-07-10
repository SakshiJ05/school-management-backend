/**
 * Tenant-facing billing: a school admin buys/renews a subscription plan via
 * Razorpay. Mounted WITHOUT enforceSubscription so an expired school can still pay.
 *
 *   POST /api/billing/order   → create a Razorpay order for a plan
 *   POST /api/billing/verify  → verify checkout signature, activate subscription
 *   POST /api/billing/webhook → Razorpay server-to-server confirmation (no auth)
 */
import express from 'express';
import mongoose from 'mongoose';
import Plan from '../models/plan.model.js';
import Payment from '../models/payment.model.js';
import Subscription from '../models/subscription.model.js';
import Tenant from '../models/tenant.model.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { invalidateTenantAccess } from '../services/subscription.service.js';
import {
  isRazorpayEnabled,
  razorpayKeyId,
  createOrder,
  getOrder,
  verifyPaymentSignature,
  verifyWebhookSignature,
} from '../services/razorpay.service.js';

const router = express.Router();
const ADMIN_ROLES = new Set(['admin', 'school_admin', 'principal']);

async function nextInvoiceNo(tenantId) {
  const year = new Date().getFullYear();
  const seq = (await Payment.countDocuments({ tenantId })) + 1;
  return `INV${year}${String(seq).padStart(5, '0')}`;
}

/** Cancel the current active sub, start a fresh term, record the payment + invoice. */
async function activateSubscription(tenantId, plan, { paymentRef, orderId }) {
  await Subscription.updateMany({ tenantId, status: 'active' }, { status: 'cancelled' });
  const start = new Date();
  const end = new Date(start);
  end.setMonth(end.getMonth() + (plan.durationMonths || 12));
  const sub = await Subscription.create({
    tenantId,
    planId: plan._id,
    startDate: start,
    endDate: end,
    status: 'active',
  });
  const invoiceNo = await nextInvoiceNo(tenantId);
  await Payment.create({
    tenantId,
    subscriptionId: sub._id,
    planId: plan._id,
    amount: plan.price,
    currency: plan.currency || 'INR',
    method: 'card',
    status: 'paid',
    transactionRef: paymentRef,
    gatewayOrderId: orderId || '',
    invoiceNo,
    paidAt: new Date(),
  });
  const tenant = await Tenant.findById(tenantId);
  if (tenant) {
    tenant.plan = plan.slug.includes('enterprise') ? 'enterprise' : plan.slug.includes('free') ? 'free' : 'standard';
    if (tenant.status === 'suspended') tenant.status = 'active';
    await tenant.save();
  }
  invalidateTenantAccess(tenantId);
  return { sub, invoiceNo };
}

router.post(
  '/order',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!ADMIN_ROLES.has(req.user.role)) {
      return res.status(403).json({ message: 'Only a school admin can purchase a plan.' });
    }
    if (!isRazorpayEnabled()) {
      return res.status(503).json({ message: 'Online payments are not configured (set RAZORPAY_KEY_ID/SECRET).' });
    }
    const plan = await Plan.findById(req.body?.planId).lean();
    if (!plan) return res.status(404).json({ message: 'Plan not found' });

    const order = await createOrder({
      amount: plan.price,
      currency: plan.currency || 'INR',
      receipt: `sub_${req.tenantId}_${Date.now()}`,
      notes: { tenantId: String(req.tenantId), planId: String(plan._id) },
    });
    res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: razorpayKeyId(),
      planName: plan.name,
    });
  }),
);

router.post(
  '/verify',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!ADMIN_ROLES.has(req.user.role)) {
      return res.status(403).json({ message: 'Only a school admin can purchase a plan.' });
    }
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};
    if (!verifyPaymentSignature({ orderId: razorpay_order_id, paymentId: razorpay_payment_id, signature: razorpay_signature })) {
      return res.status(400).json({ message: 'Payment verification failed.' });
    }
    // Authoritative plan/tenant come from the order notes, not the client.
    const order = await getOrder(razorpay_order_id);
    if (String(order.notes?.tenantId) !== String(req.tenantId)) {
      return res.status(403).json({ message: 'This order does not belong to your school.' });
    }
    const plan = await Plan.findById(order.notes?.planId);
    if (!plan) return res.status(404).json({ message: 'Plan not found' });

    const dup = await Payment.findOne({ transactionRef: razorpay_payment_id });
    if (dup) return res.json({ message: 'Already processed.', invoiceNo: dup.invoiceNo });

    const { sub, invoiceNo } = await activateSubscription(req.tenantId, plan, {
      paymentRef: razorpay_payment_id,
      orderId: razorpay_order_id,
    });
    res.json({ message: 'Payment successful. Subscription activated.', subscriptionId: sub._id, endDate: sub.endDate, invoiceNo });
  }),
);

router.post(
  '/webhook',
  asyncHandler(async (req, res) => {
    const signature = req.headers['x-razorpay-signature'];
    const raw = req.rawBody || Buffer.from(JSON.stringify(req.body || {}));
    if (!verifyWebhookSignature(raw, signature)) {
      return res.status(400).json({ message: 'Invalid signature' });
    }
    const event = req.body?.event;
    if ((event === 'payment.captured' || event === 'order.paid') && mongoose.connection.readyState === 1) {
      const entity = req.body?.payload?.payment?.entity || {};
      const { tenantId, planId } = entity.notes || {};
      if (tenantId && planId) {
        const already = await Payment.findOne({ transactionRef: entity.id });
        if (!already) {
          const plan = await Plan.findById(planId);
          if (plan) await activateSubscription(tenantId, plan, { paymentRef: entity.id, orderId: entity.order_id });
        }
      }
    }
    res.json({ received: true });
  }),
);

export default router;
