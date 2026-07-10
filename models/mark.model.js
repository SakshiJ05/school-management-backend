import mongoose from 'mongoose';

const markSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    examId: { type: mongoose.Schema.Types.ObjectId, ref: 'Exam', required: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject' },
    marksObtained: { type: Number, default: 0 },
    maxMarks: { type: Number, default: 100 },
    grade: { type: String, default: '' },
    remarks: { type: String, default: '' },
  },
  { timestamps: true },
);

markSchema.index({ tenantId: 1, examId: 1, studentId: 1, subjectId: 1 }, { unique: true });

export default mongoose.models.Mark || mongoose.model('Mark', markSchema);
