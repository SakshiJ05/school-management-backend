/**
 * Extract tenant subdomain from Host header.
 * Examples:
 *   greenwood.scholify.local:5001 → greenwood
 *   dps.localhost:4200 → dps
 *   localhost:5001 → null
 */
export function extractSubdomain(host, baseDomain = process.env.SAAS_BASE_DOMAIN || 'scholify.local') {
  if (!host) return null;
  const hostname = String(host).split(':')[0].toLowerCase();
  if (hostname === 'localhost' || hostname === '127.0.0.1') return null;

  const parts = hostname.split('.');
  if (parts.length < 2) return null;

  const slug = parts[0];
  if (slug === 'www' || slug === 'api') {
    return parts.length >= 3 ? parts[1] : null;
  }

  if (hostname.endsWith('.localhost')) {
    return slug;
  }

  if (baseDomain && hostname.endsWith(`.${baseDomain}`)) {
    return slug;
  }

  if (parts.length >= 3) {
    return slug;
  }

  return null;
}

export function slugifySubdomain(input) {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63);
}
