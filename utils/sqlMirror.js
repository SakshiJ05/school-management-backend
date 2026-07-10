/**
 * SQL mirror — dual-writes super_admin / admin accounts to a local MySQL copy.
 *
 * MongoDB (Atlas) stays the primary store. This module keeps a synchronized copy
 * of privileged accounts (super_admin, admin, school_admin) in a MySQL `users`
 * table so the data is also queryable from SQL.
 *
 * Design goals:
 *  - Never block or crash the app. If MySQL is down (e.g. XAMPP not started),
 *    every call becomes a no-op and logs a single warning.
 *  - Idempotent: writes are upserts keyed by email.
 *
 * Toggle off entirely with SQL_MIRROR=off in backend/.env.
 */
import { Sequelize, DataTypes } from 'sequelize';
import mysql from 'mysql2/promise';

/** Mongo roles that get mirrored into SQL. */
export const MIRROR_ROLES = new Set(['super_admin', 'admin', 'school_admin']);

const CFG = {
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: Number(process.env.MYSQL_PORT) || 3306,
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'scholify',
};

let sequelize = null;
let SqlUser = null;
let ready = false;
let warned = false;

export function isSqlMirrorEnabled() {
  return String(process.env.SQL_MIRROR || '').toLowerCase() !== 'off';
}

export function isSqlMirrorReady() {
  return ready;
}

function warnOnce(message) {
  if (!warned) {
    console.warn(message);
    warned = true;
  }
}

function defineModel(seq) {
  return seq.define(
    'User',
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      // Kept for compatibility with the SQL SaaS schema; Mongo tenant id goes in tenant_ref.
      school_id: { type: DataTypes.INTEGER, allowNull: true },
      tenant_ref: { type: DataTypes.STRING(64), allowNull: true },
      name: { type: DataTypes.STRING(200), allowNull: false },
      email: { type: DataTypes.STRING(190), allowNull: false, unique: true },
      password: { type: DataTypes.STRING(255), allowNull: false },
      role: {
        type: DataTypes.ENUM(
          'super_admin',
          'admin',
          'school_admin',
          'principal',
          'teacher',
          'accountant',
          'student',
          'parent',
        ),
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM('active', 'inactive', 'suspended', 'blocked'),
        defaultValue: 'active',
      },
      source: { type: DataTypes.STRING(20), defaultValue: 'mongo' },
      last_login: { type: DataTypes.DATE },
    },
    {
      tableName: 'users',
      underscored: true,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  );
}

/**
 * Connect to MySQL, create the database/table if missing, and mark the mirror ready.
 * Safe to call once at startup. Failure leaves the mirror disabled (no throw).
 */
export async function initSqlMirror() {
  if (!isSqlMirrorEnabled()) {
    console.log('SQL mirror disabled (SQL_MIRROR=off).');
    return false;
  }
  try {
    // Ensure the target database exists (Sequelize can't create it itself).
    const bootstrap = await mysql.createConnection({
      host: CFG.host,
      port: CFG.port,
      user: CFG.user,
      password: CFG.password,
      connectTimeout: 5000,
    });
    await bootstrap.query(
      `CREATE DATABASE IF NOT EXISTS \`${CFG.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
    await bootstrap.end();

    sequelize = new Sequelize(CFG.database, CFG.user, CFG.password, {
      host: CFG.host,
      port: CFG.port,
      dialect: 'mysql',
      logging: false,
      pool: { max: 5, min: 0, acquire: 20000, idle: 10000 },
    });
    SqlUser = defineModel(sequelize);
    await sequelize.authenticate();
    await SqlUser.sync({ alter: true });
    ready = true;
    warned = false;
    console.log(`SQL mirror ready → mysql://${CFG.host}:${CFG.port}/${CFG.database} (users table)`);
    return true;
  } catch (err) {
    ready = false;
    console.warn(
      `SQL mirror unavailable — super_admin/admin will NOT be copied to MySQL. ` +
        `Start MySQL (XAMPP) and restart. Reason: ${err.message}`,
    );
    return false;
  }
}

function normalizeStatus(status) {
  const s = String(status || 'active').toLowerCase();
  return ['active', 'inactive', 'suspended', 'blocked'].includes(s) ? s : 'active';
}

/**
 * Upsert one privileged account into the SQL mirror. No-op for non-mirrored roles,
 * when the mirror is disabled, or when MySQL is unreachable.
 *
 * @param {object} u
 * @param {string} u.name
 * @param {string} u.email
 * @param {string} u.passwordHash  bcrypt hash (stored as-is)
 * @param {string} u.role          Mongo role
 * @param {string} [u.status]
 * @param {string} [u.tenantRef]   Mongo tenantId / slug (optional)
 */
export async function mirrorUserToSql(u) {
  if (!ready || !SqlUser || !u) return;
  const role = String(u.role || '').toLowerCase();
  if (!MIRROR_ROLES.has(role)) return;
  const email = String(u.email || '').trim().toLowerCase();
  if (!email) return;

  try {
    await SqlUser.upsert({
      email,
      name: String(u.name || '').trim() || email,
      password: u.passwordHash || '',
      role,
      status: normalizeStatus(u.status),
      tenant_ref: u.tenantRef != null ? String(u.tenantRef) : null,
      source: 'mongo',
    });
  } catch (err) {
    warnOnce(`SQL mirror write failed for ${email}: ${err.message}`);
  }
}

/** Fire-and-forget variant — never rejects, safe to call without await. */
export function mirrorUserToSqlSafe(u) {
  mirrorUserToSql(u).catch(() => {});
}
