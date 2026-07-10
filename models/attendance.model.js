import mongoose from 'mongoose';

const attendanceSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },
    date: { type: String, required: true },
    status: { type: String, enum: ['present', 'absent', 'leave'], required: true },
    remarks: { type: String, default: '' },
  },
  { timestamps: true },
);

attendanceSchema.index({ tenantId: 1, studentId: 1, date: 1 }, { unique: true });

export default mongoose.models.Attendance || mongoose.model('Attendance', attendanceSchema);
