/**
 * Tenant subscription/access resolution for runtime enforcement.
 *
 * Resolves a tenant's current plan + whether it is suspended or expired, with a
 * short in-memory cache to avoid a DB hit on every API request. Used by the
 * enforceSubscription middleware and plan-limit checks.
 */
import mongoose from 'mongoose';
import Tenant from '../models/tenant.model.js';
import Subscription from '../models/subscription.model.js';
import '../models/plan.model.js'; // ensure Plan model is registered for populate

const CACHE_TTL_MS = 30_000;
const cache = new Map(); // tenantId -> { at, data }

/** Neutral status used when Mongo is offline or tenant unknown — never blocks. */
const OPEN_ACCESS = { tenantSuspended: false, expired: false, hasSubscription: false, plan: null, subscription: null };

export async function getTenantAccessStatus(tenantId) {
  if (!tenantId || mongoose.connection.readyState !== 1) return OPEN_ACCESS;
  const key = String(tenantId);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data;

  const [tenant, sub] = await Promise.all([
    Tenant.findById(tenantId).lean(),
    Subscription.findOne({ tenantId, status: { $in: ['active', 'pending'] } })
      .sort({ endDate: -1 })
      .populate('planId')
      .lean(),
  ]);

  const expired = sub ? new Date(sub.endDate).getTime() < Date.now() : false;
  const data = {
    tenantSuspended: tenant?.status === 'suspended',
    expired,
    hasSubscription: Boolean(sub),
    plan: sub?.planId || null,
    subscription: sub ? { ...sub, planId: sub.planId?._id || sub.planId } : null,
  };
  cache.set(key, { at: Date.now(), data });
  return data;
}

/** Drop the cached status for a tenant (call after assign-plan / suspend / renew). */
export function invalidateTenantAccess(tenantId) {
  if (tenantId) cache.delete(String(tenantId));
}

/**
 * Numeric cap for a countable resource under the tenant's plan, or null for
 * unlimited / no plan. key ∈ {'students','teachers'}.
 */
export async function getPlanLimit(tenantId, key) {
  const { plan } = await getTenantAccessStatus(tenantId);
  if (!plan) return null;
  const limit = key === 'teachers' ? plan.maxTeachers : plan.maxStudents;
  return typeof limit === 'number' && limit > 0 ? limit : null;
}

/** True when `moduleKey` is allowed by the tenant's plan (empty plan.modules = all allowed). */
export async function isModuleAllowed(tenantId, moduleKey) {
  const { plan } = await getTenantAccessStatus(tenantId);
  if (!plan || !Array.isArray(plan.modules) || plan.modules.length === 0) return true;
  return plan.modules.includes(moduleKey);
}
