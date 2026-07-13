import mongoose from 'mongoose';
import Student from '../models/student.model.js';
import User from '../models/user.model.js';
import bcrypt from 'bcryptjs';
import { readDb, writeDb } from '../utils/db.js';
import { tenantQuery } from '../utils/tenantFilter.js';
import { emitTenant } from '../services/realtime.service.js';
import { getPlanLimit } from '../services/subscription.service.js';
import { notifySafely, notifySuperAdmins, notifyTenantAdmins } from '../services/notification.service.js';

function fromBody(body) {
  const {
    name,
    email,
    phone,
    admissionNo,
    class: studentClass,
    section,
    rollNo,
    gender,
    status,
    dateOfBirth,
    address,
    parentName,
    parentPhone,
    parentEmail,
    parentRelation,
  } = body;
  return {
    name,
    email,
    phone: phone ?? '',
    admissionNo,
    studentClass,
    section,
    rollNo,
    gender,
    status: status ?? 'Active',
    dateOfBirth: dateOfBirth ?? '',
    address: address ?? '',
    parentName: parentName ?? '',
    parentPhone: parentPhone ?? '',
    parentEmail: parentEmail ?? '',
    parentRelation: parentRelation ?? 'Guardian',
  };
}

function toDto(doc) {
  const o = doc.toObject ? doc.toObject() : doc;
  return {
    id: String(o._id),
    name: o.name,
    email: o.email,
    phone: o.phone,
    admissionNo: o.admissionNo,
    class: o.studentClass,
    section: o.section,
    rollNo: o.rollNo,
    gender: o.gender,
    status: o.status,
    dateOfBirth: o.dateOfBirth,
    address: o.address,
    parentName: o.parentName ?? '',
    parentPhone: o.parentPhone ?? '',
    parentEmail: o.parentEmail ?? '',
    parentRelation: o.parentRelation ?? 'Guardian',
  };
}

function jsonMaps(db) {
  return {
    users: new Map((db.users || []).map((u) => [u.id, u])),
    classes: new Map((db.classes || []).map((c) => [c.id, c])),
    sections: new Map((db.sections || []).map((s) => [s.id, s])),
  };
}

function jsonToDto(row, maps) {
  const user = maps.users.get(row.userId);
  const cls = maps.classes.get(row.classId);
  const section = maps.sections.get(row.sectionId);
  return {
    id: row.id,
    name: row.name || user?.name || '',
    email: row.email || user?.email || '',
    phone: row.phone || '',
    admissionNo: row.admissionNo || row.id,
    class: row.class || row.studentClass || cls?.name?.replace(/^Class\s+/i, '') || '',
    section: row.section || section?.name || '',
    rollNo: row.rollNo || '',
    gender: row.gender || 'Not set',
    status: row.status || 'Active',
    dateOfBirth: row.dateOfBirth || '',
    address: row.address || '',
    parentName: row.parentName || '',
    parentPhone: row.parentPhone || row.phone || '',
    parentEmail: row.parentEmail || '',
    parentRelation: row.parentRelation || 'Guardian',
  };
}

function makeId(prefix) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function positiveInt(value, fallback, max = Number.MAX_SAFE_INTEGER) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, max) : fallback;
}

function matchesQuery(row, query) {
  const search = String(query.search || '').trim().toLowerCase();
  const studentClass = String(query.class || '').trim().toLowerCase();
  const section = String(query.section || '').trim().toLowerCase();
  const status = String(query.status || '').trim().toLowerCase();
  const value = (input) => String(input ?? '').trim().toLowerCase();

  return (
    (!search || [row.name, row.email, row.admissionNo, row.rollNo, row.parentName, row.parentPhone, row.phone]
      .some((field) => value(field).includes(search))) &&
    (!studentClass || value(row.class || row.studentClass) === studentClass) &&
    (!section || value(row.section) === section) &&
    (!status || value(row.status) === status)
  );
}

