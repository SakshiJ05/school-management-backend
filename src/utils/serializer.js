/** snake_case → camelCase for API responses */
export function toCamel(str) {
  return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

export function serializeRow(row) {
  if (!row) return null;
  const json = typeof row.toJSON === 'function' ? row.toJSON() : { ...row };
  const out = {};
  for (const [key, value] of Object.entries(json)) {
    out[toCamel(key)] = value;
  }
  return out;
}

export function serializeRows(rows) {
  return (rows || []).map(serializeRow);
}

/** camelCase / mixed body → snake_case for Sequelize */
export function mapBody(body = {}, tenantSchoolId = null) {
  const out = {};
  for (const [key, value] of Object.entries(body)) {
    if (value === undefined || value === null) continue;
    const snake = key.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
    out[snake] = value;
  }
  if (tenantSchoolId != null) {
    out.school_id = tenantSchoolId;
  }
  return out;
}

export function serializeSchool(school) {
  if (!school) return null;
  return {
    id: school.id,
    name: school.name,
    code: school.code,
    subdomain: school.subdomain,
    city: school.city,
    state: school.state,
    address: school.address,
    email: school.email,
    phone: school.phone,
    logoUrl: school.logo_url,
    plan: school.plan,
    planExpiry: school.plan_expiry,
    status: school.status,
    createdAt: school.created_at,
  };
}
