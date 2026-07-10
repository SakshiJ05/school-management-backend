import mongoose from 'mongoose';
import Tenant from '../../models/tenant.model.js';
import Subscription from '../../models/subscription.model.js';
import Plan from '../../models/plan.model.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { logSuperAdminAction } from '../../utils/superAdminAudit.js';
import { invalidateTenantAccess } from '../../services/subscription.service.js';
import { provisionSchoolDefaults } from '../../services/provisioning.service.js';

function slugify(name) {
  return String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 48);
}

export const listSchools = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(5, Number(req.query.limit) || 10));
  const skip = (page - 1) * limit;
  const q = String(req.query.q || '').trim();
  const status = req.query.status;
  const plan = req.query.plan;

  const filter = {};
  if (q) {
    filter.$or = [
      { name: new RegExp(q, 'i') },
      { slug: new RegExp(q, 'i') },
      { email: new RegExp(q, 'i') },
    ];
  }
  if (status) filter.status = status;
  if (plan) filter.plan = plan;

  const [items, total] = await Promise.all([
    Tenant.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Tenant.countDocuments(filter),
  ]);

  const schoolIds = items.map((s) => s._id);
  const subs = await Subscription.find({ tenantId: { $in: schoolIds }, status: 'active' })
    .populate('planId', 'name price')
    .lean();
  const subMap = new Map(subs.map((s) => [String(s.tenantId), s]));

  res.json({
    items: items.map((s) => ({
      id: s._id,
      name: s.name,
      slug: s.slug,
      address: s.address,
      email: s.email,
      phone: s.phone,
      logoUrl: s.logoUrl,
      plan: s.plan,
      status: s.status,
      subscription: subMap.get(String(s._id)) || null,
      createdAt: s.createdAt,
    })),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

export const getSchool = asyncHandler(async (req, res) => {
  const school = await Tenant.findById(req.params.id).lean();
  if (!school) return res.status(404).json({ message: 'School not found' });
  const User = mongoose.model('User');
  let studentCount = 0;
  let teacherCount = 0;
  try {
    const Student = mongoose.model('Student');
    const Teacher = mongoose.model('Teacher');
    [studentCount, teacherCount] = await Promise.all([
      Student.countDocuments({ tenantId: school._id }),
      Teacher.countDocuments({ tenantId: school._id }),
    ]);
  } catch {
    // Student/Teacher models optional
  }
  const [subscription, userCount] = await Promise.all([
    Subscription.findOne({ tenantId: school._id, status: 'active' }).populate('planId').lean(),
    User.countDocuments({ tenantId: school._id }),
  ]);
  res.json({ ...school, id: school._id, subscription, userCount, studentCount, teacherCount });
});

export const createSchool = asyncHandler(async (req, res) => {
  const { name, address, email, phone, logoUrl, plan, adminName, adminEmail, adminPassword, seedDefaults } =
    req.body || {};
  if (!name) return res.status(400).json({ message: 'School name is required' });

  let slug = slugify(req.body.slug || name);
  const exists = await Tenant.findOne({ slug });
  if (exists) slug = `${slug}-${Date.now().toString(36)}`;

  const school = await Tenant.create({
    name: String(name).trim(),
    slug,
    address: address || '',
    email: email || '',
    phone: phone || '',
    logoUrl: logoUrl || '',
    plan: plan || 'standard',
    status: 'active',
  });

  // Onboard: create a first admin login + starter data so the school is usable immediately.
  const provisioning = await provisionSchoolDefaults(school, {
    adminName,
    adminEmail: adminEmail || email,
    adminPassword,
    seedDefaults: seedDefaults !== false,
  });

  await logSuperAdminAction(req, { action: 'CREATE', module: 'schools', resourceId: school._id, meta: { name } });
  res.status(201).json({ id: school._id, ...school.toObject(), provisioning });
});

export const updateSchool = asyncHandler(async (req, res) => {
  const allowed = ['name', 'address', 'email', 'phone', 'logoUrl', 'plan', 'subdomain'];
  const patch = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) patch[key] = req.body[key];
  }
  const school = await Tenant.findByIdAndUpdate(req.params.id, patch, { new: true });
  if (!school) return res.status(404).json({ message: 'School not found' });
  await logSuperAdminAction(req, { action: 'UPDATE', module: 'schools', resourceId: school._id });
  res.json({ id: school._id, ...school.toObject() });
});

export const deleteSchool = asyncHandler(async (req, res) => {
  const school = await Tenant.findByIdAndDelete(req.params.id);
  if (!school) return res.status(404).json({ message: 'School not found' });
  await logSuperAdminAction(req, { action: 'DELETE', module: 'schools', resourceId: req.params.id });
  res.json({ message: 'School deleted' });
});

export const toggleSchoolStatus = asyncHandler(async (req, res) => {
  const school = await Tenant.findById(req.params.id);
  if (!school) return res.status(404).json({ message: 'School not found' });
  school.status = school.status === 'active' ? 'suspended' : 'active';
  await school.save();
  invalidateTenantAccess(school._id);
  await logSuperAdminAction(req, {
    action: school.status === 'active' ? 'ACTIVATE' : 'DEACTIVATE',
    module: 'schools',
    resourceId: school._id,
  });
  res.json({ id: school._id, status: school.status });
});
