import bcrypt from 'bcryptjs';
import { connectDatabase, syncDatabase } from '../config/database.js';
import { School, User, Class, Section, FeeStructure, AuditLog } from '../models/index.js';
import { slugifySubdomain } from '../utils/subdomain.js';

const PLANS = ['trial', 'standard', 'pro', 'enterprise', 'standard'];
const CITIES = ['Delhi', 'Mumbai', 'Bangalore', 'Patna', 'Lucknow'];
const SCHOOL_NAMES = [
  'Delhi Public School',
  'Kendriya Vidyalaya',
  'Ryan International',
  'St. Xavier Academy',
  'DAV Public School',
];

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function formatDate(d) {
  return d.toISOString().slice(0, 10);
}

export async function seedSuperAdmin({ force = false } = {}) {
  await connectDatabase();
  await syncDatabase({ force, alter: !force });

  if (!force) {
    const existing = await User.findOne({ where: { role: 'super_admin' } });
    if (existing) {
      console.log('Seed skipped - super admin already exists. Use --force to reset.');
      return;
    }
  }

  const passwordHash = await bcrypt.hash('Admin@123', 10);
  const superAdmin = await User.create({
    school_id: null,
    name: 'Super Admin',
    email: 'super_admin@scholify.com',
    password: passwordHash,
    role: 'super_admin',
    status: 'active',
  });

  console.log('Created super admin:', superAdmin.email, '/ Admin@123');

  for (let i = 0; i < SCHOOL_NAMES.length; i++) {
    const code = `SCH-${String(i + 1).padStart(3, '0')}`;
    const plan = PLANS[i];
    const planExpiry = formatDate(addDays(new Date(), 180 + i * 30));

    const school = await School.create({
      name: SCHOOL_NAMES[i],
      code,
      subdomain: slugifySubdomain(SCHOOL_NAMES[i]),
      city: CITIES[i],
      state: 'India',
      address: `${CITIES[i]}, India`,
      email: `admin@${code.toLowerCase()}.scholify.com`,
      phone: `98765${String(43210 + i).slice(-5)}`,
      plan,
      plan_expiry: planExpiry,
      status: 'active',
    });

    const cls = await Class.create({ school_id: school.id, name: 'Class 10' });
    await Section.create({
      school_id: school.id,
      class_id: cls.id,
      name: 'A',
    });

    await FeeStructure.bulkCreate([
      {
        school_id: school.id,
        class_id: cls.id,
        type: 'Tuition Fee',
        amount: 4500,
        frequency: 'monthly',
        academic_year: '2025-26',
      },
      {
        school_id: school.id,
        class_id: cls.id,
        type: 'Transport Fee',
        amount: 1200,
        frequency: 'monthly',
        academic_year: '2025-26',
      },
    ]);

    await AuditLog.create({
      user_id: superAdmin.id,
      school_id: school.id,
      action: 'CREATE',
      module: 'schools',
      details: { schoolName: school.name, code: school.code },
      ip_address: '127.0.0.1',
    });

    console.log(`Created school shell: ${school.name} (${code})`);
  }

  console.log('\nSeed complete.');
  console.log('Super Admin -> super_admin@scholify.com / Admin@123');
  console.log('School shells were created without demo admin/student accounts.');
}

// CLI entry
const force = process.argv.includes('--force');
seedSuperAdmin({ force })
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seed failed:', err.message);
    process.exit(1);
  });
