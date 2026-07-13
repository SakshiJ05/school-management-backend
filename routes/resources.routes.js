import express from 'express';
import mongoose from 'mongoose';
import ClassModel from '../models/class.model.js';
import Section from '../models/section.model.js';
import Subject from '../models/subject.model.js';
import Attendance from '../models/attendance.model.js';
import Exam from '../models/exam.model.js';
import Mark from '../models/mark.model.js';
import FeeStructure from '../models/feeStructure.model.js';
import FeePayment from '../models/feePayment.model.js';
import Book from '../models/book.model.js';
import BookIssue from '../models/bookIssue.model.js';
import Notice from '../models/notice.model.js';
import Homework from '../models/homework.model.js';
import Message from '../models/message.model.js';
import Timetable from '../models/timetable.model.js';
import SiteConfig from '../models/siteConfig.model.js';
import Tenant from '../models/tenant.model.js';
import AuditLog from '../models/auditLog.model.js';
import Student from '../models/student.model.js';
import Teacher from '../models/teacher.model.js';
import {
  FeeCategory,
  FeeConcession,
  StudentFeeAssignment,
  Broadcast,
  TransportRoute,
  TransportAssignment,
  Enquiry,
  Admission,
  LeaveRequest,
  PayrollRecord,
  HostelRoom,
  HostelAllocation,
  LmsCourse,
  InventoryItem,
} from '../models/erp.models.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { enforceSubscription } from '../middleware/subscription.middleware.js';
import { permit, permitAny } from '../middleware/rbac.middleware.js';
import { audit } from '../middleware/audit.middleware.js';
import { tenantQuery } from '../utils/tenantFilter.js';
import { calculateGrade, reportCardSummary, buildReportCard } from '../services/grade.service.js';
import { generateTimetable } from '../services/timetable.service.js';
import { emitTenant } from '../services/realtime.service.js';
import { readDb, writeDb } from '../utils/db.js';
import { toCsv } from '../utils/csv.js';
import {
  createNotification,
  notifyLinkedStudent,
  notifySafely,
  notifyTenantAdmins,
} from '../services/notification.service.js';

const router = express.Router();
const mongoReady = () => mongoose.connection.readyState === 1;

function linkedStudentId(req) {
  return ['student', 'parent'].includes(req.user?.role)
    ? req.user?.linkedStudentId?.toString?.() || null
    : undefined;
}

function applyLinkedStudentScope(req, query) {
  const studentId = linkedStudentId(req);
  if (studentId !== undefined) query.studentId = studentId || new mongoose.Types.ObjectId();
  return query;
}

// Enforce tenant subscription (suspend/expiry) across all resource routes.
// Runs before the per-route requireAuth so req.user/req.tenantId are resolved here.
router.use(requireAuth, enforceSubscription);

/**
 * Schools the caller can see — for a school user, their own tenant.
 *
 * The app has always called this to resolve a school code to an id, but the route
 * did not exist: every call 404'd after a full round trip, several times per page
 * load, and the error was swallowed silently.
 */
router.get(
  '/tenant/schools',
  asyncHandler(async (req, res) => {
    if (!mongoReady()) {
      const rows = (readDb().tenants || []).filter((t) => !req.tenantId || t.id === req.tenantId);
      return res.json(rows.map((t) => ({ ...t, code: t.slug })));
    }

    const tenants = req.tenantId
      ? await Tenant.find({ _id: req.tenantId }).lean()
      : await Tenant.find().lean();

    res.json(
      tenants.map((t) => ({
        id: String(t._id),
        code: t.slug,
        name: t.name,
        subdomain: t.subdomain || '',
        plan: t.plan,
        status: t.status,
        city: '',
        logoUrl: t.logoUrl || '',
      })),
    );
  }),
);

