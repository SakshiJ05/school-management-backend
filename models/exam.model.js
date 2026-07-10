import mongoose from 'mongoose';

const examSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    name: { type: String, required: true },
    type: { type: String, default: 'written' },
    classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
    subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject' },
    startDate: { type: String, default: '' },
    endDate: { type: String, default: '' },
    maxMarks: { type: Number, default: 100 },
    passMarks: { type: Number, default: 35 },
  },
  { timestamps: true },
);

export default mongoose.models.Exam || mongoose.model('Exam', examSchema);
