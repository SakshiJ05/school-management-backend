import mongoose from 'mongoose';

const sectionSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
    name: { type: String, required: true, trim: true },
    capacity: { type: Number, default: 40 },
    room: { type: String, default: '' },
  },
  { timestamps: true },
);

export default mongoose.models.Section || mongoose.model('Section', sectionSchema);
