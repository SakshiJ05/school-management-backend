import Plan from '../../models/plan.model.js';
import Subscription from '../../models/subscription.model.js';
import Payment from '../../models/payment.model.js';
import Tenant from '../../models/tenant.model.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { logSuperAdminAction } from '../../utils/superAdminAudit.js';
import { invalidateTenantAccess } from '../../services/subscription.service.js';

function slugify(name) {
  return String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export const listPlans = asyncHandler(async (_req, res) => {
  const plans = await Plan.find().sort({ price: 1 }).lean();
  res.json(plans.map((p) => ({ id: p._id, ...p })));
});

export const createPlan = asyncHandler(async (req, res) => {
  const { name, price, features, durationMonths, currency, maxStudents, maxTeachers, modules } = req.body || {};
  if (!name || price == null) {
    return res.status(400).json({ message: 'Name and price are required' });
  }
  let slug = slugify(name);
  if (await Plan.findOne({ slug })) slug = `${slug}-${Date.now().toString(36)}`;
  const plan = await Plan.create({
    name,
    slug,
    price: Number(price),
    features: Array.isArray(features) ? features : [],
    maxStudents: Number(maxStudents) || 0,
    maxTeachers: Number(maxTeachers) || 0,
    modules: Array.isArray(modules) ? modules : [],
    durationMonths: Number(durationMonths) || 12,
    currency: currency || 'INR',
  });
  await logSuperAdminAction(req, { action: 'CREATE', module: 'plans', resourceId: plan._id });
  res.status(201).json({ id: plan._id, ...plan.toObject() });
});

export const updatePlan = asyncHandler(async (req, res) => {
  const allowed = ['name', 'price', 'features', 'durationMonths', 'currency', 'isActive', 'maxStudents', 'maxTeachers', 'modules'];
  const patch = {};
  for (const k of allowed) if (req.body[k] !== undefined) patch[k] = req.body[k];
  const plan = await Plan.findByIdAndUpdate(req.params.id, patch, { new: true });
  if (!plan) return res.status(404).json({ message: 'Plan not found' });
  await logSuperAdminAction(req, { action: 'UPDATE', module: 'plans', resourceId: plan._id });
  res.json({ id: plan._id, ...plan.toObject() });
});

export const deletePlan = asyncHandler(async (req, res) => {
  const plan = await Plan.findByIdAndDelete(req.params.id);
  if (!plan) return res.status(404).json({ message: 'Plan not found' });
  await logSuperAdminAction(req, { action: 'DELETE', module: 'plans', resourceId: req.params.id });
  res.json({ message: 'Plan deleted' });
});

export const listSubscriptions = asyncHandler(async (req, res) => {
  const status = req.query.status;
  const filter = status ? { status } : {};
  const subs = await Subscription.find(filter)
    .populate('tenantId', 'name slug')
    .populate('planId', 'name price durationMonths')
    .sort({ endDate: 1 })
    .lean();
  res.json(
    subs.map((s) => ({
      id: s._id,
      school: s.tenantId,
      plan: s.planId,
      startDate: s.startDate,
      endDate: s.endDate,
      status: s.status,
      autoRenew: s.autoRenew,
      renewalStatus: s.endDate < new Date() ? 'expired' : 'active',
    })),
  );
});

export const assignPlanToSchool = asyncHandler(async (req, res) => {
  const { schoolId, planId, startDate, autoRenew } = req.body || {};
  if (!schoolId || !planId) {
    return res.status(400).json({ message: 'schoolId and planId are required' });
  }
  const [school, plan] = await Promise.all([
    Tenant.findById(schoolId),
    Plan.findById(planId),
  ]);
  if (!school) return res.status(404).json({ message: 'School not found' });
  if (!plan) return res.status(404).json({ message: 'Plan not found' });

  await Subscription.updateMany({ tenantId: schoolId, status: 'active' }, { status: 'cancelled' });

  const start = startDate ? new Date(startDate) : new Date();
  const end = new Date(start);
  end.setMonth(end.getMonth() + plan.durationMonths);

  const sub = await Subscription.create({
    tenantId: schoolId,
    planId,
    startDate: start,
    endDate: end,
    status: 'active',
    autoRenew: Boolean(autoRenew),
  });

  school.plan = plan.slug.includes('enterprise') ? 'enterprise' : plan.slug.includes('free') ? 'free' : 'standard';
  await school.save();
  invalidateTenantAccess(schoolId);

  await logSuperAdminAction(req, {
    action: 'ASSIGN_PLAN',
    module: 'subscriptions',
    resourceId: sub._id,
    meta: { schoolId, planId },
  });

  res.status(201).json({ id: sub._id, ...sub.toObject() });
});

export const listPayments = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Number(req.query.limit) || 20);
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    Payment.find()
      .populate('tenantId', 'name')
      .populate('planId', 'name')
      .sort({ paidAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Payment.countDocuments(),
  ]);
  res.json({
    items: items.map((p) => ({
      id: p._id,
      school: p.tenantId,
      plan: p.planId,
      amount: p.amount,
      currency: p.currency,
      method: p.method,
      status: p.status,
      transactionRef: p.transactionRef,
      paidAt: p.paidAt,
    })),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

export const recordPayment = asyncHandler(async (req, res) => {
  const { schoolId, planId, amount, method, transactionRef, subscriptionId } = req.body || {};
  if (!schoolId || amount == null) {
    return res.status(400).json({ message: 'schoolId and amount are required' });
  }
  const payment = await Payment.create({
    tenantId: schoolId,
    planId,
    subscriptionId,
    amount: Number(amount),
    method: method || 'upi',
    transactionRef: transactionRef || '',
    status: 'paid',
    paidAt: new Date(),
  });
  await logSuperAdminAction(req, { action: 'RECORD_PAYMENT', module: 'payments', resourceId: payment._id });
  res.status(201).json({ id: payment._id, ...payment.toObject() });
});
