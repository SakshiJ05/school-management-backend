/**
 * ERP domain models that previously had no backend at all — the Angular modules
 * (transport, admissions, HR, hostel, LMS, inventory, communication, fee
 * categories/concessions/assignments, notifications) all called these endpoints
 * and 404'd in `api` mode.
 *
 * Schemas are intentionally non-strict: the frontend owns the exact field shape
 * per module, and rejecting unknown keys would silently drop user data. Every
 * document is tenant-scoped and indexed.
 */
import mongoose from 'mongoose';

function tenantModel(name, extraFields = {}, extraIndexes = []) {
  const schema = new mongoose.Schema(
    {
      tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
      ...extraFields,
    },
    { timestamps: true, strict: false },
  );
  for (const idx of extraIndexes) schema.index(idx);
  return mongoose.models[name] || mongoose.model(name, schema);
}

/* ---- Fees ---- */
export const FeeCategory = tenantModel('FeeCategory', {
  name: { type: String, required: true, trim: true },
  amount: { type: Number, default: 0 },
});

export const FeeConcession = tenantModel(
  'FeeConcession',
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
    reason: { type: String, default: '' },
    amount: { type: Number, default: 0 },
  },
  [{ tenantId: 1, studentId: 1 }],
);

export const StudentFeeAssignment = tenantModel(
  'StudentFeeAssignment',
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
    feeStructureId: { type: mongoose.Schema.Types.ObjectId, ref: 'FeeStructure' },
  },
  [{ tenantId: 1, studentId: 1 }],
);

/* ---- Communication ---- */
export const Broadcast = tenantModel('Broadcast', {
  title: { type: String, required: true, trim: true },
  body: { type: String, default: '' },
  audience: [{ type: String }],
});

export const Notification = tenantModel(
  'Notification',
  {
    title: { type: String, default: '' },
    body: { type: String, default: '' },
    read: { type: Boolean, default: false },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  [{ tenantId: 1, userId: 1, read: 1 }],
);

/* ---- Transport ---- */
export const TransportRoute = tenantModel('TransportRoute', {
  name: { type: String, required: true, trim: true },
  vehicleNo: { type: String, default: '' },
  driverName: { type: String, default: '' },
});

export const TransportAssignment = tenantModel(
  'TransportAssignment',
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
    routeId: { type: mongoose.Schema.Types.ObjectId, ref: 'TransportRoute' },
  },
  [{ tenantId: 1, routeId: 1 }],
);

/* ---- Admissions ---- */
export const Enquiry = tenantModel('Enquiry', {
  name: { type: String, required: true, trim: true },
  phone: { type: String, default: '' },
  status: { type: String, default: 'new' },
});

export const Admission = tenantModel('Admission', {
  name: { type: String, required: true, trim: true },
  status: { type: String, default: 'pending' },
});

/* ---- HR ---- */
export const LeaveRequest = tenantModel(
  'LeaveRequest',
  {
    staffId: { type: String, default: '' },
    fromDate: { type: String, default: '' },
    toDate: { type: String, default: '' },
    status: { type: String, default: 'pending' },
  },
  [{ tenantId: 1, status: 1 }],
);

export const PayrollRecord = tenantModel(
  'PayrollRecord',
  {
    staffId: { type: String, default: '' },
    month: { type: String, default: '' },
    amount: { type: Number, default: 0 },
    status: { type: String, default: 'pending' },
  },
  [{ tenantId: 1, month: 1 }],
);

/* ---- Hostel ---- */
export const HostelRoom = tenantModel('HostelRoom', {
  roomNo: { type: String, required: true, trim: true },
  capacity: { type: Number, default: 1 },
});

export const HostelAllocation = tenantModel(
  'HostelAllocation',
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'HostelRoom' },
  },
  [{ tenantId: 1, roomId: 1 }],
);

/* ---- LMS & Inventory ---- */
export const LmsCourse = tenantModel('LmsCourse', {
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
});

export const InventoryItem = tenantModel('InventoryItem', {
  name: { type: String, required: true, trim: true },
  quantity: { type: Number, default: 0 },
});
