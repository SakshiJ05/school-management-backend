/** Dev fallback when MongoDB is offline — super admin + dashboard demo data */

/**
 * Dev-only auth shortcuts (DEV_SUPER_ADMIN login, `demo-token` bearer) are a
 * hard security risk in production. They are enabled ONLY when NODE_ENV is not
 * 'production'. Never flip this on for a live deployment.
 */
export function devAuthAllowed() {
  return process.env.NODE_ENV !== 'production';
}

export const DEV_SUPER_ADMIN_ID = 'dev-super-admin';

export const DEV_SUPER_ADMIN = {
  _id: DEV_SUPER_ADMIN_ID,
  email: 'superadmin@scholify.com',
  name: 'Platform Super Admin',
  status: 'active',
  password: 'SuperAdmin@2026',
};

export function getDemoDashboard() {
  const now = Date.now();
  return {
    cards: {
      totalSchools: 248,
      totalStudents: 184320,
      totalTeachers: 9670,
      totalRevenue: 1240000,
      activeUsers: 194990,
      schoolsThisMonth: 12,
    },
    charts: {
      monthlyNewSchools: [
        { label: 'Jan', value: 8 },
        { label: 'Feb', value: 11 },
        { label: 'Mar', value: 7 },
        { label: 'Apr', value: 14 },
        { label: 'May', value: 10 },
        { label: 'Jun', value: 12 },
      ],
      activeUsers: [],
    },
    recentSchools: [
      { id: '1', name: 'Delhi Public School', initials: 'DPS', studentCount: 1200, status: 'active' },
      { id: '2', name: 'Kendriya Vidyalaya', initials: 'KV', studentCount: 980, status: 'active' },
      { id: '3', name: 'Ryan School', initials: 'RS', studentCount: 540, status: 'active' },
    ],
    expiringSoon: 3,
    recentActivity: [
      { id: 'a1', user: 'Super Admin', action: 'CREATE', module: 'schools', timestamp: new Date(now - 120000) },
      { id: 'a2', user: 'Super Admin', action: 'UPDATE', module: 'subscriptions', timestamp: new Date(now - 1080000) },
      { id: 'a3', user: 'Super Admin', action: 'BLOCK', module: 'users', timestamp: new Date(now - 3600000) },
      { id: 'a4', user: 'System', action: 'DEACTIVATE', module: 'subscriptions', timestamp: new Date(now - 10800000) },
      { id: 'a5', user: 'System', action: 'CREATE', module: 'system', timestamp: new Date(now - 18000000) },
    ],
  };
}
