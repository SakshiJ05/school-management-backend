import Tenant from '../models/tenant.model.js';
import ClassModel from '../models/class.model.js';
import Section from '../models/section.model.js';
import Subject from '../models/subject.model.js';
import Exam from '../models/exam.model.js';
import FeeStructure from '../models/feeStructure.model.js';
import Book from '../models/book.model.js';
import Notice from '../models/notice.model.js';
import SiteConfig from '../models/siteConfig.model.js';

export async function runSeedIfEmpty() {
  const count = await Tenant.countDocuments();
  if (count > 0) {
    console.log('Database already seeded - skipping.');
    return;
  }

  console.log('Seeding MongoDB sample data...');

  const tenantA = await Tenant.create({
    name: 'Scholify Demo School',
    slug: 'demo-school',
    subdomain: 'demo',
    email: 'office@demo-school.edu',
    theme: { primaryColor: '#2563eb', secondaryColor: '#7c3aed', accentColor: '#059669' },
  });

  const tenantB = await Tenant.create({
    name: 'Green Valley Academy',
    slug: 'green-valley',
    subdomain: 'greenvalley',
    email: 'admin@greenvalley.edu',
    theme: { primaryColor: '#0d9488', secondaryColor: '#ca8a04', accentColor: '#dc2626' },
  });

  const cls = await ClassModel.create({
    tenantId: tenantA._id,
    name: 'Class 10',
    level: 10,
    academicYear: '2025-26',
  });

  await Section.create({ tenantId: tenantA._id, classId: cls._id, name: 'A', capacity: 40 });

  const subjects = await Subject.insertMany([
    { tenantId: tenantA._id, name: 'Mathematics', code: 'MATH10', classIds: [cls._id] },
    { tenantId: tenantA._id, name: 'Science', code: 'SCI10', classIds: [cls._id] },
    { tenantId: tenantA._id, name: 'English', code: 'ENG10', classIds: [cls._id] },
  ]);

  await Exam.create({
    tenantId: tenantA._id,
    name: 'Mid Term',
    type: 'written',
    classId: cls._id,
    subjectId: subjects[0]._id,
  });

  await FeeStructure.create({
    tenantId: tenantA._id,
    name: 'Annual Tuition',
    classId: cls._id,
    amount: 45000,
    frequency: 'annual',
    heads: [
      { name: 'Tuition', amount: 30000 },
      { name: 'Transport', amount: 15000 },
    ],
  });

  await Book.insertMany([
    { tenantId: tenantA._id, title: 'Physics Fundamentals', author: 'Halliday', isbn: '978-001', totalCopies: 5, availableCopies: 4 },
    { tenantId: tenantA._id, title: 'World History', author: 'Smith', isbn: '978-002', totalCopies: 3, availableCopies: 3 },
  ]);

  await Notice.create({
    tenantId: tenantA._id,
    title: 'Annual Day Rehearsal',
    body: 'All participants report to the auditorium at 8 AM.',
    priority: 'high',
    audience: ['all'],
  });

  await SiteConfig.create({
    tenantId: tenantA._id,
    branding: { schoolName: 'Scholify Demo School', tagline: 'Learn. Grow. Lead.' },
    dynamicPages: [
      { key: 'about', title: 'About Us', content: 'A modern SaaS school platform.', updatedAt: new Date() },
    ],
  });

  console.log('Seed complete. Created demo schools without user accounts.');
}
