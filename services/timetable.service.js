const PERIODS = [
  { period: 1, startTime: '09:00', endTime: '09:45' },
  { period: 2, startTime: '09:45', endTime: '10:30' },
  { period: 3, startTime: '10:45', endTime: '11:30' },
  { period: 4, startTime: '11:30', endTime: '12:15' },
  { period: 5, startTime: '13:00', endTime: '13:45' },
  { period: 6, startTime: '13:45', endTime: '14:30' },
];

const DAYS = [1, 2, 3, 4, 5];

/** Auto-generate timetable slots from class subjects and available teachers */
export function generateTimetable({ classId, sectionId, tenantId, subjects, teachers }) {
  const slots = [];
  let subjectIndex = 0;
  for (const dayOfWeek of DAYS) {
    for (const slot of PERIODS) {
      const subject = subjects[subjectIndex % subjects.length];
      if (!subject) continue;
      const teacher =
        teachers.find((t) => t.subjectIds?.some((id) => String(id) === String(subject._id || subject.id))) ||
        teachers[subjectIndex % teachers.length];
      slots.push({
        tenantId,
        classId,
        sectionId,
        subjectId: subject._id || subject.id,
        teacherId: teacher?._id || teacher?.id,
        dayOfWeek,
        period: slot.period,
        startTime: slot.startTime,
        endTime: slot.endTime,
        room: `R-${slot.period}`,
      });
      subjectIndex += 1;
    }
  }
  return slots;
}
