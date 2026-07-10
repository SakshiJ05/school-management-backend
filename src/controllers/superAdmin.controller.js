import crypto from 'crypto';
import { Op } from 'sequelize';
import {
  School,
  User,
  Student,
  Teacher,
  Class,
  AuditLog,
  FeePayment,
  Attendance,
} from '../models/index.js';
import { hashPassword } from '../utils/password.js';
import { ok, fail } from '../utils/apiResponse.js';
import { serializeSchool, serializeRow } from '../utils/serializer.js';
import { slugifySubdomain } from '../utils/subdomain.js';
import { requestEmailOtp, verifyEmailOtp } from '../services/otp.service.js';

function generateTempPassword() {
  return `Scholify@${crypto.randomBytes(3).toString('hex')}`;
}


export async function requestSchoolAdminOtp(req, res) {
  try {
    const adminEmail = String(req.body?.adminEmail || req.body?.email || '').trim().toLowerCase();
    if (!adminEmail) return fail(res, 'adminEmail required', 400);

    const otp = await requestEmailOtp(adminEmail, 'school_admin_create', 'school admin verification');
    return ok(res, { sent: true, devOtp: otp.devOtp }, otp.message);
  } catch (err) {
    return fail(res, err.message || 'Could not send OTP', 500);
  }
}
async function audit(userId, schoolId, action, module, req, details = {}) {
  await AuditLog.create({
    user_id: userId,
    school_id: schoolId,
    action,
    module,
    details,
    ip_address: req.ip || req.headers['x-forwarded-for'] || '',
  });
}

/** GET /api/super-admin/schools */
export async function listSchools(req, res) {
  try {
    const schools = await School.findAll({
      order: [['id', 'ASC']],
      include: [{ model: User, as: 'users', where: { role: 'school_admin' }, required: false }],
    });

    const data = await Promise.all(
      schools.map(async (school) => {
        const studentCount = await Student.count({ where: { school_id: school.id } });
        const teacherCount = await Teacher.count({ where: { school_id: school.id } });
        const admin = (school.users || [])[0];
        return {
          ...serializeSchool(school),
          studentCount,
          teacherCount,
          adminEmail: admin?.email || school.email,
        };
      }),
    );

    return ok(res, data);
  } catch (err) {
    return fail(res, err.message, 500);
  }
}

/** GET /api/super-admin/schools/:id */
export async function getSchool(req, res) {
  try {
    const school = await School.findByPk(req.params.id);
    if (!school) return fail(res, 'School not found', 404);
    const studentCount = await Student.count({ where: { school_id: school.id } });
    const teacherCount = await Teacher.count({ where: { school_id: school.id } });
    return ok(res, { ...serializeSchool(school), studentCount, teacherCount });
  } catch (err) {
    return fail(res, err.message, 500);
  }
}

/**
 * POST /api/super-admin/schools — provision new tenant + admin invite
 * Body: { name, code, subdomain?, city?, plan?, adminName, adminEmail, adminPassword? }
 */
export async function provisionSchool(req, res) {
  try {
    const name = String(req.body?.name || '').trim();
    const code = String(req.body?.code || '').trim().toUpperCase();
    const subdomain =
      slugifySubdomain(req.body?.subdomain || name) || slugifySubdomain(code);
    const city = String(req.body?.city || '').trim();
    const plan = req.body?.plan || 'trial';
    const adminName = String(req.body?.adminName || req.body?.admin_name || `${name} Admin`).trim();
    const adminEmail = String(req.body?.adminEmail || req.body?.admin_email || '').trim().toLowerCase();
    const adminPassword = String(req.body?.adminPassword || req.body?.admin_password || generateTempPassword());
    const otp = String(req.body?.otp || req.body?.adminOtp || req.body?.admin_otp || '').trim();

    if (!name || !code || !adminEmail) {
      return fail(res, 'name, code, and adminEmail are required', 400);
    }
    if (!verifyEmailOtp(adminEmail, otp, 'school_admin_create')) {
      return fail(res, 'Invalid or expired admin email OTP', 400);
    }

    const exists = await School.findOne({
      where: {
        [Op.or]: [{ code }, { subdomain }],
      },
    });
    if (exists) {
      return fail(res, 'School code or subdomain already exists', 409);
    }

    const emailTaken = await User.findOne({ where: { email: adminEmail } });
    if (emailTaken) {
      return fail(res, 'Admin email already registered', 409);
    }

    const school = await School.create({
      name,
      code,
      subdomain,
      city,
      state: req.body?.state || 'India',
      address: req.body?.address || city,
      email: adminEmail,
      phone: req.body?.phone || '',
      plan,
      plan_expiry: req.body?.planExpiry || null,
      status: 'active',
    });

    const passwordHash = await hashPassword(adminPassword);
    const admin = await User.create({
      school_id: school.id,
      name: adminName,
      email: adminEmail,
      password: passwordHash,
      role: 'school_admin',
      status: 'active',
    });

    await Class.create({ school_id: school.id, name: 'Class 1' });

    await audit(req.user.id, school.id, 'PROVISION', 'schools', req, {
      schoolName: name,
      code,
      subdomain,
      adminEmail,
    });

    return ok(
      res,
      {
        school: serializeSchool(school),
        admin: serializeRow(admin),
        invite: {
          email: adminEmail,
          temporaryPassword: adminPassword,
          loginUrl: `https://${subdomain}.${process.env.SAAS_BASE_DOMAIN || 'scholify.local'}`,
          schoolCode: code,
        },
      },
      'School provisioned — share invite credentials with admin',
      201,
    );
  } catch (err) {
    return fail(res, err.message, 400);
  }
}

