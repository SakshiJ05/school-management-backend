import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    subscriptionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscription' },
    planId: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan' },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'INR' },
    method: { type: String, enum: ['card', 'upi', 'bank', 'cash', 'other'], default: 'upi' },
    status: { type: String, enum: ['paid', 'pending', 'failed', 'refunded'], default: 'paid' },
    transactionRef: { type: String, default: '' },
    gatewayOrderId: { type: String, default: '' },
    invoiceNo: { type: String, default: '' },
    paidAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

paymentSchema.index({ tenantId: 1, paidAt: -1 });

export default mongoose.models.Payment || mongoose.model('Payment', paymentSchema);
