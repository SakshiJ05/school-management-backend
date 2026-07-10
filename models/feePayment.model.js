import mongoose from 'mongoose';

const feePaymentSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    feeStructureId: { type: mongoose.Schema.Types.ObjectId, ref: 'FeeStructure' },
    head: { type: String, default: 'Tuition' },
    amount: { type: Number, required: true },
    amountPaid: { type: Number, default: 0 },
    dueDate: { type: String, default: '' },
    paidDate: { type: String, default: '' },
    status: { type: String, enum: ['pending', 'paid', 'overdue', 'partial'], default: 'pending' },
    invoiceNo: { type: String, default: '' },
    receiptNo: { type: String, default: '' },
    paymentMethod: { type: String, default: '' },
    transactionId: { type: String, default: '' },
    reminderSentAt: { type: Date },
  },
  { timestamps: true },
);

feePaymentSchema.index({ tenantId: 1, studentId: 1 });
feePaymentSchema.index({ tenantId: 1, status: 1 });

export default mongoose.models.FeePayment || mongoose.model('FeePayment', feePaymentSchema);
