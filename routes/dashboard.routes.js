import express from 'express';
import mongoose from 'mongoose';
import Student from '../models/student.model.js';
import Teacher from '../models/teacher.model.js';
import Attendance from '../models/attendance.model.js';
import FeePayment from '../models/feePayment.model.js';
import Exam from '../models/exam.model.js';
import Notice from '../models/notice.model.js';
import Tenant from '../models/tenant.model.js';
import ClassModel from '../models/class.model.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { tenantQuery } from '../utils/tenantFilter.js';
import { readDb } from '../utils/db.js';

const router = express.Router();

function attendancePercent(rows) {
  if (!rows.length) return 0;
  const present = rows.filter((r) => r.status === 'present').length;
  return Math.round((present / rows.length) * 100);
}

function recentAdmissionsFromJson(db, tenantId) {
  let rows = db.students || [];
  if (tenantId) rows = rows.filter((s) => s.tenantId === tenantId);
  return rows
    .slice(-5)
    .reverse()
    .map((s) => ({
      id: s.id,
      name: s.name || s.email || 'Student',
      className: `${s.class || s.studentClass || ''}${s.section ? ` ${s.section}` : ''}`.trim() || 'Not set',
      date: s.admissionDate || new Date().toISOString().slice(0, 10),
    }));
}

function studentGrowthFromList(rows) {
  return rows.map((s, index) => ({
    label: s.admissionDate || s.name || `Student ${index + 1}`,
    value: index + 1,
  }));
}

router.get(
  '/summary',
  requireAuth,
  asyncHandler(async (req, res) => {
    const role = req.user.role;
    const tenantId = req.tenantId;

    if (mongoose.connection.readyState === 1) {
      const tq = tenantQuery(req);
      let studentCount = 0;
      let teacherCount = 0;
      let classCount = 0;
      let fees = [];
      let attendance = [];
      let exams = [];
      let notices = [];
      let tenants = 0;
      let studentDocs = [];

      try {
        [studentCount, teacherCount, classCount, fees, attendance, exams, notices, tenants, studentDocs] =
          await Promise.all([
            Student.countDocuments(tq),
            Teacher.countDocuments(tq),
            ClassModel.countDocuments(tq),
            FeePayment.find(tq).lean(),
            Attendance.find(tq).lean(),
            Exam.find(tq).sort({ startDate: 1 }).limit(5).lean(),
            Notice.find(tq).sort({ createdAt: -1 }).limit(5).lean(),
            req.user.role === 'admin' ? Tenant.countDocuments() : Promise.resolve(0),
            Student.find(tq).sort({ createdAt: -1 }).limit(10).lean(),
          ]);
      } catch {
        const db = readDb();
        const rows = (db.students || []).filter((s) => !tenantId || s.tenantId === tenantId);
        studentCount = rows.length;
        teacherCount = (db.teachers || []).length;
        classCount = (db.classes || []).length;
        fees = db.fees || [];
        attendance = db.attendance || [];
        exams = db.exams || [];
        notices = db.notices || [];
        tenants = (db.tenants || []).length;
        studentDocs = rows;
      }

      // NOTE: do NOT backfill from data.json when the live count is 0 — a genuinely
      // empty tenant must show zeros, not demo data from the JSON fallback store.

      const pendingFees = fees.filter((f) => f.status === 'pending' || f.status === 'overdue');
      const paidFees = fees.filter((f) => f.status === 'paid');
      const paidAmount = paidFees.reduce((s, f) => s + Number(f.amount || 0), 0);
      const pendingAmount = pendingFees.reduce((s, f) => s + Number(f.amount || 0), 0);

      const recentAdmissions = (studentDocs.length ? studentDocs : []).slice(0, 5).map((s) => ({
        id: String(s._id || s.id),
        name: s.name || 'Student',
        className: `${s.studentClass || s.class || ''}${s.section ? ` ${s.section}` : ''}`.trim(),
        date: s.admissionDate || (s.createdAt ? new Date(s.createdAt).toISOString().slice(0, 10) : 'Today'),
      }));

      return res.json({
        role,
        counts: {
          students: studentCount,
          teachers: teacherCount,
          classes: classCount,
          schools: tenants,
          pendingFees: pendingFees.length,
        },
        todayAttendancePct: attendancePercent(attendance),
        finance: {
          paidFees: paidAmount,
          pendingFeeAmount: pendingAmount,
          totalFeeAmount: paidAmount + pendingAmount,
        },
        feeCollection: fees.slice(-6).map((f) => ({
          label: f.head || f.dueDate || 'Fee',
          value: f.amount,
          status: f.status,
        })),
        studentGrowth: studentGrowthFromList(studentDocs.slice().reverse()),
        attendanceTrend: attendance.slice(-7).map((a) => ({
          label: a.date,
          value: a.status === 'present' ? 100 : 0,
        })),
        recentAdmissions,
        upcomingExams: exams.map((e) => ({
          id: String(e._id),
          title: e.name,
          type: e.type,
          when: e.startDate,
          className: e.classId,
        })),
        recentNotices: notices,
      });
    }

    const db = readDb();
    let students = db.students || [];
    if (tenantId) students = students.filter((s) => s.tenantId === tenantId);
    const teachers = db.teachers || [];
    const attendance = db.attendance || [];
    const fees = db.fees || [];
    const pendingFees = fees.filter((f) => f.status === 'pending');

    res.json({
      role,
      counts: {
        students: students.length,
        teachers: teachers.length,
        classes: (db.classes || []).length,
        schools: (db.tenants || []).length,
        pendingFees: pendingFees.length,
      },
      todayAttendancePct: attendancePercent(attendance),
      finance: {
        paidFees: fees.filter((f) => f.status === 'paid').reduce((s, f) => s + Number(f.amount || 0), 0),
        pendingFeeAmount: pendingFees.reduce((s, f) => s + Number(f.amount || 0), 0),
      },
      studentGrowth: studentGrowthFromList(students),
      recentAdmissions: recentAdmissionsFromJson(db, tenantId),
      recentNotices: (db.notices || []).slice(0, 5),
      upcomingExams: (db.exams || []).slice(0, 5).map((e) => ({
        id: e.id,
        title: e.name,
        type: e.type,
        when: e.startDate,
      })),
    });
  }),
);

export default router;
