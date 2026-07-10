import { verifyAccessToken } from '../services/token.service.js';
import { User, School } from '../models/index.js';
import { fail } from '../utils/apiResponse.js';

export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const match = /^Bearer\s+(.+)$/i.exec(header);
    if (!match) return fail(res, 'Unauthorized — token required', 401);

    const payload = verifyAccessToken(match[1].trim());
    const user = await User.findByPk(payload.sub);
    if (!user || user.status === 'blocked') {
      return fail(res, 'Account blocked or not found', 401);
    }

    let school = null;
    if (user.school_id) {
      school = await School.findByPk(user.school_id);
    }

    req.user = user;
    req.school = school;
    req.auth = payload;
    next();
  } catch {
    return fail(res, 'Invalid or expired token', 401);
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return fail(res, 'Forbidden', 403);
    }
    next();
  };
}
