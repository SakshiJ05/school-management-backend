import mongoose from 'mongoose';

const teacherSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    name: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, default: '' },
    employeeId: { type: String, required: true, trim: true },
    department: { type: String, default: 'General' },
    designation: { type: String, default: 'Teacher' },
    subjectIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Subject' }],
    classIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Class' }],
    photoUrl: { type: String, default: '' },
    status: { type: String, default: 'Active' },
  },
  { timestamps: true },
);

teacherSchema.index({ tenantId: 1, employeeId: 1 }, { unique: true });

export default mongoose.models.Teacher || mongoose.model('Teacher', teacherSchema);