/** Current tenant's plan, status and usage — drives frontend module gating. */
router.get(
  '/subscription/me',
  asyncHandler(async (req, res) => {
    const status = req.subscription || {};
    const plan = status.plan;
    let usage = { students: 0, teachers: 0 };
    if (mongoReady() && req.tenantId) {
      const [students, teachers] = await Promise.all([
        Student.countDocuments(tenantQuery(req)),
        Teacher.countDocuments(tenantQuery(req)),
      ]);
      usage = { students, teachers };
    }
    res.json({
      plan: plan
        ? {
            id: plan._id,
            name: plan.name,
            slug: plan.slug,
            price: plan.price,
            currency: plan.currency,
            features: plan.features || [],
            modules: plan.modules || [],
            maxStudents: plan.maxStudents || 0,
            maxTeachers: plan.maxTeachers || 0,
          }
        : null,
      status: {
        suspended: Boolean(status.tenantSuspended),
        expired: Boolean(status.expired),
        hasSubscription: Boolean(status.hasSubscription),
        endDate: status.subscription?.endDate || null,
      },
      usage,
    });
  }),
);

function crudRoutes(Model, resource, opts = {}) {
  const r = express.Router();
  const readPerm = permit(resource, 'read');
  const createPerm = permit(resource, 'create');
  const updatePerm = permit(resource, 'update');
  const deletePerm = permit(resource, 'delete');

  r.get(
    '/',
    requireAuth,
    readPerm,
    asyncHandler(async (req, res) => {
      if (!mongoReady()) {
        const key = opts.jsonKey || resource;
        let rows = readDb()[key] || [];
        if (req.tenantId) rows = rows.filter((row) => row.tenantId === req.tenantId);
        if (opts.studentScoped) {
          const own = linkedStudentId(req);
          if (own !== undefined) rows = rows.filter((row) => String(row.studentId) === own);
        }
        return res.json(rows);
      }
      const query = opts.studentScoped ? applyLinkedStudentScope(req, tenantQuery(req)) : tenantQuery(req);
      const rows = await Model.find(query).sort({ createdAt: -1 }).lean();
      res.json(rows.map((row) => ({ ...row, id: row._id })));
    }),
  );

  r.get(
    '/:id',
    requireAuth,
    readPerm,
    asyncHandler(async (req, res) => {
      if (!mongoReady()) {
        const row = (readDb()[opts.jsonKey || resource] || []).find((x) => x.id === req.params.id);
        if (!row) return res.status(404).json({ message: 'Not found' });
        return res.json(row);
      }
      const row = await Model.findOne({ _id: req.params.id, ...tenantQuery(req) }).lean();
      if (!row) return res.status(404).json({ message: 'Not found' });
      res.json({ ...row, id: row._id });
    }),
  );

  r.post(
    '/',
    requireAuth,
    createPerm,
    audit('create', resource),
    asyncHandler(async (req, res) => {
      if (!mongoReady()) {
        const db = readDb();
        const key = opts.jsonKey || resource;
        const row = { id: `id_${Date.now()}`, ...req.body };
        db[key] = db[key] || [];
        db[key].push(row);
        writeDb(db);
        emitTenant(req.tenantId, `${resource}:created`, row);
        return res.status(201).json(row);
      }
      const created = await Model.create({ ...req.body, ...tenantQuery(req) });
      emitTenant(req.tenantId, `${resource}:created`, created);
      if (opts.afterCreate) notifySafely(opts.afterCreate(req, created), `${resource}/created`);
      res.status(201).json({ ...created.toObject(), id: created._id });
    }),
  );

  // The Angular client sends PATCH for edits; keep PUT for API compatibility.
  const updateChain = [
    requireAuth,
    updatePerm,
    audit('update', resource),
    asyncHandler(async (req, res) => {
      if (!mongoReady()) {
        const db = readDb();
        const key = opts.jsonKey || resource;
        const idx = (db[key] || []).findIndex((x) => x.id === req.params.id);
        if (idx === -1) return res.status(404).json({ message: 'Not found' });
        db[key][idx] = { ...db[key][idx], ...req.body };
        writeDb(db);
        emitTenant(req.tenantId, `${resource}:updated`, db[key][idx]);
        return res.json(db[key][idx]);
      }
      const updated = await Model.findOneAndUpdate(
        { _id: req.params.id, ...tenantQuery(req) },
        req.body,
        { new: true, runValidators: true },
      );
      if (!updated) return res.status(404).json({ message: 'Not found' });
      emitTenant(req.tenantId, `${resource}:updated`, updated);
      res.json({ ...updated.toObject(), id: updated._id });
    }),
  ];
  r.put('/:id', ...updateChain);
  r.patch('/:id', ...updateChain);

  r.delete(
    '/:id',
    requireAuth,
    deletePerm,
    audit('delete', resource),
    asyncHandler(async (req, res) => {
      if (!mongoReady()) {
        const db = readDb();
        const key = opts.jsonKey || resource;
        db[key] = (db[key] || []).filter((x) => x.id !== req.params.id);
        writeDb(db);
        emitTenant(req.tenantId, `${resource}:deleted`, { id: req.params.id });
        return res.status(204).send();
      }
      const deleted = await Model.findOneAndDelete({ _id: req.params.id, ...tenantQuery(req) });
      if (!deleted) return res.status(404).json({ message: 'Not found' });
      emitTenant(req.tenantId, `${resource}:deleted`, { id: req.params.id });
      res.status(204).send();
    }),
  );

  return r;
}

