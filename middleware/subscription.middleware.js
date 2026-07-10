/**
 * Runtime subscription enforcement for tenant-facing API routes.
 *
 * Policy:
 *  - Suspended school  → block everything (403).
 *  - Expired plan      → allow reads (so they can view data + renew) but block
 *                        writes with 402 SUBSCRIPTION_EXPIRED.
 *  - Otherwise         → allow, and attach req.subscription for handlers.
 *
 * Must run AFTER requireAuth (needs req.user / req.tenantId). Fails OPEN on
 * internal errors so a transient DB blip never locks every school out.
 */
import { getTenantAccessStatus } from '../services/subscription.service.js';

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export async function enforceSubscription(req, res, next) {
  try {
    const tenantId = req.tenantId || req.user?.tenantId;
    if (!tenantId) return next();

    const status = await getTenantAccessStatus(tenantId);
    req.subscription = status;

    if (status.tenantSuspended) {
      return res.status(403).json({
        message: 'This school account is suspended. Please contact the platform administrator.',
        code: 'TENANT_SUSPENDED',
      });
    }

    if (status.expired && WRITE_METHODS.has(req.method)) {
      return res.status(402).json({
        message: 'Your subscription has expired. Please renew your plan to continue.',
        code: 'SUBSCRIPTION_EXPIRED',
      });
    }

    next();
  } catch (err) {
    console.warn('enforceSubscription skipped (error):', err.message);
    next();
  }
}
