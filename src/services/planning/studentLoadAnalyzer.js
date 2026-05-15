const { overlaps, sameDate, toMinutes } = require('../../utils/time');

function countStudentExamsOnDay(placements, students, date) {
  const counts = new Map();
  const studentIds = new Set(students.map((student) => student.id));
  for (const item of placements) {
    if (!sameDate(item.date, date)) continue;
    for (const studentId of item.studentIds || []) {
      if (studentIds.has(studentId)) counts.set(studentId, (counts.get(studentId) || 0) + 1);
    }
  }
  return counts;
}

function studentDayLoadPenalty(placements, students, date, weights) {
  let penalty = 0;
  for (const currentCount of countStudentExamsOnDay(placements, students, date).values()) {
    const nextCount = currentCount + 1;
    if (nextCount === 2) penalty += weights.sameDayStudentPenalty;
    if (nextCount >= 3) penalty += weights.sameDayStudentPenalty * 3;
  }
  return penalty;
}

function studentBackToBackPenalty(placements, students, date, startTime, endTime, weights) {
  const studentIds = new Set(students.map((student) => student.id));
  let penalty = 0;
  for (const item of placements) {
    if (!sameDate(item.date, date)) continue;
    if (!(item.studentIds || []).some((studentId) => studentIds.has(studentId))) continue;
    const gap = Math.min(Math.abs(toMinutes(startTime) - toMinutes(item.endTime)), Math.abs(toMinutes(item.startTime) - toMinutes(endTime)));
    if (gap >= 0 && gap < 30 && !overlaps(item.startTime, item.endTime, startTime, endTime)) penalty += weights.backToBackStudentPenalty;
  }
  return penalty;
}

module.exports = { countStudentExamsOnDay, studentBackToBackPenalty, studentDayLoadPenalty };