router.use('/classes', crudRoutes(ClassModel, 'classes', { jsonKey: 'classes' }));
router.use('/sections', crudRoutes(Section, 'classes', { jsonKey: 'sections' }));
router.use('/subjects', crudRoutes(Subject, 'subjects', { jsonKey: 'subjects' }));
router.use('/exams', crudRoutes(Exam, 'exams', { jsonKey: 'exams' }));
router.use('/fee-structures', crudRoutes(FeeStructure, 'fees', { jsonKey: 'feeStructures' }));
async function notifyAudience(req, source, fallbackTitle) {
  const raw = Array.isArray(source.audience) ? source.audience : ['all'];
  const roleMap = { parents: 'student', parent: 'student', students: 'student', class: 'student', teachers: 'teacher' };
  const roles = new Set(raw.map((role) => roleMap[role] || role));
  const supported = ['admin', 'teacher', 'student', 'all'];
  const targets = roles.has('all') ? ['all'] : [...roles].filter((role) => supported.includes(role));
  await Promise.all(targets.map((targetRole) => createNotification({
    tenantId: req.tenantId,
    title: source.title || source.subject || fallbackTitle,
    message: source.body || source.message || fallbackTitle,
    targetRole,
    createdBy: req.user._id || req.user.id,
  })));
}

router.use('/notices', crudRoutes(Notice, 'notices', {
  jsonKey: 'notices',
  afterCreate: (req, notice) => notifyAudience(req, notice, 'New notice published'),
}));
router.use('/homework', crudRoutes(Homework, 'homework', { jsonKey: 'homework' }));

/**
 * Resource mounts matching the collection names the Angular client actually
 * requests (see frontend `core/services/*.service.ts`). Previously these all
 * 404'd, which killed the transport / admissions / HR / hostel / LMS /
 * inventory / communication / fee-admin / notification modules at runtime.
 * The custom endpoints below (/attendance, /fees, /timetable, /library/*) stay
 * as-is for the flows that need their special logic.
 */
router.use('/attendanceRecords', crudRoutes(Attendance, 'attendance', { jsonKey: 'attendance' }));
router.use('/feeStructures', crudRoutes(FeeStructure, 'fees', { jsonKey: 'feeStructures' }));
async function notifyFeeEvent(req, fee, verb = 'recorded') {
  const createdBy = req.user._id || req.user.id;
  const message = `A fee payment of ₹${Number(fee.amountPaid || fee.amount || 0).toLocaleString('en-IN')} was ${verb}.`;
  await Promise.all([
    notifyTenantAdmins({ tenantId: req.tenantId, title: 'Fee payment update', message, createdBy }),
    notifyLinkedStudent({ tenantId: req.tenantId, studentId: fee.studentId, title: 'Fee payment update', message, createdBy }),
  ]);
}

