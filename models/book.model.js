import mongoose from 'mongoose';

const bookSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    title: { type: String, required: true },
    author: { type: String, default: '' },
    isbn: { type: String, default: '' },
    category: { type: String, default: 'General' },
    totalCopies: { type: Number, default: 1 },
    availableCopies: { type: Number, default: 1 },
    shelf: { type: String, default: '' },
  },
  { timestamps: true },
);

export default mongoose.models.Book || mongoose.model('Book', bookSchema);
