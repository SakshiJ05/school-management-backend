import mongoose from 'mongoose';

const homeworkSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    // Stored as strings to match the frontend which sends slug-style class/subject ids.
    classId: { type: String, default: '' },
    subjectId: { type: String, default: '' },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    dueDate: { type: String, default: '' },
    attachmentUrl: { type: String, default: '' },
    createdBy: { type: String, default: '' },
    status: { type: String, enum: ['open', 'closed'], default: 'open' },
  },
  { timestamps: true },
);

homeworkSchema.index({ tenantId: 1, classId: 1, dueDate: 1 });

export default mongoose.models.Homework || mongoose.model('Homework', homeworkSchema);