router.use('/feePayments', crudRoutes(FeePayment, 'fees', {
  jsonKey: 'fees',
  studentScoped: true,
  afterCreate: (req, fee) => notifyFeeEvent(req, fee),
}));
router.use('/feeCategories', crudRoutes(FeeCategory, 'fees'));
router.use('/feeConcessions', crudRoutes(FeeConcession, 'fees', { studentScoped: true }));
router.use('/studentFeeAssignments', crudRoutes(StudentFeeAssignment, 'fees', { studentScoped: true }));
router.use('/timetables', crudRoutes(Timetable, 'timetable', { jsonKey: 'timetable' }));
router.use('/books', crudRoutes(Book, 'library', { jsonKey: 'libraryBooks' }));
router.use('/bookIssues', crudRoutes(BookIssue, 'library', { jsonKey: 'bookIssues' }));
router.use('/schoolSettings', crudRoutes(SiteConfig, 'settings', { jsonKey: 'siteConfig' }));
router.use('/broadcasts', crudRoutes(Broadcast, 'messages', {
  afterCreate: (req, broadcast) => notifyAudience(req, broadcast, 'New circular published'),
}));
router.use('/transportRoutes', crudRoutes(TransportRoute, 'transport'));
router.use('/transportAssignments', crudRoutes(TransportAssignment, 'transport'));
router.use('/enquiries', crudRoutes(Enquiry, 'admissions'));
router.use('/admissions', crudRoutes(Admission, 'admissions'));
router.use('/leaveRequests', crudRoutes(LeaveRequest, 'hr', {
  afterCreate: (req, leave) => leave.status === 'pending'
    ? notifyTenantAdmins({
        tenantId: req.tenantId,
        title: 'Leave request submitted',
        message: `${leave.employeeName || leave.teacherName || 'A staff member'} submitted a leave request.`,
        createdBy: req.user._id || req.user.id,
      })
    : null,
}));
router.use('/payrollRecords', crudRoutes(PayrollRecord, 'hr'));
router.use('/hostelRooms', crudRoutes(HostelRoom, 'hostel'));
router.use('/hostelAllocations', crudRoutes(HostelAllocation, 'hostel'));
router.use('/lmsCourses', crudRoutes(LmsCourse, 'lms'));
router.use('/inventoryItems', crudRoutes(InventoryItem, 'inventory'));

function jsonRows(req, key) {
  let rows = readDb()[key] || [];
  if (req.tenantId) rows = rows.filter((r) => r.tenantId === req.tenantId);
  return rows;
}

router.get(
  '/fees',
  requireAuth,
  permit('fees', 'read'),
  asyncHandler(async (req, res) => {
    if (!mongoReady()) {
      const own = linkedStudentId(req);
      const rows = jsonRows(req, 'fees').filter((row) => own === undefined || String(row.studentId) === own);
      return res.json(rows);
    }
    const rows = await FeePayment.find(applyLinkedStudentScope(req, tenantQuery(req)))
      .populate('studentId', 'name admissionNo')
      .lean();
    res.json(
      rows.map((r) => ({
        ...r,
        id: r._id,
        studentName: r.studentId?.name,
      })),
    );
  }),
);

router.post(
  '/fees',
  requireAuth,
  permit('fees', 'create'),
  audit('create', 'fees'),
  asyncHandler(async (req, res) => {
    if (!mongoReady()) {
      const db = readDb();
      const row = { id: `f_${Date.now()}`, ...req.body };
      db.fees = db.fees || [];
      db.fees.push(row);
      writeDb(db);
      return res.status(201).json(row);
    }
    const created = await FeePayment.create({ ...req.body, ...tenantQuery(req) });
    emitTenant(req.tenantId, 'fees:created', created);
    notifySafely(notifyFeeEvent(req, created), 'fees/created');
    res.status(201).json(created);
  }),
);

/** Sequential, tenant-scoped receipt number (RCP<year><seq>). */
async function generateReceiptNo(req) {
  const year = new Date().getFullYear();
  const prefix = `RCP${year}`;
  let seq = (await FeePayment.countDocuments({ ...tenantQuery(req), receiptNo: new RegExp(`^${prefix}`) })) + 1;
  for (let i = 0; i < 50; i++) {
    const candidate = `${prefix}${String(seq).padStart(5, '0')}`;
    const clash = await FeePayment.exists({ ...tenantQuery(req), receiptNo: candidate });
    if (!clash) return candidate;
    seq += 1;
  }
  return `${prefix}${Date.now().toString().slice(-6)}`;
}

