import { Op } from 'sequelize';
import {
  FeeConcession,
  FeePayment,
  FeeStructure,
  Student,
  StudentFeeAssignment,
} from '../models/index.js';
import { ok, fail } from '../utils/apiResponse.js';
import { serializeRows } from '../utils/serializer.js';

const money = (value) => Number(value || 0);
const schoolId = (req) => req.tenant?.schoolId;

function rangeForPeriod(query) {
  const today = new Date();
  const month = query.month || today.toISOString().slice(0, 7);
  const from = query.from || `${month}-01`;
  const end = new Date(`${from}T00:00:00.000Z`);
  end.setMonth(end.getMonth() + 1);
  end.setDate(0);
  const to = query.to || end.toISOString().slice(0, 10);
  return { from, to, month };
}

export async function studentLedger(req, res) {
  try {
    const where = { school_id: schoolId(req), student_id: req.params.studentId };
    const [assignments, concessions, payments] = await Promise.all([
      StudentFeeAssignment.findAll({ where, order: [['assigned_on', 'DESC']] }),
      FeeConcession.findAll({ where: { school_id: schoolId(req), student_id: req.params.studentId } }),
      FeePayment.findAll({ where, order: [['payment_date', 'DESC']] }),
    ]);

    return ok(res, {
      assignments: serializeRows(assignments),
      concessions: serializeRows(concessions),
      payments: serializeRows(payments),
      totalAssigned: assignments.length,
      totalPaid: payments.reduce((sum, row) => sum + money(row.amount_paid), 0),
    });
  } catch (err) {
    return fail(res, err.message, 500);
  }
}

export async function dueReport(req, res) {
  try {
    const [students, structures, assignments, payments, concessions] = await Promise.all([
      Student.findAll({ where: { school_id: schoolId(req), status: { [Op.ne]: 'inactive' } } }),
      FeeStructure.findAll({ where: { school_id: schoolId(req) } }),
      StudentFeeAssignment.findAll({ where: { school_id: schoolId(req), status: 'active' } }),
      FeePayment.findAll({ where: { school_id: schoolId(req) } }),
      FeeConcession.findAll({ where: { school_id: schoolId(req), status: 'active' } }),
    ]);

    const byStructure = new Map(structures.map((row) => [String(row.id), row]));
    const paidByStudent = new Map();
    payments.forEach((row) => {
      const key = String(row.student_id);
      paidByStudent.set(key, (paidByStudent.get(key) || 0) + money(row.amount_paid));
    });

    const concessionByStudent = new Map();
    concessions.forEach((row) => concessionByStudent.set(String(row.student_id), money(row.percent)));

    const assignedByStudent = new Map();
    assignments.forEach((row) => {
      const structure = byStructure.get(String(row.fee_structure_id));
      const gross = money(structure?.amount);
      const concession = Math.round((gross * (concessionByStudent.get(String(row.student_id)) || 0)) / 100);
      const assignmentDiscount =
        row.discount_type === 'percent'
          ? Math.round((gross * money(row.discount_value)) / 100)
          : row.discount_type === 'flat'
            ? money(row.discount_value)
            : 0;
      const key = String(row.student_id);
      assignedByStudent.set(key, (assignedByStudent.get(key) || 0) + Math.max(0, gross - concession - assignmentDiscount));
    });

    const rows = students
      .map((student) => {
        const due = assignedByStudent.get(String(student.id)) || 0;
        const paid = paidByStudent.get(String(student.id)) || 0;
        return {
          studentId: student.id,
          studentName: [student.first_name, student.last_name].filter(Boolean).join(' ') || student.name,
          classId: student.class_id,
          payable: due,
          paid,
          balance: Math.max(0, due - paid),
        };
      })
      .filter((row) => row.balance > 0);

    return ok(res, rows);
  } catch (err) {
    return fail(res, err.message, 500);
  }
}

export async function collectionReport(req, res) {
  try {
    const { from, to, month } = rangeForPeriod(req.query);
    const payments = await FeePayment.findAll({
      where: {
        school_id: schoolId(req),
        payment_date: { [Op.between]: [from, to] },
      },
      order: [['payment_date', 'DESC']],
    });

    return ok(res, {
      from,
      to,
      month,
      total: payments.reduce((sum, row) => sum + money(row.amount_paid), 0),
      count: payments.length,
      payments: serializeRows(payments),
    });
  } catch (err) {
    return fail(res, err.message, 500);
  }
}
