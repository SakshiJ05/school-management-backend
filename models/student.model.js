import mongoose from 'mongoose';

const guardianSchema = new mongoose.Schema(
  {
    name: { type: String, default: '' },
    phone: { type: String, default: '' },
    email: { type: String, default: '', lowercase: true },
    relation: { type: String, default: 'Guardian' },
  },
  { _id: false },
);

const studentSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    name: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, default: '' },
    admissionNo: { type: String, required: true, trim: true },
    rollNo: { type: String, required: true, trim: true },
    classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
    sectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Section' },
    studentClass: { type: String, default: '' },
    section: { type: String, default: '' },
    subjectIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Subject' }],
    gender: { type: String, default: 'Not set' },
    status: { type: String, default: 'Active' },
    dateOfBirth: { type: String, default: '' },
    address: { type: String, default: '' },
    photoUrl: { type: String, default: '' },
    guardian: guardianSchema,
    parentName: { type: String, default: '' },
    parentPhone: { type: String, default: '' },
    parentEmail: { type: String, default: '', lowercase: true },
    parentRelation: { type: String, default: 'Guardian' },
    admissionDate: { type: String, default: '' },
  },
  { timestamps: true },
);

studentSchema.index({ tenantId: 1, admissionNo: 1 }, { unique: true });
studentSchema.index({ tenantId: 1, createdAt: -1 });
studentSchema.index({ tenantId: 1, studentClass: 1, section: 1, status: 1, createdAt: -1 });

export default mongoose.models.Student || mongoose.model('Student', studentSchema);
