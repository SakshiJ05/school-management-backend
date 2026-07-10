import mongoose from 'mongoose';

const feeStructureSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    name: { type: String, required: true },
    classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
    amount: { type: Number, required: true },
    frequency: { type: String, enum: ['monthly', 'quarterly', 'annual', 'one-time'], default: 'annual' },
    dueDay: { type: Number, default: 1 },
    heads: [{ name: String, amount: Number }],
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

feeStructureSchema.index({ tenantId: 1, classId: 1 });

export default mongoose.models.FeeStructure || mongoose.model('FeeStructure', feeStructureSchema);
