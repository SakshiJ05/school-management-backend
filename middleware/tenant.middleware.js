import mongoose from 'mongoose';
import Tenant from '../models/tenant.model.js';
import { readDb } from '../utils/db.js';

/** Resolve tenant from subdomain (Host) or X-Tenant-Slug header */
export async function resolveTenant(req, _res, next) {
  const headerSlug = req.headers['x-tenant-slug'];
  const host = req.headers.host || '';
  const subdomain = host.split('.')[0];
  const slug = (headerSlug || (subdomain && subdomain !== 'localhost' && subdomain !== 'www' ? subdomain : ''))
    .toString()
    .toLowerCase()
    .trim();

  if (!slug) return next();

  try {
    if (mongoose.connection.readyState === 1) {
      const tenant = await Tenant.findOne({ slug, status: 'active' }).lean();
      if (tenant) {
        req.tenantFromHost = tenant;
        if (!req.tenantId) req.tenantId = tenant._id.toString();
      }
    } else {
      const db = readDb();
      const tenant = (db.tenants || []).find((t) => t.slug === slug);
      if (tenant) {
        req.tenantFromHost = tenant;
        if (!req.tenantId) req.tenantId = tenant.id;
      }
    }
  } catch {
    /* ignore */
  }
  next();
}

export function requireTenant(req, res, next) {
  if (!req.tenantId) {
    return res.status(400).json({ message: 'Tenant context required. Sign in or send X-Tenant-Slug.' });
  }
  next();
}
