import mongoose from 'mongoose';

const timetableSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
    sectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Section' },
    subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: true },
    dayOfWeek: { type: Number, min: 0, max: 6, required: true },
    period: { type: Number, required: true },
    startTime: { type: String, default: '09:00' },
    endTime: { type: String, default: '09:45' },
    room: { type: String, default: '' },
  },
  { timestamps: true },
);

timetableSchema.index({ tenantId: 1, classId: 1, dayOfWeek: 1, period: 1 }, { unique: true });

export default mongoose.models.Timetable || mongoose.model('Timetable', timetableSchema);
