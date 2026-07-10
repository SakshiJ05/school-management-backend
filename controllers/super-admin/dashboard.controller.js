import Tenant from '../../models/tenant.model.js';
import User from '../../models/user.model.js';
import Student from '../../models/student.model.js';
import Teacher from '../../models/teacher.model.js';
import Payment from '../../models/payment.model.js';
import AuditLog from '../../models/auditLog.model.js';
import Subscription from '../../models/subscription.model.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { getDemoDashboard, DEV_SUPER_ADMIN_ID } from '../../utils/superAdminDev.js';
import mongoose from 'mongoose';

export const getDashboard = asyncHandler(async (req, res) => {
  if (mongoose.connection.readyState !== 1 || req.superAdmin?._id === DEV_SUPER_ADMIN_ID) {
    return res.json(getDemoDashboard());
  }

  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const in30 = new Date();
  in30.setDate(in30.getDate() + 30);

  const [schools, students, teachers, revenueAgg, recentLogs, schoolsByMonth, activeUsers, schoolsThisMonth, expiringSoon, recentTenantRows] =
    await Promise.all([
      Tenant.countDocuments(),
      Student.countDocuments(),
      Teacher.countDocuments(),
      Payment.aggregate([
        { $match: { status: 'paid' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      AuditLog.find({ actorType: 'super_admin' }).sort({ createdAt: -1 }).limit(12).lean(),
      Tenant.aggregate([
        { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
        { $limit: 12 },
      ]),
      User.countDocuments({ status: 'active' }),
      Tenant.countDocuments({ createdAt: { $gte: monthStart } }),
      Subscription.countDocuments({ status: 'active', endDate: { $lte: in30, $gte: new Date() } }),
      Tenant.find().sort({ createdAt: -1 }).limit(3).lean(),
    ]);

  const activeUsersTrend = await User.aggregate([
    { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
    { $limit: 12 },
  ]);

  const recentSchools = await Promise.all(
    recentTenantRows.map(async (s) => ({
      id: s._id,
      name: s.name,
      initials: s.name
        .split(/\s+/)
        .map((w) => w[0])
        .join('')
        .slice(0, 3)
        .toUpperCase(),
      studentCount: await Student.countDocuments({ tenantId: s._id }).catch(() => 0),
      status: s.status,
      plan: s.plan,
    })),
  );

  res.json({
    cards: {
      totalSchools: schools,
      totalStudents: students,
      totalTeachers: teachers,
      totalRevenue: revenueAgg[0]?.total || 0,
      activeUsers,
      schoolsThisMonth,
    },
    charts: {
      monthlyNewSchools: schoolsByMonth.slice(-6).map((r) => ({
        label: new Date(`${r._id}-01`).toLocaleString('en-IN', { month: 'short' }),
        value: r.count,
      })),
      activeUsers: activeUsersTrend.map((r) => ({ label: r._id, value: r.count })),
    },
    recentSchools,
    expiringSoon,
    recentActivity: recentLogs.map((log) => ({
      id: log._id,
      user: log.actorEmail || 'Super Admin',
      action: log.action,
      module: log.module || log.resource,
      timestamp: log.createdAt,
      ip: log.ip,
    })),
  });
});
