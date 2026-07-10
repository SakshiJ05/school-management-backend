const buckets = new Map();

/** Simple in-memory rate limiter (no extra dependency). */
export function rateLimit({ windowMs = 60_000, max = 10, keyFn }) {
  return (req, res, next) => {
    const key = keyFn ? keyFn(req) : req.ip || 'unknown';
    const now = Date.now();
    let entry = buckets.get(key);
    if (!entry || now - entry.start > windowMs) {
      entry = { start: now, count: 0 };
      buckets.set(key, entry);
    }
    entry.count += 1;
    if (entry.count > max) {
      return res.status(429).json({ message: 'Too many requests. Please try again later.' });
    }
    next();
  };
}

export const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  keyFn: (req) => `login:${req.ip}:${String(req.body?.email || '').toLowerCase()}`,
});
