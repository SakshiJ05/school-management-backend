import { fail } from '../utils/apiResponse.js';

const PLAN_MODULES = {
  trial: ['dashboard', 'students', 'teachers', 'classes', 'attendance', 'fees', 'notices', 'settings'],
  standard: [
    'dashboard',
    'students',
    'teachers',
    'classes',
    'attendance',
    'exams',
    'fees',
    'homework',
    'notices',
    'communication',
    'reports',
    'settings',
  ],
  pro: [
    'dashboard',
    'students',
    'teachers',
    'classes',
    'attendance',
    'exams',
    'fees',
    'homework',
    'notices',
    'communication',
    'timetable',
    'library',
    'transport',
    'admissions',
    'inventory',
    'reports',
    'settings',
  ],
  enterprise: [
    'dashboard',
    'students',
    'teachers',
    'classes',
    'attendance',
    'exams',
    'fees',
    'homework',
    'notices',
    'communication',
    'timetable',
    'library',
    'transport',
    'admissions',
    'hr',
    'hostel',
    'lms',
    'inventory',
    'reports',
    'settings',
  ],
};

const PATH_MODULES = [
  [/^\/students\b/, 'students'],
  [/^\/teachers\b/, 'teachers'],
  [/^\/classes\b/, 'classes'],
  [/^\/attendance\b|^\/attendance-records\b/, 'attendance'],
  [/^\/exams\b|^\/marks\b/, 'exams'],
  [/^\/fee\b|^\/fees\b|^\/student-fee-assignments\b/, 'fees'],
  [/^\/homework\b/, 'homework'],
  [/^\/notices\b/, 'notices'],
  [/^\/broadcasts\b|^\/communication\b/, 'communication'],
  [/^\/timetables\b/, 'timetable'],
  [/^\/books\b|^\/book-issues\b|^\/library\b/, 'library'],
  [/^\/transport\b/, 'transport'],
  [/^\/admissions\b|^\/enquiries\b/, 'admissions'],
  [/^\/leave-requests\b|^\/payroll\b|^\/hr\b/, 'hr'],
  [/^\/hostel\b/, 'hostel'],
  [/^\/lms\b/, 'lms'],
  [/^\/inventory\b/, 'inventory'],
  [/^\/reports\b/, 'reports'],
  [/^\/school-settings\b|^\/settings\b/, 'settings'],
];

export function enforceSubscription(req, res, next) {
  const school = req.tenant?.school;
  if (!school) return next();

  const module = moduleForPath(req.path);
  if (!module) return next();

  const plan = PLAN_MODULES[school.plan] ? school.plan : 'trial';
  if (!PLAN_MODULES[plan].includes(module)) {
    return fail(res, `${module} module is not available in the ${plan} plan`, 403);
  }

  if (isWriteMethod(req.method) && isExpired(school.plan_expiry)) {
    return fail(res, 'School subscription has expired. Please renew the plan to continue write actions.', 402);
  }

  return next();
}

function moduleForPath(path) {
  return PATH_MODULES.find(([pattern]) => pattern.test(path))?.[1] || null;
}

function isWriteMethod(method) {
  return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(String(method).toUpperCase());
}

function isExpired(expiry) {
  if (!expiry) return false;
  return String(expiry).slice(0, 10) < new Date().toISOString().slice(0, 10);
}
