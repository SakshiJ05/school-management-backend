import { canAccess } from '../config/permissions.js';

export function permit(resource, action) {
  return (req, res, next) => {
    const role = req.user?.role;
    if (!role) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    if (!canAccess(role, resource, action)) {
      return res.status(403).json({ message: `Forbidden: cannot ${action} ${resource}` });
    }
    next();
  };
}

export function permitAny(pairs) {
  return (req, res, next) => {
    const role = req.user?.role;
    if (!role) return res.status(401).json({ message: 'Unauthorized' });
    const ok = pairs.some(([resource, action]) => canAccess(role, resource, action));
    if (!ok) return res.status(403).json({ message: 'Forbidden' });
    next();
  };
}
