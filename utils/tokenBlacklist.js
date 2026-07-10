/** In-memory revoked JWTs (use Redis in production). */
const revoked = new Set();

export function revokeToken(token) {
  if (token) revoked.add(token);
}

export function isTokenRevoked(token) {
  return revoked.has(token);
}
