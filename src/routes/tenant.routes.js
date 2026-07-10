import { Router } from 'express';
import { makeCrudController } from '../utils/crudController.js';
import { hashPassword } from '../utils/password.js';
import { User } from '../models/index.js';
import { requestEmailOtp, verifyEmailOtp } from '../services/otp.service.js';
import {
  Student,
  Teacher,
  Class,
  Section,
  Attendance,
  FeeCategory,
  FeeStructure,
  FeePayment,
  StudentFeeAssignment,
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
  Enquiry,
  Admission,
  LeaveRequest,
  PayrollRecord,
  HostelRoom,
  HostelAllocation,
  LmsCourse,
  InventoryItem,
  FeeConcession,
} from '../models/index.js';
import * as dashboardCtrl from '../controllers/dashboard.controller.js';
import * as feeCtrl from '../controllers/fee.controller.js';

function mountCrud(router, path, Model, options = {}) {
  const ctrl = makeCrudController(Model, options);
  router.get(path, ctrl.list);
  router.get(`${path}/:id`, ctrl.get);
  router.post(path, ctrl.create);
  router.put(`${path}/:id`, ctrl.update);
  router.patch(`${path}/:id`, ctrl.update);
  router.delete(`${path}/:id`, ctrl.remove);
}


function teacherOtpScope(req) {
  return `teacher_create:${req.tenant?.schoolId || req.user?.school_id || 'school'}`;
}

function studentLoginId(schoolId, rollNumber) {
  const roll = String(rollNumber || Date.now()).trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
  return `student.${schoolId}.${roll}@scholify.local`;
}
const router = Router();

router.get('/dashboard/summary', dashboardCtrl.dashboardSummary);
router.post('/teachers/request-otp', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ success: false, message: 'Teacher email is required' });
    const existing = await User.findOne({ where: { email } });
    if (existing) return res.status(409).json({ success: false, message: 'Teacher email already registered' });
    const otp = await requestEmailOtp(email, teacherOtpScope(req), 'teacher account verification');
    return res.json({ success: true, data: { sent: true, devOtp: otp.devOtp }, message: otp.message });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Could not send OTP' });
  }
});

mountCrud(router, '/students', Student, {
  beforeCreate: async (payload, req) => {
    const password = String(payload.password || payload.temp_password || '').trim();
    const rollNumber = payload.roll_number || payload.roll_no || payload.rollNo;
    if (rollNumber) payload.roll_number = rollNumber;
    if (payload.class_id && !Number.isFinite(Number(payload.class_id))) delete payload.class_id;
    if (payload.section_id && !Number.isFinite(Number(payload.section_id))) delete payload.section_id;
    if (password) {
      if (!payload.name || !rollNumber) throw new Error('Student name and roll number are required');
      const email = String(payload.email || studentLoginId(req.tenant.schoolId, rollNumber)).trim().toLowerCase();
      const existing = await User.findOne({ where: { email } });
      if (existing) {
        payload.user_id = existing.id;
      } else {
        const user = await User.create({
          school_id: req.tenant.schoolId,
          name: payload.name,
          email,
          password: await hashPassword(password),
          role: 'student',
          status: 'active',
        });
        payload.user_id = user.id;
      }
    }
    delete payload.email;
    delete payload.roll_no;
    delete payload.password;
    delete payload.temp_password;
    return payload;
  },
});

mountCrud(router, '/teachers', Teacher, {
  beforeCreate: async (payload, req) => {
    const otp = String(payload.otp || '').trim();
    const tempPassword = String(payload.temp_password || payload.password || '').trim();

    if (!payload.email) throw new Error('Teacher email is required');
    if (!verifyEmailOtp(payload.email, otp, teacherOtpScope(req))) {
      throw new Error('Invalid or expired teacher email OTP');
    }
    if (!tempPassword || tempPassword.length < 8) {
      throw new Error('Teacher password must be at least 8 characters');
    }

    if (!payload.user_id) {
      const existing = await User.findOne({ where: { email: payload.email } });
      if (existing) {
        payload.user_id = existing.id;
      } else {
        const user = await User.create({
          school_id: req.tenant.schoolId,
          name: payload.name,
          email: payload.email,
          password: await hashPassword(tempPassword),
          role: 'teacher',
          status: 'active',
        });
        payload.user_id = user.id;
      }
    }
    delete payload.temp_password;
    delete payload.password;
    delete payload.otp;
    delete payload.email;
    return payload;
  },
});

mountCrud(router, '/classes', Class);
mountCrud(router, '/sections', Section);
mountCrud(router, '/attendance', Attendance, {
  beforeCreate: async (payload, req) => {
    if (!payload.marked_by) payload.marked_by = req.user.id;
    return payload;
  },
});

router.get('/fees/ledger/:studentId', feeCtrl.studentLedger);
router.get('/fees/reports/due', feeCtrl.dueReport);
router.get('/fees/reports/collection', feeCtrl.collectionReport);

mountCrud(router, '/fee-categories', FeeCategory);
mountCrud(router, '/fee-structures', FeeStructure);
mountCrud(router, '/student-fee-assignments', StudentFeeAssignment, {
  beforeCreate: async (payload) => {
    if (!payload.assigned_on) payload.assigned_on = new Date().toISOString().slice(0, 10);
    return payload;
  },
});
mountCrud(router, '/fee-payments', FeePayment, {
  beforeCreate: async (payload, req) => {
    if (!payload.collected_by) payload.collected_by = req.user.id;
    if (!payload.payment_date) payload.payment_date = new Date().toISOString().slice(0, 10);
    return payload;
  },
});

mountCrud(router, '/exams', Exam);
mountCrud(router, '/exam-results', ExamResult, {
  beforeCreate: async (payload, req) => {
    if (!payload.school_id) payload.school_id = req.tenant.schoolId;
    return payload;
  },
});

mountCrud(router, '/notices', Notice, {
  beforeCreate: async (payload, req) => {
    if (!payload.posted_by) payload.posted_by = req.user.id;
    if (payload.body && !payload.content) {
      payload.content = payload.body;
      delete payload.body;
    }
    if (payload.audience && !payload.target) {
      payload.target = payload.audience;
      delete payload.audience;
    }
    return payload;
  },
});

mountCrud(router, '/homework', Homework, {
  beforeCreate: async (payload, req) => {
    if (!payload.created_by) payload.created_by = req.user.id;
    return payload;
  },
});

mountCrud(router, '/books', Book);
mountCrud(router, '/book-issues', BookIssue);
mountCrud(router, '/transport-routes', TransportRoute);
mountCrud(router, '/transport-assignments', TransportAssignment);
mountCrud(router, '/broadcasts', Broadcast, {
  beforeCreate: async (payload, req) => {
    if (!payload.sent_by) payload.sent_by = req.user.id;
    if (!payload.status) payload.status = 'sent';
    return payload;
  },
});

mountCrud(router, '/notifications', Notification);

mountCrud(router, '/enquiries', Enquiry);
mountCrud(router, '/admissions', Admission);
mountCrud(router, '/leave-requests', LeaveRequest);
mountCrud(router, '/payroll-records', PayrollRecord);
mountCrud(router, '/hostel-rooms', HostelRoom);
mountCrud(router, '/hostel-allocations', HostelAllocation);
mountCrud(router, '/lms-courses', LmsCourse);
mountCrud(router, '/inventory-items', InventoryItem);
mountCrud(router, '/fee-concessions', FeeConcession);

export default router;