router.post(
  '/fees/:id/pay',
  requireAuth,
  permitAny([
    ['fees', 'update'],
    ['fees', 'create'],
  ]),
  asyncHandler(async (req, res) => {
    if (!mongoReady()) return res.status(503).json({ message: 'MongoDB required for payments' });
    const fee = await FeePayment.findOne({ _id: req.params.id, ...tenantQuery(req) });
    if (!fee) return res.status(404).json({ message: 'Fee not found' });

    const alreadyPaid = Number(fee.amountPaid || 0);
    const balance = Math.max(0, Number(fee.amount || 0) - alreadyPaid);
    // Pay the requested amount, or clear the full remaining balance by default.
    const requested = Number(req.body?.amount);
    const payNow = requested > 0 ? Math.min(requested, balance) : balance;
    if (payNow <= 0) {
      return res.status(400).json({ message: 'This fee is already fully paid.' });
    }

    const newPaid = alreadyPaid + payNow;
    fee.amountPaid = newPaid;
    fee.status = newPaid >= Number(fee.amount) ? 'paid' : 'partial';
    fee.paidDate = new Date().toISOString().slice(0, 10);
    fee.paymentMethod = req.body?.paymentMethod || 'online';
    fee.transactionId = req.body?.transactionId || `txn_${Date.now()}`;
    if (!fee.receiptNo) fee.receiptNo = await generateReceiptNo(req);
    await fee.save();

    emitTenant(req.tenantId, 'fees:paid', fee);
    notifySafely(notifyFeeEvent(req, fee, 'received'), 'fees/paid');
    res.json({ ...fee.toObject(), id: fee._id, paidNow: payNow, balance: Math.max(0, Number(fee.amount) - newPaid) });
  }),
);

router.get(
  '/attendance',
  requireAuth,
  permit('attendance', 'read'),
  asyncHandler(async (req, res) => {
    const { date, studentId, month } = req.query;
    if (!mongoReady()) {
      let rows = readDb().attendance || [];
      const own = linkedStudentId(req);
      if (own !== undefined) rows = rows.filter((r) => String(r.studentId) === own);
      if (date) rows = rows.filter((r) => r.date === date);
      if (studentId && own === undefined) rows = rows.filter((r) => r.studentId === studentId);
      if (month) rows = rows.filter((r) => r.date?.startsWith(month));
      return res.json(rows);
    }
    const q = applyLinkedStudentScope(req, tenantQuery(req));
    if (date) q.date = date;
    if (studentId && linkedStudentId(req) === undefined) q.studentId = studentId;
    if (month) q.date = new RegExp(`^${month}`);
    const rows = await Attendance.find(q).populate('studentId', 'name rollNo').lean();
    res.json(rows.map((r) => ({ ...r, id: r._id, studentName: r.studentId?.name })));
  }),
);

router.post(
  '/attendance',
  requireAuth,
  permit('attendance', 'create'),
  asyncHandler(async (req, res) => {
    const { studentId, date, status, remarks } = req.body || {};
    if (!studentId || !date || !status) {
      return res.status(400).json({ message: 'studentId, date, status required' });
    }
    if (!mongoReady()) {
      const db = readDb();
      db.attendance = db.attendance || [];
      const dup = db.attendance.find((r) => r.studentId === studentId && r.date === date);
      if (dup) {
        dup.status = status;
        dup.remarks = remarks || '';
        writeDb(db);
        return res.json(dup);
      }
      const row = { id: `att_${Date.now()}`, studentId, date, status, remarks: remarks || '' };
      db.attendance.push(row);
      writeDb(db);
      return res.status(201).json(row);
    }
    const row = await Attendance.findOneAndUpdate(
      { ...tenantQuery(req), studentId, date },
      { status, remarks: remarks || '', ...tenantQuery(req) },
      { upsert: true, new: true },
    );
    emitTenant(req.tenantId, 'attendance:updated', row);
    res.status(201).json(row);
  }),
);

/**
 * Save a whole day's register in one request.
 *
 * The UI previously fired one request per student against the generic
 * /attendanceRecords CRUD route, which both failed validation and made a class
 * of 40 cost 40 round trips. Rows are upserted on (tenant, student, date), so
 * re-saving a day updates it instead of colliding with the unique index.
 * Per-row failures are reported rather than sinking the whole batch.
 */
