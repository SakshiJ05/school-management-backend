import mongoose from 'mongoose';

const subjectSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, default: '', trim: true },
    type: { type: String, enum: ['core', 'elective', 'lab'], default: 'core' },
    classIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Class' }],
  },
  { timestamps: true },
);

export default mongoose.models.Subject || mongoose.model('Subject', subjectSchema);
