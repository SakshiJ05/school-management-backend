import mongoose from 'mongoose';
import Teacher from '../models/teacher.model.js';
import { readDb, writeDb } from '../utils/db.js';
import { tenantQuery } from '../utils/tenantFilter.js';
import { emitTenant } from '../services/realtime.service.js';
import { getPlanLimit } from '../services/subscription.service.js';
import { notifySafely, notifySuperAdmins, notifyTenantAdmins } from '../services/notification.service.js';

function toDto(doc) {
  const o = doc.toObject ? doc.toObject() : doc;
  return {
    id: String(o._id || o.id),
    name: o.name,
    subject: o.department || o.subject || 'General',
    email: o.email,
    employeeId: o.employeeId,
    department: o.department,
  };
}

export const TeacherController = {
  getAll: async (req, res, next) => {
    try {
      if (mongoose.connection.readyState === 1) {
        try {
          const rows = await Teacher.find(tenantQuery(req)).sort({ createdAt: -1 }).lean();
          // Always return the live result (even when empty) — never leak data.json demo rows.
          return res.json(rows.map((r) => toDto(r)));
        } catch {
          /* JSON fallback only on Mongo error */
        }
      }
      const db = readDb();
      res.json((db.teachers || []).filter((t) => !req.tenantId || t.tenantId === req.tenantId).map(toDto));
    } catch (err) {
      next(err);
    }
  },

  getById: async (req, res, next) => {
    try {
      const teacher = await Teacher.findOne({ _id: req.params.id, ...tenantQuery(req) }).lean();
      if (!teacher) {
        return res.status(404).json({ message: 'Teacher not found' });
      }
      res.json(toDto(teacher));
    } catch (err) {
      next(err);
    }
  },

  create: async (req, res, next) => {
    try {
      const { name, subject, email, employeeId, department } = req.body;
      if (!name || !email) {
        return res.status(400).json({ message: 'name and email are required' });
      }
      const teacherLimit = await getPlanLimit(req.tenantId, 'teachers');
      if (teacherLimit) {
        const count = await Teacher.countDocuments(tenantQuery(req));
        if (count >= teacherLimit) {
          return res.status(402).json({
            message: `Your plan allows up to ${teacherLimit} teachers. Upgrade your plan to add more.`,
            code: 'LIMIT_REACHED',
          });
        }
      }
      const created = await Teacher.create({
        name,
        email,
        department: department || subject || 'General',
        employeeId: employeeId || `EMP${Date.now().toString().slice(-6)}`,
        ...tenantQuery(req),
      });
      emitTenant(req.tenantId, 'teachers:created', created);
      const event = {
        title: 'New teacher added',
        message: `${created.name} (${created.employeeId}) was added to the school.`,
        createdBy: req.user._id || req.user.id,
      };
      notifySafely(notifyTenantAdmins({ ...event, tenantId: req.tenantId }), 'teacher/admin');
      notifySafely(notifySuperAdmins(event), 'teacher/super-admin');
      res.status(201).json(toDto(created));
    } catch (err) {
      next(err);
    }
  },

  update: async (req, res, next) => {
    try {
      const { name, subject, email, department } = req.body;
      const dept = department ?? subject; // model stores `department`; UI sends `subject`
      const teacher = await Teacher.findOneAndUpdate(
        { _id: req.params.id, ...tenantQuery(req) },
        {
          ...(name !== undefined && { name }),
          ...(dept !== undefined && { department: dept }),
          ...(email !== undefined && { email }),
        },
        { new: true, runValidators: true },
      );
      if (!teacher) {
        return res.status(404).json({ message: 'Teacher not found' });
      }
      res.json(toDto(teacher));
    } catch (err) {
      next(err);
    }
  },

  delete: async (req, res, next) => {
    try {
      const deleted = await Teacher.findOneAndDelete({ _id: req.params.id, ...tenantQuery(req) });
      if (!deleted) {
        return res.status(404).json({ message: 'Teacher not found' });
      }
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
};