router.post(
  '/attendance/bulk',
  requireAuth,
  permit('attendance', 'create'),
  asyncHandler(async (req, res) => {
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    if (!rows.length) {
      return res.status(400).json({ message: 'rows[] is required' });
    }

    const failed = [];
    const valid = [];
    for (const row of rows) {
      const studentId = row?.studentId;
      const date = row?.date;
      const status = row?.status;
      if (!studentId || !date || !status) {
        failed.push({ studentId: studentId ?? null, reason: 'studentId, date and status are required' });
        continue;
      }
      if (!['present', 'absent', 'late', 'excused', 'leave'].includes(String(status))) {
        failed.push({ studentId, reason: `Invalid status "${status}"` });
        continue;
      }
      valid.push({ studentId, date, status, remarks: row.remarks ?? row.note ?? '' });
    }

    if (!mongoReady()) {
      const db = readDb();
      db.attendance = db.attendance || [];
      for (const row of valid) {
        const existing = db.attendance.find((r) => r.studentId === row.studentId && r.date === row.date);
        if (existing) {
          Object.assign(existing, { status: row.status, remarks: row.remarks });
        } else {
          db.attendance.push({ id: `att_${Date.now()}_${row.studentId}`, ...row });
        }
      }
      writeDb(db);
      emitTenant(req.tenantId, 'attendance:updated', { count: valid.length });
      return res.status(failed.length ? 207 : 201).json({ saved: valid.length, failed });
    }

    let saved = 0;
    if (valid.length) {
      const ops = valid.map((row) => ({
        updateOne: {
          filter: { ...tenantQuery(req), studentId: row.studentId, date: row.date },
          update: { $set: { status: row.status, remarks: row.remarks, ...tenantQuery(req) } },
          upsert: true,
        },
      }));
      try {
        const result = await Attendance.bulkWrite(ops, { ordered: false });
        // matchedCount already covers the modified rows — adding modifiedCount too
        // would double-count every row that was updated rather than inserted.
        saved = (result.upsertedCount || 0) + (result.matchedCount || 0);
      } catch (err) {
        // ordered:false still applies the good rows; report only the ones that broke.
        saved = err.result?.nUpserted ?? 0;
        for (const writeError of err.writeErrors ?? []) {
          const row = valid[writeError.index];
          failed.push({ studentId: row?.studentId ?? null, reason: writeError.errmsg || 'Write failed' });
        }
        if (!(err.writeErrors ?? []).length) throw err;
      }
    }

    emitTenant(req.tenantId, 'attendance:updated', { count: saved });
    res.status(failed.length ? 207 : 201).json({ saved, failed });
  }),
);

router.get(
  '/attendance/report',
  requireAuth,
  permit('attendance', 'read'),
  asyncHandler(async (req, res) => {
    const { month } = req.query;
    if (!mongoReady()) {
      const own = linkedStudentId(req);
      const rows = (readDb().attendance || []).filter(
        (r) => (own === undefined || String(r.studentId) === own) && (!month || r.date?.startsWith(month)),
      );
      const map = new Map();
      for (const row of rows) {
        const item = map.get(row.studentId) || {
          studentId: row.studentId,
          present: 0,
          absent: 0,
          leave: 0,
          total: 0,
          percentage: 0,
          alert: false,
        };
        if (row.status === 'present') item.present += 1;
        if (row.status === 'absent') item.absent += 1;
        if (row.status === 'leave') item.leave += 1;
        item.total += 1;
        item.percentage = item.total ? Math.round((item.present / item.total) * 100) : 0;
        item.alert = item.percentage < 75;
        map.set(row.studentId, item);
      }
      return res.json([...map.values()]);
    }
    const q = applyLinkedStudentScope(req, tenantQuery(req));
    if (month) q.date = new RegExp(`^${month}`);
    const rows = await Attendance.find(q).lean();
    const map = new Map();
    for (const row of rows) {
      const sid = String(row.studentId);
      const item = map.get(sid) || { studentId: sid, present: 0, absent: 0, leave: 0, total: 0 };
      if (row.status === 'present') item.present += 1;
      if (row.status === 'absent') item.absent += 1;
      if (row.status === 'leave') item.leave += 1;
      item.total += 1;
      item.percentage = item.total ? Math.round((item.present / item.total) * 100) : 0;
      item.alert = item.percentage < 75;
      map.set(sid, item);
    }
    res.json([...map.values()]);
  }),
);

router.get(
  '/marks',
  requireAuth,
  permit('exams', 'read'),
  asyncHandler(async (req, res) => {
    if (!mongoReady()) {
      const own = linkedStudentId(req);
      return res.json((readDb().marks || []).filter((m) => own === undefined || String(m.studentId) === own));
    }
    const q = applyLinkedStudentScope(req, tenantQuery(req));
    if (req.query.examId) q.examId = req.query.examId;
    if (req.query.studentId && linkedStudentId(req) === undefined) q.studentId = req.query.studentId;
    res.json(await Mark.find(q).lean());
  }),
);

