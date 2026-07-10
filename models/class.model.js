import mongoose from 'mongoose';

const classSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    name: { type: String, required: true, trim: true },
    level: { type: Number, default: 1 },
    academicYear: { type: String, default: '2025-26' },
    subjectIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Subject' }],
  },
  { timestamps: true },
);

export default mongoose.models.Class || mongoose.model('Class', classSchema);
