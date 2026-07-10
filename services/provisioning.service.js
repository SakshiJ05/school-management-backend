/**
 * School onboarding: turn a bare Tenant into a usable school — a first admin
 * login plus optional starter data (classes/sections, a fee structure, branding).
 *
 * Without this, a freshly created school has no one who can log in, which is the
 * single biggest blocker to selling the product.
 */
import bcrypt from 'bcryptjs';
import User from '../models/user.model.js';
import ClassModel from '../models/class.model.js';
import Section from '../models/section.model.js';
import FeeStructure from '../models/feeStructure.model.js';
import SiteConfig from '../models/siteConfig.model.js';
import { mirrorUserToSqlSafe } from '../utils/sqlMirror.js';

/** Human-friendly temp password (no ambiguous chars) that satisfies the 8-char min. */
export function generatePassword(len = 10) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return `${out}@1`;
}

/**
 * @param {object} tenant  a saved Tenant document
 * @param {object} opts { adminName, adminEmail, adminPassword, seedDefaults=true }
 * @returns provisioning summary incl. the created admin's temp password (shown once)
 */
export async function provisionSchoolDefaults(tenant, opts = {}) {
  const result = { admin: null, classesCreated: 0, feeStructureCreated: false, siteConfigCreated: false };
  const seedDefaults = opts.seedDefaults !== false;

  // 1. First school admin.
  const adminEmail = String(opts.adminEmail || tenant.email || '').trim().toLowerCase();
  if (adminEmail) {
    const existing = await User.findOne({ tenantId: tenant._id, email: adminEmail });
    if (existing) {
      result.admin = { id: existing._id, email: existing.email, existed: true };
    } else {
      const suppliedPassword = opts.adminPassword && String(opts.adminPassword).length >= 8;
      const tempPassword = suppliedPassword ? String(opts.adminPassword) : generatePassword();
      const admin = await User.create({
        tenantId: tenant._id,
        email: adminEmail,
        passwordHash: bcrypt.hashSync(tempPassword, 10),
        name: opts.adminName || `${tenant.name} Admin`,
        role: 'school_admin',
      });
      mirrorUserToSqlSafe({
        name: admin.name,
        email: admin.email,
        passwordHash: admin.passwordHash,
        role: admin.role,
        status: admin.status,
        tenantRef: tenant.slug,
      });
      // Only echo the password when we generated it (caller must relay it once).
      result.admin = { id: admin._id, email: admin.email, tempPassword: suppliedPassword ? undefined : tempPassword };
    }
  }

  if (!seedDefaults) return result;

  // 2. Starter classes + sections (only when the tenant has none).
  if ((await ClassModel.countDocuments({ tenantId: tenant._id })) === 0) {
    for (const [name, level] of [['Class 1', 1], ['Class 2', 2], ['Class 3', 3]]) {
      const cls = await ClassModel.create({ tenantId: tenant._id, name, level });
      await Section.create({ tenantId: tenant._id, classId: cls._id, name: 'A' });
      result.classesCreated += 1;
    }
  }

  // 3. A default fee structure.
  if ((await FeeStructure.countDocuments({ tenantId: tenant._id })) === 0) {
    await FeeStructure.create({ tenantId: tenant._id, name: 'Tuition Fee', amount: 5000, frequency: 'monthly' });
    result.feeStructureCreated = true;
  }

  // 4. Branding / site config.
  if (!(await SiteConfig.findOne({ tenantId: tenant._id }))) {
    await SiteConfig.create({ tenantId: tenant._id, branding: { schoolName: tenant.name } });
    result.siteConfigCreated = true;
  }

  return result;
}
