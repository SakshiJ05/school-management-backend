/**
 * Seeds the platform super admin (CLI only — not exposed in UI).
 * Usage: node scripts/seed-super-admin.js
 */
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import SuperAdmin from '../models/superAdmin.model.js';
import Plan from '../models/plan.model.js';
import { initSqlMirror, mirrorUserToSql } from '../utils/sqlMirror.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/school_ms';
const MONGODB_URI_FALLBACK = process.env.MONGODB_URI_FALLBACK || 'mongodb://127.0.0.1:27017/school_ms';
const EMAIL = process.env.SUPER_ADMIN_EMAIL || 'superadmin@scholify.com';
const PASSWORD = process.env.SUPER_ADMIN_PASSWORD || 'SuperAdmin@2026';
const NAME = process.env.SUPER_ADMIN_NAME || 'Platform Super Admin';

async function seedPlans() {
  const count = await Plan.countDocuments();
  if (count > 0) return;
  await Plan.insertMany([
    {
      name: 'Free',
      slug: 'free',
      price: 0,
      features: ['Up to 100 students', 'Basic reports', 'Email support'],
      maxStudents: 100,
      maxTeachers: 10,
      modules: ['dashboard', 'students', 'teachers', 'classes', 'attendance', 'fees', 'notices', 'settings'],
      durationMonths: 12,
    },
    {
      name: 'Standard',
      slug: 'standard',
      price: 14999,
      features: ['Up to 500 students', 'Attendance & exams', 'SMS alerts', 'Priority support'],
      maxStudents: 500,
      maxTeachers: 50,
      modules: [
        'dashboard', 'students', 'teachers', 'classes', 'attendance', 'exams', 'fees',
        'homework', 'notices', 'communication', 'timetable', 'library', 'reports', 'settings',
      ],
      durationMonths: 12,
    },
    {
      name: 'Enterprise',
      slug: 'enterprise',
      price: 49999,
      features: ['Unlimited students', 'Custom branding', 'API access', 'Dedicated manager'],
      maxStudents: 0, // unlimited
      maxTeachers: 0, // unlimited
      modules: [], // all modules
      durationMonths: 12,
    },
  ]);
  console.log('Default subscription plans created.');
}

async function connectMongo() {
  const attempts = [
    { uri: MONGODB_URI, name: 'MONGODB_URI' },
    { uri: MONGODB_URI_FALLBACK, name: 'local fallback' },
  ];
  let lastErr;
  for (const { uri, name } of attempts) {
    if (!uri?.trim()) continue;
    try {
      if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000 });
      console.log(`Connected (${name})`);
      return;
    } catch (err) {
      lastErr = err;
      console.warn(`Mongo ${name} failed:`, err.message);
    }
  }
  throw lastErr;
}

async function main() {
  await connectMongo();
  await initSqlMirror();
  const hash = await bcrypt.hash(PASSWORD, 12);
  const existing = await SuperAdmin.findOne({ email: EMAIL });
  if (existing) {
    console.log(`Super admin already exists: ${EMAIL}`);
    await mirrorUserToSql({
      name: existing.name,
      email: existing.email,
      passwordHash: existing.passwordHash,
      role: 'super_admin',
      status: existing.status,
    });
  } else {
    await SuperAdmin.create({ email: EMAIL, passwordHash: hash, name: NAME, status: 'active' });
    await mirrorUserToSql({ name: NAME, email: EMAIL, passwordHash: hash, role: 'super_admin', status: 'active' });
    console.log('Super admin created:');
    console.log(`  Email:    ${EMAIL}`);
    console.log(`  Password: ${PASSWORD}`);
    console.log('  (Change password after first login)');
  }
  await seedPlans();
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
