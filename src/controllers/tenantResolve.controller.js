import { School } from '../models/index.js';
import { ok, fail } from '../utils/apiResponse.js';
import { serializeSchool } from '../utils/serializer.js';
import { extractSubdomain } from '../utils/subdomain.js';

/** Public: resolve tenant from subdomain query or Host header */
export async function resolveBySubdomain(req, res) {
  try {
    const subdomain =
      String(req.query.subdomain || '').trim().toLowerCase() ||
      extractSubdomain(req.headers['x-forwarded-host'] || req.headers.host || '');

    if (!subdomain) {
      return fail(res, 'subdomain required', 400);
    }

    const school = await School.findOne({ where: { subdomain, status: 'active' } });
    if (!school) {
      return fail(res, 'School not found for this subdomain', 404);
    }

    return ok(res, {
      school: serializeSchool(school),
      schoolId: school.id,
      schoolCode: school.code,
      subdomain: school.subdomain,
    });
  } catch (err) {
    return fail(res, err.message, 500);
  }
}

/** Public: list active schools (for login school picker) */
export async function listPublicSchools(req, res) {
  try {
    const rows = await School.findAll({
      where: { status: 'active' },
      attributes: ['id', 'name', 'code', 'subdomain', 'city', 'plan'],
      order: [['name', 'ASC']],
    });
    return ok(
      res,
      rows.map((s) => ({
        id: s.id,
        name: s.name,
        code: s.code,
        subdomain: s.subdomain,
        city: s.city,
        plan: s.plan,
      })),
    );
  } catch (err) {
    return fail(res, err.message, 500);
  }
}
