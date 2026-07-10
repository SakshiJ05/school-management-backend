import { School } from '../models/index.js';
import { fail } from '../utils/apiResponse.js';
import { extractSubdomain } from '../utils/subdomain.js';

/**
 * Resolves active tenant school from (priority):
 * 1. X-School-Id header
 * 2. X-School-Code header
 * 3. ?schoolId= query
 * 4. Subdomain from Host / X-Forwarded-Host
 * 5. Authenticated user's school_id
 */
export async function resolveTenant(req, res, next) {
  try {
    let school = null;

    const schoolIdHeader = req.headers['x-school-id'];
    const schoolCodeHeader = req.headers['x-school-code'];
    const schoolIdQuery = req.query.schoolId || req.query.school_id;

    if (schoolIdHeader) {
      school = await School.findByPk(Number(schoolIdHeader));
    } else if (schoolCodeHeader) {
      school = await School.findOne({
        where: { code: String(schoolCodeHeader).trim().toUpperCase() },
      });
    } else if (schoolIdQuery) {
      school = await School.findByPk(Number(schoolIdQuery));
    } else {
      const host = req.headers['x-forwarded-host'] || req.headers.host || '';
      const subdomain = extractSubdomain(host);
      if (subdomain) {
        school = await School.findOne({ where: { subdomain } });
      }
    }

    if (!school && req.user?.school_id) {
      school = await School.findByPk(req.user.school_id);
    }

    if (school && school.status !== 'active') {
      return fail(res, 'School is suspended or inactive', 403);
    }

    if (
      school &&
      req.user &&
      req.user.role !== 'super_admin' &&
      req.user.school_id &&
      req.user.school_id !== school.id
    ) {
      return fail(res, 'Cross-tenant access denied', 403);
    }

    req.tenant = school
      ? { schoolId: school.id, school, subdomain: school.subdomain }
      : null;

    next();
  } catch (err) {
    next(err);
  }
}

export function requireTenant(req, res, next) {
  if (req.tenant?.schoolId) return next();
  if (req.user?.role === 'super_admin') {
    return fail(res, 'Tenant required — send X-School-Id or X-School-Code header', 400);
  }
  return fail(res, 'Tenant not resolved', 400);
}
