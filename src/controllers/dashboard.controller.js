import {
  Student,
  Teacher,
  Class,
  Section,
  Attendance,
  FeeStructure,
  FeePayment,
  Exam,
  ExamResult,
  Notice,
  Homework,
  Book,
  BookIssue,
  TransportRoute,
  TransportAssignment,
  Broadcast,
  Notification,
} from '../models/index.js';
import { ok, fail } from '../utils/apiResponse.js';

export async function dashboardSummary(req, res) {
  try {
    const schoolId = req.tenant.schoolId;

    const [
      students,
      teachers,
      classes,
      notices,
      exams,
      payments,
      attendance,
    ] = await Promise.all([
      Student.count({ where: { school_id: schoolId } }),
      Teacher.count({ where: { school_id: schoolId } }),
      Class.count({ where: { school_id: schoolId } }),
      Notice.findAll({ where: { school_id: schoolId }, limit: 5, order: [['id', 'DESC']] }),
      Exam.findAll({ where: { school_id: schoolId }, limit: 3, order: [['exam_date', 'DESC']] }),
      FeePayment.findAll({ where: { school_id: schoolId } }),
      Attendance.findAll({
        where: { school_id: schoolId },
        limit: 200,
        order: [['date', 'DESC']],
      }),
    ]);

    const present = attendance.filter((a) => a.status === 'present').length;
    const todayPct = attendance.length ? Math.round((present / attendance.length) * 100) : 0;
    const paidTotal = payments.reduce((s, p) => s + Number(p.amount_paid || 0), 0);

    return ok(res, {
      counts: {
        students,
        teachers,
        classes,
        pendingFees: Math.max(0, students * 2 - payments.length),
      },
      todayAttendancePct: todayPct,
      feeCollectedMonth: paidTotal,
      finance: {
        paidFees: paidTotal,
        pendingFeeAmount: Math.max(0, students * 4500 - paidTotal),
        totalFeeAmount: students * 4500,
      },
      recentNotices: notices.map((n) => ({
        id: n.id,
        title: n.title,
        priority: n.is_pinned ? 'high' : 'mid',
      })),
      upcomingExams: exams.map((e) => ({
        id: e.id,
        title: e.name,
        type: 'Exam',
        when: e.exam_date,
        className: String(e.class_id),
      })),
    });
  } catch (err) {
    return fail(res, err.message, 500);
  }
}
