import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.join(__dirname, '../data.json');
const TENANT_ID = 'tenant_demo';
const TENANT_SLUG = 'demo-school';

const password = (p) => bcrypt.hashSync(p, 10);

function defaultSeed() {
  return {
    tenants: [
      {
        id: TENANT_ID,
        name: 'Scholify Demo School',
        slug: TENANT_SLUG,
        subdomain: 'demo',
        theme: { primaryColor: '#2563eb', secondaryColor: '#7c3aed' },
      },
    ],
    users: [
      { id: 'u1', tenantId: TENANT_ID, tenantSlug: TENANT_SLUG, email: 'admin@school.com', passwordHash: password('admin123'), role: 'admin', name: 'System Admin', status: 'active' },
      { id: 'u1p', tenantId: TENANT_ID, tenantSlug: TENANT_SLUG, email: 'principal@school.com', passwordHash: password('principal123'), role: 'principal', name: 'Dr. Priya Sharma', status: 'active' },
      { id: 'u2', tenantId: TENANT_ID, tenantSlug: TENANT_SLUG, email: 'teacher@school.com', passwordHash: password('teacher123'), role: 'teacher', name: 'Rahul Mehta', status: 'active' },
      { id: 'u3', tenantId: TENANT_ID, tenantSlug: TENANT_SLUG, email: 'student@school.com', passwordHash: password('student123'), role: 'student', name: 'Aarav Patel', status: 'active' },
      { id: 'u4', tenantId: TENANT_ID, tenantSlug: TENANT_SLUG, email: 'parent@school.com', passwordHash: password('parent123'), role: 'parent', name: 'Vikram Patel', status: 'active' },
    ],
    classes: [{ id: 'c1', tenantId: TENANT_ID, name: 'Class 10', level: 10, academicYear: '2025-26' }],
    sections: [{ id: 's1', tenantId: TENANT_ID, classId: 'c1', name: 'A', capacity: 40 }],
    subjects: [
      { id: 'sub1', tenantId: TENANT_ID, name: 'Mathematics', code: 'MATH10' },
      { id: 'sub2', tenantId: TENANT_ID, name: 'Science', code: 'SCI10' },
    ],
    students: [
      {
        id: 'st1',
        tenantId: TENANT_ID,
        userId: 'u3',
        name: 'Aarav Patel',
        email: 'student@school.com',
        rollNo: '101',
        admissionNo: 'ADM2025001',
        classId: 'c1',
        sectionId: 's1',
        class: '10',
        section: 'A',
        gender: 'Male',
        status: 'Active',
        parentName: 'Vikram Patel',
        parentPhone: '9876543210',
        parentEmail: 'parent@school.com',
        admissionDate: '2025-04-01',
      },
    ],
    teachers: [
      { id: 't1', tenantId: TENANT_ID, userId: 'u2', name: 'Rahul Mehta', email: 'teacher@school.com', employeeId: 'EMP001', department: 'Science', subject: 'Science' },
    ],
    attendance: [{ id: 'att1', tenantId: TENANT_ID, studentId: 'st1', date: new Date().toISOString().slice(0, 10), status: 'present', remarks: '' }],
    exams: [{ id: 'ex1', tenantId: TENANT_ID, name: 'Mid Term 2026', type: 'written', classId: 'c1', startDate: '2026-05-15' }],
    marks: [{ id: 'mk1', tenantId: TENANT_ID, examId: 'ex1', studentId: 'st1', subjectId: 'sub1', marksObtained: 82, maxMarks: 100, grade: 'A' }],
    fees: [{ id: 'f1', tenantId: TENANT_ID, studentId: 'st1', amount: 15000, dueDate: '2026-06-30', status: 'pending', head: 'Tuition' }],
    feeStructures: [{ id: 'fs1', tenantId: TENANT_ID, name: 'Annual Tuition', amount: 45000 }],
    libraryBooks: [
      { id: 'b1', tenantId: TENANT_ID, title: 'Physics Fundamentals', author: 'Halliday', isbn: '978-001', quantity: 5, availableCopies: 4 },
      { id: 'b2', tenantId: TENANT_ID, title: 'World History', author: 'Smith', isbn: '978-002', quantity: 3, availableCopies: 3 },
    ],
    notices: [{ id: 'n1', tenantId: TENANT_ID, title: 'Annual Day', body: 'Rehearsals start next week.', createdAt: '2026-04-18', priority: 'high' }],
    homework: [],
    timetable: [{ id: 'tt1', tenantId: TENANT_ID, classId: 'c1', subjectId: 'sub1', teacherId: 't1', dayOfWeek: 1, period: 1, startTime: '09:00', endTime: '09:45' }],
    messages: [],
    siteConfig: {
      tenantId: TENANT_ID,
      branding: { schoolName: 'Scholify Demo School', tagline: 'Learn. Grow. Lead.' },
      theme: { primaryColor: '#2563eb', secondaryColor: '#7c3aed' },
      dynamicPages: [{ key: 'about', title: 'About Us', content: 'Welcome to Scholify.' }],
    },
  };
}

