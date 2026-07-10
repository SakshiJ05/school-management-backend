import dns from 'dns';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Tenant from '../models/tenant.model.js';
import SuperAdmin from '../models/superAdmin.model.js';
import MongoUser from '../models/user.model.js';
import MongoTeacher from '../models/teacher.model.js';
import MongoStudent from '../models/student.model.js';
import MongoClass from '../models/class.model.js';
import MongoSection from '../models/section.model.js';
import {
  sequelize,
  School,
  User,
  Teacher,
  Student,
  Class,
  Section,
} from '../src/models/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const password = 'Test@123';
const accounts = [
  { name: 'Test Admin', email: 'admin@test.com', mongoRole: 'school_admin', sqlRole: 'school_admin' },
  { name: 'Test Teacher', email: 'teacher@test.com', mongoRole: 'teacher', sqlRole: 'teacher' },
  { name: 'Test Student', email: 'student@test.com', mongoRole: 'student', sqlRole: 'student' },
];
const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/school_ms';

if (mongoUri.startsWith('mongodb+srv://')) {
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
}
dns.setDefaultResultOrder('ipv4first');

try {
  const passwordHash = await bcrypt.hash(password, 10);

  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 25_000, family: 4 });
  const mongoSuperAdmin = await SuperAdmin.findOneAndUpdate(
    { email: 'superadmin@test.com' },
    {
      name: 'Test Super Admin',
      email: 'superadmin@test.com',
      passwordHash,
      status: 'active',
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  const tenant = await Tenant.findOneAndUpdate(
    { slug: 'test-school' },
    {
      name: 'Test School',
      slug: 'test-school',
      subdomain: 'test-school',
      email: 'admin@test.com',
      status: 'active',
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  const mongoClass = await MongoClass.findOneAndUpdate(
    { tenantId: tenant._id, name: 'Class 10' },
    { tenantId: tenant._id, name: 'Class 10', level: 10, academicYear: '2026-27' },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  const mongoSection = await MongoSection.findOneAndUpdate(
    { tenantId: tenant._id, classId: mongoClass._id, name: 'A' },
    { tenantId: tenant._id, classId: mongoClass._id, name: 'A', capacity: 40 },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  const mongoUsers = {};
  for (const account of accounts) {
    mongoUsers[account.mongoRole] = await MongoUser.findOneAndUpdate(
      { tenantId: tenant._id, email: account.email },
      {
        tenantId: tenant._id,
        name: account.name,
        email: account.email,
        passwordHash,
        role: account.mongoRole,
        status: 'active',
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  }

  const mongoTeacher = await MongoTeacher.findOneAndUpdate(
    { tenantId: tenant._id, employeeId: 'T-001' },
    {
      tenantId: tenant._id,
      userId: mongoUsers.teacher._id,
      name: 'Test Teacher',
      email: 'teacher@test.com',
      employeeId: 'T-001',
      department: 'Science',
      designation: 'Teacher',
      classIds: [mongoClass._id],
      status: 'Active',
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  const mongoStudent = await MongoStudent.findOneAndUpdate(
    { tenantId: tenant._id, admissionNo: 'TEST-001' },
    {
      tenantId: tenant._id,
      userId: mongoUsers.student._id,
      name: 'Test Student',
      email: 'student@test.com',
      admissionNo: 'TEST-001',
      rollNo: '1',
      classId: mongoClass._id,
      sectionId: mongoSection._id,
      studentClass: 'Class 10',
      section: 'A',
      status: 'Active',
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  await mongoUsers.teacher.updateOne({ linkedTeacherId: mongoTeacher._id });
  await mongoUsers.student.updateOne({ linkedStudentId: mongoStudent._id });

  await sequelize.authenticate();
  const [school] = await School.findOrCreate({
    where: { code: 'TEST001' },
    defaults: {
      name: 'Test School',
      subdomain: 'test-school',
      email: 'admin@test.com',
      status: 'active',
    },
  });
  const [sqlClass] = await Class.findOrCreate({
    where: { school_id: school.id, name: 'Class 10' },
  });
  const [sqlSection] = await Section.findOrCreate({
    where: { school_id: school.id, class_id: sqlClass.id, name: 'A' },
  });

  const sqlUsers = {};
  for (const account of accounts) {
    const [user] = await User.findOrCreate({
      where: { email: account.email },
      defaults: {
        school_id: school.id,
        name: account.name,
        password: passwordHash,
        role: account.sqlRole,
        status: 'active',
      },
    });
    await user.update({
      school_id: school.id,
      name: account.name,
      password: passwordHash,
      role: account.sqlRole,
      status: 'active',
    });
    sqlUsers[account.sqlRole] = user;
  }
  const [sqlSuperAdmin] = await User.findOrCreate({
    where: { email: 'superadmin@test.com' },
    defaults: {
      school_id: null,
      name: 'Test Super Admin',
      password: passwordHash,
      role: 'super_admin',
      status: 'active',
    },
  });
  await sqlSuperAdmin.update({
    school_id: null,
    name: 'Test Super Admin',
    password: passwordHash,
    role: 'super_admin',
    status: 'active',
  });

  await Teacher.findOrCreate({
    where: { school_id: school.id, user_id: sqlUsers.teacher.id },
    defaults: {
      name: 'Test Teacher',
      employee_code: 'T-001',
      subject_expertise: 'Science',
      status: 'active',
    },
  });
  await Student.findOrCreate({
    where: { school_id: school.id, user_id: sqlUsers.student.id },
    defaults: {
      name: 'Test Student',
      roll_number: '1',
      class_id: sqlClass.id,
      section_id: sqlSection.id,
      status: 'active',
    },
  });

  const passwordChecks = await Promise.all([
    bcrypt.compare(password, mongoSuperAdmin.passwordHash),
    bcrypt.compare(password, sqlSuperAdmin.password),
    ...Object.values(mongoUsers).map((user) => bcrypt.compare(password, user.passwordHash)),
    ...Object.values(sqlUsers).map((user) => bcrypt.compare(password, user.password)),
  ]);
  if (passwordChecks.some((matches) => !matches)) {
    throw new Error('A test account password failed verification.');
  }

  console.log('Test super admin, school admin, teacher, and student accounts created.');
  console.log('Passwords verified in MongoDB and MySQL.');
  console.log(`Password for all accounts: ${password}`);
} finally {
  await Promise.allSettled([mongoose.disconnect(), sequelize.close()]);
}