/** PATCH /api/super-admin/schools/:id */
export async function updateSchool(req, res) {
  try {
    const school = await School.findByPk(req.params.id);
    if (!school) return fail(res, 'School not found', 404);

    const patch = {};
    const fields = ['name', 'city', 'state', 'address', 'email', 'phone', 'plan', 'status'];
    for (const f of fields) {
      if (req.body[f] !== undefined) patch[f] = req.body[f];
    }
    if (req.body.planExpiry !== undefined) patch.plan_expiry = req.body.planExpiry;
    if (req.body.subdomain) patch.subdomain = slugifySubdomain(req.body.subdomain);

    await school.update(patch);
    await audit(req.user.id, school.id, 'UPDATE', 'schools', req, patch);

    return ok(res, serializeSchool(school));
  } catch (err) {
    return fail(res, err.message, 400);
  }
}

/** POST /api/super-admin/schools/:id/invite-admin — reset or create school admin */
export async function inviteSchoolAdmin(req, res) {
  try {
    const school = await School.findByPk(req.params.id);
    if (!school) return fail(res, 'School not found', 404);

    const adminEmail = String(req.body?.adminEmail || req.body?.email || school.email)
      .trim()
      .toLowerCase();
    const adminName = String(req.body?.adminName || `${school.name} Admin`).trim();
    const tempPassword = String(req.body?.adminPassword || generateTempPassword());
    const otp = String(req.body?.otp || req.body?.adminOtp || req.body?.admin_otp || '').trim();

    if (!adminEmail) return fail(res, 'adminEmail required', 400);
    if (!verifyEmailOtp(adminEmail, otp, 'school_admin_create')) {
      return fail(res, 'Invalid or expired admin email OTP', 400);
    }

    let admin = await User.findOne({
      where: { email: adminEmail, school_id: school.id, role: 'school_admin' },
    });

    const passwordHash = await hashPassword(tempPassword);

    if (admin) {
      await admin.update({ password: passwordHash, name: adminName, status: 'active' });
    } else {
      const global = await User.findOne({ where: { email: adminEmail } });
      if (global) return fail(res, 'Email already used by another account', 409);

      admin = await User.create({
        school_id: school.id,
        name: adminName,
        email: adminEmail,
        password: passwordHash,
        role: 'school_admin',
        status: 'active',
      });
    }

    await audit(req.user.id, school.id, 'INVITE_ADMIN', 'schools', req, { adminEmail });

    return ok(res, {
      admin: serializeRow(admin),
      invite: {
        email: adminEmail,
        temporaryPassword: tempPassword,
        schoolCode: school.code,
        subdomain: school.subdomain,
      },
    }, 'Admin invite sent');
  } catch (err) {
    return fail(res, err.message, 400);
  }
}

/** GET /api/super-admin/analytics */
export async function globalAnalytics(req, res) {
  try {
    const schools = await School.findAll({ order: [['id', 'ASC']] });
    const activeSchools = schools.filter((s) => s.status === 'active');
    const studentCount = await Student.count();
    const teacherCount = await Teacher.count();

    const planBreakdown = schools.reduce((acc, s) => {
      acc[s.plan || 'trial'] = (acc[s.plan || 'trial'] || 0) + 1;
      return acc;
    }, {});

    const cityBreakdown = schools.reduce((acc, s) => {
      const city = s.city || 'Unknown';
      acc[city] = (acc[city] || 0) + 1;
      return acc;
    }, {});

    const bySchool = await Promise.all(
      schools.map(async (s) => {
        const [students, teachers, payments, attendance] = await Promise.all([
          Student.count({ where: { school_id: s.id } }),
          Teacher.count({ where: { school_id: s.id } }),
          FeePayment.findAll({ where: { school_id: s.id } }),
          Attendance.findAll({ where: { school_id: s.id }, limit: 200, order: [['date', 'DESC']] }),
        ]);
        const paid = payments.reduce((sum, p) => sum + Number(p.amount_paid || 0), 0);
        const present = attendance.filter((a) => a.status === 'present').length;
        const attendancePct = attendance.length ? Math.round((present / attendance.length) * 100) : 0;
        return {
          id: s.id,
          name: s.name,
          code: s.code,
          city: s.city || 'Unknown',
          plan: s.plan || 'trial',
          status: s.status || 'active',
          students,
          teachers,
          attendancePct,
          feesMonth: paid,
        };
      }),
    );

    return ok(res, {
      counts: {
        schools: schools.length,
        activeSchools: activeSchools.length,
        students: studentCount,
        teachers: teacherCount,
      },
      planBreakdown,
      cityBreakdown,
      schools: bySchool,
    });
  } catch (err) {
    return fail(res, err.message, 500);
  }
}