/** Generate a unique admission number for the tenant when one isn't supplied. */
async function generateAdmissionNo(req) {
  const year = new Date().getFullYear();
  const prefix = `ADM${year}`;
  if (mongoose.connection.readyState === 1) {
    let seq = (await Student.countDocuments(tenantQuery(req))) + 1;
    // Bump past any collisions (e.g. deleted/re-created records).
    for (let i = 0; i < 50; i++) {
      const candidate = `${prefix}${String(seq).padStart(4, '0')}`;
      const clash = await Student.exists({ ...tenantQuery(req), admissionNo: candidate });
      if (!clash) return candidate;
      seq += 1;
    }
    return `${prefix}${Date.now().toString().slice(-6)}`;
  }
  const rows = (readDb().students || []).filter((s) => s.tenantId === req.tenantId);
  let seq = rows.length + 1;
  const taken = new Set(rows.map((s) => s.admissionNo));
  while (taken.has(`${prefix}${String(seq).padStart(4, '0')}`)) seq += 1;
  return `${prefix}${String(seq).padStart(4, '0')}`;
}

/**
 * For student/parent roles, returns the only student id they may access
 * (their linked student), or null if none is linked. Returns undefined for
 * staff roles (no restriction).
 */
function ownStudentId(req) {
  const role = req.user?.role;
  if (role === 'student' || role === 'parent') {
    return req.user?.linkedStudentId ? String(req.user.linkedStudentId) : null;
  }
  return undefined;
}

/** Guard sub-resource reads: student in the URL must belong to the caller's tenant AND (for student/parent) be their own. */
async function studentBelongsToTenant(req) {
  const own = ownStudentId(req);
  if (own !== undefined && own !== req.params.id) return false;
  if (mongoose.connection.readyState === 1) {
    const exists = await Student.exists({ _id: req.params.id, ...tenantQuery(req) });
    return Boolean(exists);
  }
  const db = readDb();
  return (db.students || []).some(
    (s) => s.id === req.params.id && (!req.tenantId || s.tenantId === req.tenantId),
  );
}

