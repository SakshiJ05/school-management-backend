import mongoose from 'mongoose';

const subscriptionSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    planId: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan', required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    status: { type: String, enum: ['active', 'expired', 'cancelled', 'pending'], default: 'active' },
    autoRenew: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export default mongoose.models.Subscription || mongoose.model('Subscription', subscriptionSchema);
