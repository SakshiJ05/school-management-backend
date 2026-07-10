import mongoose from 'mongoose';

const bookIssueSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    bookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    issuedAt: { type: String, required: true },
    dueAt: { type: String, required: true },
    returnedAt: { type: String, default: '' },
    fine: { type: Number, default: 0 },
    status: { type: String, enum: ['issued', 'returned', 'overdue'], default: 'issued' },
  },
  { timestamps: true },
);

export default mongoose.models.BookIssue || mongoose.model('BookIssue', bookIssueSchema);