/** Upgrade older data.json files in place */
function migrateDb(db) {
  let changed = false;
  const ensureTenant = () => {
    if (!db.tenants?.length) {
      db.tenants = defaultSeed().tenants;
      changed = true;
    }
    return db.tenants[0];
  };
  const tenant = ensureTenant();

  const stamp = (arr) => {
    if (!Array.isArray(arr)) return;
    for (const row of arr) {
      if (!row.tenantId) {
        row.tenantId = tenant.id;
        changed = true;
      }
    }
  };

  for (const u of db.users || []) {
    if (!u.tenantId) {
      u.tenantId = tenant.id;
      u.tenantSlug = tenant.slug;
      changed = true;
    }
  }

  if (!(db.users || []).some((u) => u.email === 'principal@school.com')) {
    db.users = db.users || [];
    db.users.push({
      id: 'u1p',
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      email: 'principal@school.com',
      passwordHash: password('principal123'),
      role: 'principal',
      name: 'Dr. Priya Sharma',
      status: 'active',
    });
    changed = true;
  }

  for (const key of [
    'classes',
    'sections',
    'students',
    'teachers',
    'subjects',
    'attendance',
    'exams',
    'marks',
    'fees',
    'libraryBooks',
    'notices',
    'timetable',
    'homework',
    'messages',
  ]) {
    stamp(db[key]);
  }

  const st = (db.students || [])[0];
  if (st && !st.name) {
    const user = (db.users || []).find((u) => u.id === st.userId);
    st.name = user?.name || 'Demo Student';
    st.email = user?.email || '';
    st.admissionNo = st.admissionNo || 'ADM2025001';
    st.class = st.class || '10';
    st.section = st.section || 'A';
    st.gender = st.gender || 'Male';
    st.status = st.status || 'Active';
    changed = true;
  }

  const te = (db.teachers || [])[0];
  if (te && !te.name) {
    const user = (db.users || []).find((u) => u.id === te.userId);
    te.name = user?.name || 'Demo Teacher';
    te.email = user?.email || 'teacher@school.com';
    te.subject = te.department || 'Science';
    changed = true;
  }

  if (!db.siteConfig) {
    db.siteConfig = defaultSeed().siteConfig;
    changed = true;
  }

  if (changed) writeDb(db);
  return db;
}

export function ensureDb() {
  if (!fs.existsSync(DATA_PATH)) {
    fs.writeFileSync(DATA_PATH, JSON.stringify(defaultSeed(), null, 2));
  }
}

export function readDb() {
  ensureDb();
  const raw = fs.readFileSync(DATA_PATH, 'utf8');
  // Strip a UTF-8 BOM — Windows editors / PowerShell add one and JSON.parse rejects it.
  return migrateDb(JSON.parse(raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw));
}

export function writeDb(db) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(db, null, 2));
}
