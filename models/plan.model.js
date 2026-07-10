import mongoose from 'mongoose';

const planSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'INR' },
    features: [{ type: String, trim: true }],
    // Quantitative limits (0 or null = unlimited).
    maxStudents: { type: Number, default: 0, min: 0 },
    maxTeachers: { type: Number, default: 0, min: 0 },
    // Allowed module keys for feature gating (empty = all modules allowed).
    modules: [{ type: String, trim: true }],
    durationMonths: { type: Number, required: true, min: 1, default: 12 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export default mongoose.models.Plan || mongoose.model('Plan', planSchema);