router.post(
  '/marks',
  requireAuth,
  permit('exams', 'create'),
  asyncHandler(async (req, res) => {
    const { examId, studentId, subjectId, marksObtained, maxMarks } = req.body || {};
    const grade = calculateGrade(Number(marksObtained), Number(maxMarks || 100));
    if (!mongoReady()) {
      const db = readDb();
      db.marks = db.marks || [];
      const row = { id: `mk_${Date.now()}`, examId, studentId, subjectId, marksObtained, maxMarks, grade };
      db.marks.push(row);
      writeDb(db);
      return res.status(201).json(row);
    }
    const created = await Mark.findOneAndUpdate(
      { ...tenantQuery(req), examId, studentId, subjectId },
      { marksObtained, maxMarks: maxMarks || 100, grade, ...tenantQuery(req) },
      { upsert: true, new: true },
    );
    res.status(201).json(created);
  }),
);

router.get(
  '/marks/report-card/:studentId',
  requireAuth,
  permit('exams', 'read'),
  asyncHandler(async (req, res) => {
    const own = linkedStudentId(req);
    if (own !== undefined && own !== req.params.studentId) {
      return res.status(404).json({ message: 'Report card not found' });
    }
    if (!mongoReady()) {
      const marks = (readDb().marks || []).filter((m) => m.studentId === req.params.studentId);
      return res.json({ ...reportCardSummary(marks), ...buildReportCard(marks) });
    }
    const marks = await Mark.find({ ...tenantQuery(req), studentId: req.params.studentId })
      .populate('examId', 'name passMarks')
      .populate('subjectId', 'name')
      .lean();
    const enriched = marks.map((m) => ({
      examId: m.examId?._id || m.examId,
      examName: m.examId?.name,
      passMarks: m.examId?.passMarks,
      subjectId: m.subjectId?._id || m.subjectId,
      subjectName: m.subjectId?.name,
      marksObtained: m.marksObtained,
      maxMarks: m.maxMarks,
    }));
    // Return both the legacy flat summary and the detailed report card.
    res.json({ ...reportCardSummary(enriched), ...buildReportCard(enriched) });
  }),
);

router.use('/library/books', crudRoutes(Book, 'library', { jsonKey: 'libraryBooks' }));

router.post(
  '/library/issue',
  requireAuth,
  permit('library', 'create'),
  asyncHandler(async (req, res) => {
    if (!mongoReady()) return res.status(503).json({ message: 'MongoDB required' });
    const { bookId, studentId, dueAt } = req.body;
    const book = await Book.findOne({ _id: bookId, ...tenantQuery(req) });
    if (!book || book.availableCopies < 1) {
      return res.status(400).json({ message: 'Book not available' });
    }
    book.availableCopies -= 1;
    await book.save();
    const issue = await BookIssue.create({
      ...tenantQuery(req),
      bookId,
      studentId,
      issuedAt: new Date().toISOString().slice(0, 10),
      dueAt,
      status: 'issued',
    });
    emitTenant(req.tenantId, 'library:issued', issue);
    res.status(201).json(issue);
  }),
);

router.post(
  '/library/return/:issueId',
  requireAuth,
  permit('library', 'update'),
  asyncHandler(async (req, res) => {
    if (!mongoReady()) return res.status(503).json({ message: 'MongoDB required' });
    const issue = await BookIssue.findOne({ _id: req.params.issueId, ...tenantQuery(req) });
    if (!issue) return res.status(404).json({ message: 'Issue not found' });
    issue.status = 'returned';
    issue.returnedAt = new Date().toISOString().slice(0, 10);
    issue.fine = Number(req.body?.fine || 0);
    await issue.save();
    const book = await Book.findById(issue.bookId);
    if (book) {
      book.availableCopies += 1;
      await book.save();
    }
    emitTenant(req.tenantId, 'library:returned', issue);
    res.json(issue);
  }),
);

router.get(
  '/messages',
  requireAuth,
  permit('messages', 'read'),
  asyncHandler(async (req, res) => {
    if (!mongoReady()) return res.json(readDb().messages || []);
    const uid = req.user._id || req.user.id;
    const rows = await Message.find({
      ...tenantQuery(req),
      $or: [{ fromUserId: uid }, { toUserId: uid }],
    })
      .sort({ createdAt: -1 })
      .lean();
    res.json(rows);
  }),
);

