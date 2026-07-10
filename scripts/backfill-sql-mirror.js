/**
 * One-time backfill: copy every existing super_admin / admin account from
 * MongoDB (Atlas) into the local MySQL mirror.
 *
 * Run after starting MySQL (XAMPP):
 *   node scripts/backfill-sql-mirror.js
 */
import dns from 'dns';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from '../models/user.model.js';
import SuperAdmin from '../models/superAdmin.model.js';
import Tenant from '../models/tenant.model.js';
import { MIRROR_ROLES, initSqlMirror, isSqlMirrorReady, mirrorUserToSql } from '../utils/sqlMirror.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/school_ms';

// Same Atlas DNS workaround server.js uses (avoids querySrv ECONNREFUSED).
if (MONGODB_URI.startsWith('mongodb+srv://')) {
  try {
    dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
  } catch {
    /* ignore */
  }
}
dns.setDefaultResultOrder('ipv4first');

async function main() {
  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 15_000, family: 4 });
  console.log(`MongoDB connected → ${mongoose.connection.db?.databaseName}`);

  await initSqlMirror();
  if (!isSqlMirrorReady()) {
    console.error('SQL mirror not ready — is MySQL (XAMPP) running? Aborting.');
    await mongoose.disconnect();
    process.exit(1);
  }

  // Map tenantId → slug for a readable tenant_ref.
  const tenants = await Tenant.find().select('slug').lean();
  const slugById = new Map(tenants.map((t) => [String(t._id), t.slug]));

  let count = 0;

  // Admin-family users (admin, school_admin — super_admin isn't stored in User).
  const roles = [...MIRROR_ROLES];
  const admins = await User.find({ role: { $in: roles } }).lean();
  for (const u of admins) {
    await mirrorUserToSql({
      name: u.name,
      email: u.email,
      passwordHash: u.passwordHash,
      role: u.role,
      status: u.status,
      tenantRef: slugById.get(String(u.tenantId)) || String(u.tenantId),
    });
    count++;
  }

  // Platform super admins (separate collection).
  const supers = await SuperAdmin.find().lean();
  for (const s of supers) {
    await mirrorUserToSql({
      name: s.name,
      email: s.email,
      passwordHash: s.passwordHash,
      role: 'super_admin',
      status: s.status,
    });
    count++;
  }

  console.log(`Backfill complete — mirrored ${count} account(s) (${admins.length} admin, ${supers.length} super_admin).`);
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('Backfill failed:', err.message);
  process.exit(1);
});
