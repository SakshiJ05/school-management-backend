export function calculateGrade(marks, maxMarks = 100) {
  const pct = maxMarks ? (marks / maxMarks) * 100 : 0;
  if (pct >= 90) return 'A+';
  if (pct >= 80) return 'A';
  if (pct >= 70) return 'B+';
  if (pct >= 60) return 'B';
  if (pct >= 50) return 'C';
  if (pct >= 35) return 'D';
  return 'F';
}

/** Legacy flat summary (kept for callers that only need the overall numbers). */
export function reportCardSummary(marks) {
  const total = marks.reduce((s, m) => s + Number(m.marksObtained || 0), 0);
  const max = marks.reduce((s, m) => s + Number(m.maxMarks || 100), 0);
  const percentage = max ? Math.round((total / max) * 100) : 0;
  return { total, max, percentage, grade: calculateGrade(total, max) };
}

/** A subject passes if it meets the exam's passMarks, else the 35% default. */
function isPass(marksObtained, maxMarks, passMarks) {
  const obtained = Number(marksObtained || 0);
  const pass = passMarks != null ? Number(passMarks) : Number(maxMarks || 100) * 0.35;
  return obtained >= pass;
}

/**
 * Detailed report card grouped by exam/term, each with per-subject rows,
 * pass/fail and an overall summary.
 *
 * `marks` entries may carry: examId, examName, subjectId, subjectName,
 * marksObtained, maxMarks, passMarks.
 */
export function buildReportCard(marks) {
  const examMap = new Map();
  for (const m of marks) {
    const examKey = String(m.examId || 'ungrouped');
    if (!examMap.has(examKey)) {
      examMap.set(examKey, { examId: examKey, examName: m.examName || 'Exam', subjects: [] });
    }
    const passed = isPass(m.marksObtained, m.maxMarks, m.passMarks);
    examMap.get(examKey).subjects.push({
      subjectId: m.subjectId ? String(m.subjectId) : null,
      subjectName: m.subjectName || 'Subject',
      marksObtained: Number(m.marksObtained || 0),
      maxMarks: Number(m.maxMarks || 100),
      grade: calculateGrade(Number(m.marksObtained || 0), Number(m.maxMarks || 100)),
      result: passed ? 'PASS' : 'FAIL',
    });
  }

  const byExam = [...examMap.values()].map((exam) => {
    const total = exam.subjects.reduce((s, x) => s + x.marksObtained, 0);
    const max = exam.subjects.reduce((s, x) => s + x.maxMarks, 0);
    const percentage = max ? Math.round((total / max) * 100) : 0;
    const result = exam.subjects.every((x) => x.result === 'PASS') ? 'PASS' : 'FAIL';
    return { ...exam, total, max, percentage, grade: calculateGrade(total, max), result };
  });

  const total = byExam.reduce((s, e) => s + e.total, 0);
  const max = byExam.reduce((s, e) => s + e.max, 0);
  const percentage = max ? Math.round((total / max) * 100) : 0;
  const overall = {
    total,
    max,
    percentage,
    grade: calculateGrade(total, max),
    result: byExam.length && byExam.every((e) => e.result === 'PASS') ? 'PASS' : 'FAIL',
  };

  return { overall, byExam };
}