router.post(
  '/messages',
  requireAuth,
  permit('messages', 'create'),
  asyncHandler(async (req, res) => {
    if (!mongoReady()) return res.status(503).json({ message: 'MongoDB required' });
    const created = await Message.create({
      ...req.body,
      fromUserId: req.user._id || req.user.id,
      ...tenantQuery(req),
    });
    emitTenant(req.tenantId, 'message:new', created);
    res.status(201).json(created);
  }),
);

router.get(
  '/timetable',
  requireAuth,
  permit('classes', 'read'),
  asyncHandler(async (req, res) => {
    if (!mongoReady()) return res.json(readDb().timetable || []);
    const q = tenantQuery(req);
    if (req.query.classId) q.classId = req.query.classId;
    res.json(await Timetable.find(q).populate('subjectId teacherId', 'name').lean());
  }),
);

router.post(
  '/timetable/generate',
  requireAuth,
  permit('classes', 'create'),
  asyncHandler(async (req, res) => {
    const { classId, sectionId } = req.body || {};
    if (!mongoReady()) return res.status(503).json({ message: 'MongoDB required' });
    const tq = tenantQuery(req);
    const subjects = await Subject.find({ ...tq, classIds: classId }).lean();
    const teachers = await Teacher.find(tq).lean();
    const slots = generateTimetable({
      classId,
      sectionId,
      tenantId: req.tenantId,
      subjects: subjects.length ? subjects : await Subject.find(tq).limit(6).lean(),
      teachers,
    });
    await Timetable.deleteMany({ ...tq, classId });
    const created = await Timetable.insertMany(slots);
    emitTenant(req.tenantId, 'timetable:generated', { classId, count: created.length });
    res.status(201).json(created);
  }),
);

router.get(
  '/tenants',
  requireAuth,
  permit('tenants', 'read'),
  asyncHandler(async (req, res) => {
    if (req.user.role !== 'admin') {
      const t = await Tenant.findById(req.tenantId).lean();
      return res.json(t ? [t] : []);
    }
    if (!mongoReady()) return res.json(readDb().tenants || []);
    res.json(await Tenant.find().lean());
  }),
);

router.get(
  '/settings',
  requireAuth,
  permit('settings', 'read'),
  asyncHandler(async (req, res) => {
    if (!mongoReady()) return res.json(readDb().siteConfig || { dynamicPages: [] });
    const cfg = await SiteConfig.findOne(tenantQuery(req)).lean();
    res.json(cfg || {});
  }),
);

router.put(
  '/settings',
  requireAuth,
  permit('settings', 'update'),
  audit('update', 'settings'),
  asyncHandler(async (req, res) => {
    if (!mongoReady()) {
      const db = readDb();
      db.siteConfig = { ...db.siteConfig, ...req.body };
      writeDb(db);
      emitTenant(req.tenantId, 'settings:updated', db.siteConfig);
      return res.json(db.siteConfig);
    }
    const updated = await SiteConfig.findOneAndUpdate(tenantQuery(req), req.body, {
      upsert: true,
      new: true,
    });
    emitTenant(req.tenantId, 'settings:updated', updated);
    res.json(updated);
  }),
);

router.get(
  '/audit-logs',
  requireAuth,
  permit('audit', 'read'),
  asyncHandler(async (req, res) => {
    if (!mongoReady()) return res.json([]);
    res.json(await AuditLog.find(tenantQuery(req)).sort({ createdAt: -1 }).limit(100).lean());
  }),
);

router.get(
  '/reports/export/:type',
  requireAuth,
  permit('reports', 'read'),
  asyncHandler(async (req, res) => {
    const { type } = req.params;
    const format = req.query.format || 'json';
    let data = [];
    if (type === 'students' && mongoReady()) {
      data = await Student.find(tenantQuery(req)).lean();
    } else if (type === 'attendance' && mongoReady()) {
      data = await Attendance.find(tenantQuery(req)).lean();
    } else if (type === 'fees' && mongoReady()) {
      data = await FeePayment.find(tenantQuery(req)).lean();
    }
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${type}.csv"`);
      return res.send(toCsv(data) || 'empty');
    }
    res.json({ type, count: data.length, data });
  }),
);

export default router;
