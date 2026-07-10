/** Role-based CRUD permissions per resource */
export const ROLES = ['admin', 'school_admin', 'principal', 'teacher', 'accountant', 'student', 'parent'];

export const RESOURCES = [
  'tenants',
  'users',
  'students',
  'teachers',
  'classes',
  'subjects',
  'attendance',
  'exams',
  'fees',
  'library',
  'notices',
  'homework',
  'messages',
  'reports',
  'settings',
  'audit',
  'timetable',
  'transport',
  'admissions',
  'hr',
  'hostel',
  'lms',
  'inventory',
  'notifications',
];

const all = ['create', 'read', 'update', 'delete'];
const read = ['read'];
const crud = all;
const cru = ['create', 'read', 'update'];

export const ROLE_PERMISSIONS = {
  admin: { '*': crud },
  // Full control within their own school/tenant (tenant scoping is enforced by middleware).
  school_admin: { '*': crud },
  principal: {
    users: cru,
    students: crud,
    teachers: crud,
    classes: crud,
    subjects: crud,
    attendance: crud,
    exams: crud,
    fees: crud,
    library: crud,
    notices: crud,
    homework: crud,
    messages: crud,
    reports: read,
    settings: ['read', 'update'],
    audit: read,
    timetable: crud,
    transport: crud,
    admissions: crud,
    hr: crud,
    hostel: crud,
    lms: crud,
    inventory: crud,
    notifications: read,
  },
  teacher: {
    // Teachers enrol students but may not remove them.
    students: cru,
    teachers: read,
    classes: read,
    subjects: read,
    attendance: crud,
    exams: cru,
    library: read,
    notices: read,
    homework: crud,
    messages: cru,
    reports: read,
    timetable: read,
    lms: cru,
    notifications: read,
  },
  accountant: {
    students: read,
    fees: crud,
    reports: read,
    notices: read,
    messages: cru,
    notifications: read,
  },
  student: {
    students: read,
    attendance: read,
    exams: read,
    fees: read,
    library: read,
    notices: read,
    homework: read,
    messages: cru,
    timetable: read,
    lms: read,
    notifications: read,
  },
  parent: {
    students: read,
    attendance: read,
    exams: read,
    fees: read,
    notices: read,
    homework: read,
    messages: cru,
    timetable: read,
    notifications: read,
  },
};

export function canAccess(role, resource, action) {
  const matrix = ROLE_PERMISSIONS[role];
  if (!matrix) return false;
  if (matrix['*']) return matrix['*'].includes(action);
  const allowed = matrix[resource];
  return Array.isArray(allowed) && allowed.includes(action);
}