export const StudentController = {
  getAll: async (req, res, next) => {
    try {
      const own = ownStudentId(req);
      const paginated = req.query.page != null || req.query.limit != null;
      const page = positiveInt(req.query.page, 1);
      const pageSize = positiveInt(req.query.limit, 10, 50);
      if (own === null) {
        return res.json(paginated
          ? { items: [], page, pageSize, total: 0, totalPages: 1, facets: { classes: [], sections: [], statuses: [] } }
          : []);
      }
      if (mongoose.connection.readyState === 1) {
        try {
          const filter = tenantQuery(req);
          if (own) filter._id = own;
          if (req.query.search) {
            const search = new RegExp(escapeRegex(String(req.query.search).trim()), 'i');
            filter.$or = [
              { name: search },
              { email: search },
              { admissionNo: search },
              { rollNo: search },
              { parentName: search },
              { parentPhone: search },
              { phone: search },
            ];
          }
          if (req.query.class) filter.studentClass = new RegExp(`^${escapeRegex(req.query.class)}$`, 'i');
          if (req.query.section) filter.section = new RegExp(`^${escapeRegex(req.query.section)}$`, 'i');
          if (req.query.status) filter.status = new RegExp(`^${escapeRegex(req.query.status)}$`, 'i');

          if (paginated) {
            const facetFilter = { ...tenantQuery(req), ...(own ? { _id: own } : {}) };
            const [rows, total, classes, sections, statuses] = await Promise.all([
              Student.find(filter).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
              Student.countDocuments(filter),
              Student.distinct('studentClass', facetFilter),
              Student.distinct('section', facetFilter),
              Student.distinct('status', facetFilter),
            ]);
            return res.json({
              items: rows.map((r) => toDto(r)),
              page,
              pageSize,
              total,
              totalPages: Math.max(1, Math.ceil(total / pageSize)),
              facets: {
                classes: classes.filter(Boolean),
                sections: sections.filter(Boolean),
                statuses: statuses.filter(Boolean),
              },
            });
          }

          const rows = await Student.find(filter).sort({ createdAt: -1 }).lean();
          // Always return the live result (even when empty) — never leak data.json demo rows.
          return res.json(rows.map((r) => toDto(r)));
        } catch {
          /* fall through to JSON only when Mongo actually errors */
        }
      }
      const db = readDb();
      const maps = jsonMaps(db);
      let rows = db.students || [];
      if (req.tenantId) rows = rows.filter((s) => s.tenantId === req.tenantId);
      if (own) rows = rows.filter((s) => s.id === own);
      const allRows = rows.map((r) => jsonToDto(r, maps)).reverse();
      if (paginated) {
        const filtered = allRows.filter((row) => matchesQuery(row, req.query));
        const start = (page - 1) * pageSize;
        const unique = (values) => [...new Set(values.filter(Boolean))];
        return res.json({
          items: filtered.slice(start, start + pageSize),
          page,
          pageSize,
          total: filtered.length,
          totalPages: Math.max(1, Math.ceil(filtered.length / pageSize)),
          facets: {
            classes: unique(allRows.map((row) => row.class)),
            sections: unique(allRows.map((row) => row.section)),
            statuses: unique(allRows.map((row) => row.status)),
          },
        });
      }
      res.json(allRows);
    } catch (err) {
      next(err);
    }
  },

  getById: async (req, res, next) => {
    try {
      const own = ownStudentId(req);
      if (own !== undefined && own !== req.params.id) {
        return res.status(404).json({ message: 'Student not found' });
      }
      if (mongoose.connection.readyState === 1) {
        const row = await Student.findOne({ _id: req.params.id, ...tenantQuery(req) }).lean();
        if (row) {
          return res.json(toDto(row));
        }
      }
      const db = readDb();
      const row = (db.students || []).find(
        (s) => s.id === req.params.id && (!req.tenantId || s.tenantId === req.tenantId),
      );
      if (!row) {
        return res.status(404).json({ message: 'Student not found' });
      }
      res.json(jsonToDto(row, jsonMaps(db)));
    } catch (err) {
      next(err);
    }
  },

  create: async (req, res, next) => {
    try {
      const payload = fromBody(req.body);
      const password = String(req.body?.password || '');
      const required = ['name', 'email', 'studentClass', 'section', 'rollNo', 'gender'];
      const missing = required.filter((k) => !payload[k] && payload[k] !== 0);
      if (missing.length) {
        return res.status(400).json({ message: `Missing required fields: ${missing.join(', ')}` });
      }
      if (password.length < 6) {
        return res.status(400).json({ message: 'Student password must be at least 6 characters' });
      }
      // Auto-generate admission number when the caller doesn't supply one.
      if (!payload.admissionNo) {
        payload.admissionNo = await generateAdmissionNo(req);
      }
      const studentLimit = await getPlanLimit(req.tenantId, 'students');
      if (studentLimit) {
        const count =
          mongoose.connection.readyState === 1
            ? await Student.countDocuments(tenantQuery(req))
            : (readDb().students || []).filter((s) => s.tenantId === req.tenantId).length;
        if (count >= studentLimit) {
          return res.status(402).json({
            message: `Your plan allows up to ${studentLimit} students. Upgrade your plan to add more.`,
            code: 'LIMIT_REACHED',
          });
        }
      }
      if (mongoose.connection.readyState !== 1) {
        const db = readDb();
        if ((db.students || []).some((s) => s.admissionNo === payload.admissionNo)) {
          return res.status(400).json({ message: 'A student with this admission number already exists' });
        }
        const row = {
          id: makeId('st'),
          tenantId: req.tenantId || 'tenant_demo',
          ...req.body,
          ...payload,
          class: payload.studentClass,
          status: payload.status,
        };
        db.students = db.students || [];
        db.students.push(row);
        writeDb(db);
        const dto = jsonToDto(row, jsonMaps(db));
        emitTenant(req.tenantId, 'students:created', dto);
        return res.status(201).json(dto);
      }
      const loginId = String(payload.admissionNo).trim().toLowerCase();
      const loginEmail = String(payload.email || `${loginId}@student.local`).trim().toLowerCase();
      const duplicateAccount = await User.exists({
        tenantId: req.tenantId,
        $or: [{ email: loginEmail }, { username: loginId }],
      });
      if (duplicateAccount) {
        return res.status(409).json({ message: 'A login account already exists for this email or admission number' });
      }
      const created = await Student.create({ ...payload, ...tenantQuery(req) });
      try {
        const loginUser = await User.create({
          tenantId: req.tenantId,
          email: loginEmail,
          username: loginId,
          passwordHash: bcrypt.hashSync(password, 10),
          name: created.name,
          role: 'student',
          status: 'active',
          linkedStudentId: created._id,
        });
        created.userId = loginUser._id;
        await created.save();
      } catch (accountError) {
        await Student.deleteOne({ _id: created._id });
        throw accountError;
      }
      emitTenant(req.tenantId, 'students:created', created);
      const event = {
        title: 'New student added',
        message: `${created.name} (${created.admissionNo}) was added to the school.`,
        createdBy: req.user._id || req.user.id,
      };
      notifySafely(notifyTenantAdmins({ ...event, tenantId: req.tenantId }), 'student/admin');
      notifySafely(notifySuperAdmins(event), 'student/super-admin');
      res.status(201).json({ ...toDto(created), credentials: { loginId, password } });
    } catch (err) {
      next(err);
    }
  },

  update: async (req, res, next) => {
    try {
      const payload = fromBody(req.body);
      const update = {};
      for (const [key, val] of Object.entries(payload)) {
        if (val !== undefined && val !== null) {
          update[key] = val;
        }
      }
      if (mongoose.connection.readyState !== 1) {
        const db = readDb();
        const idx = (db.students || []).findIndex((s) => s.id === req.params.id);
        if (idx === -1) {
          return res.status(404).json({ message: 'Student not found' });
        }
        db.students[idx] = {
          ...db.students[idx],
          ...req.body,
          class: payload.studentClass,
          status: payload.status,
        };
        writeDb(db);
        const dto = jsonToDto(db.students[idx], jsonMaps(db));
        emitTenant(req.tenantId, 'students:updated', dto);
        return res.json(dto);
      }
      const updated = await Student.findOneAndUpdate(
        { _id: req.params.id, ...tenantQuery(req) },
        update,
        { new: true, runValidators: true },
      );
      if (!updated) {
        return res.status(404).json({ message: 'Student not found' });
      }
      const dto = toDto(updated);
      emitTenant(req.tenantId, 'students:updated', dto);
      res.json(dto);
    } catch (err) {
      next(err);
    }
  },

  delete: async (req, res, next) => {
    try {
      if (mongoose.connection.readyState !== 1) {
        const db = readDb();
        const before = (db.students || []).length;
        db.students = (db.students || []).filter((s) => s.id !== req.params.id);
        if (db.students.length === before) {
          return res.status(404).json({ message: 'Student not found' });
        }
        writeDb(db);
        emitTenant(req.tenantId, 'students:deleted', { id: req.params.id });
        return res.status(204).send();
      }
      const deleted = await Student.findOneAndDelete({ _id: req.params.id, ...tenantQuery(req) });
      if (!deleted) {
        return res.status(404).json({ message: 'Student not found' });
      }
      emitTenant(req.tenantId, 'students:deleted', { id: req.params.id });
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },

  /**
   * Bulk-promote students to a new class/section.
   * Body: { fromClass, toClass, toSection?, studentIds?, graduate? }
   * If studentIds given, only those; else all students in fromClass.
   * graduate:true marks them status 'alumni' instead of moving class.
   */
  promote: async (req, res, next) => {
    try {
      const { fromClass, toClass, toSection, studentIds, graduate } = req.body || {};
      if (!graduate && !toClass) {
        return res.status(400).json({ message: 'toClass is required (or set graduate:true)' });
      }
      if (mongoose.connection.readyState !== 1) {
        return res.status(503).json({ message: 'MongoDB required for promotion' });
      }
      const filter = { ...tenantQuery(req) };
      if (Array.isArray(studentIds) && studentIds.length) {
        filter._id = { $in: studentIds };
      } else if (fromClass) {
        filter.studentClass = String(fromClass);
      } else {
        return res.status(400).json({ message: 'Provide studentIds or fromClass' });
      }

      const update = graduate
        ? { status: 'alumni' }
        : { studentClass: String(toClass), ...(toSection != null && { section: String(toSection) }) };

      const result = await Student.updateMany(filter, update);
      emitTenant(req.tenantId, 'students:promoted', { count: result.modifiedCount });
      res.json({ promoted: result.modifiedCount, graduate: Boolean(graduate) });
    } catch (err) {
      next(err);
    }
  },

  getAttendance: async (req, res, next) => {
    try {
      if (!(await studentBelongsToTenant(req))) {
        return res.status(404).json({ message: 'Student not found' });
      }
      const db = readDb();
      res.json(
        (db.attendance || []).filter(
          (row) => row.studentId === req.params.id && (!req.tenantId || !row.tenantId || row.tenantId === req.tenantId),
        ),
      );
    } catch (err) {
      next(err);
    }
  },

  getFees: async (req, res, next) => {
    try {
      if (!(await studentBelongsToTenant(req))) {
        return res.status(404).json({ message: 'Student not found' });
      }
      const db = readDb();
      res.json(
        (db.fees || []).filter(
          (row) => row.studentId === req.params.id && (!req.tenantId || !row.tenantId || row.tenantId === req.tenantId),
        ),
      );
    } catch (err) {
      next(err);
    }
  },
};
