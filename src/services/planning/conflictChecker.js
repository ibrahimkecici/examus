const { overlaps, sameDate } = require('../../utils/time');

function scheduleKey(date, startTime, endTime) {
  return `${new Date(date).toISOString().slice(0, 10)}:${startTime}:${endTime}`;
}

function hasStudentConflict(placed, students, date, startTime, endTime) {
  const studentIds = new Set(students.map((student) => student.id));
  return placed.some((item) => {
    if (!sameDate(item.date, date) || !overlaps(item.startTime, item.endTime, startTime, endTime)) return false;
    return item.studentIds.some((studentId) => studentIds.has(studentId));
  });
}

function hasRoomConflict(placed, roomIds, date, startTime, endTime) {
  const selectedRoomIds = new Set(roomIds);
  return placed.some((item) => {
    if (!sameDate(item.date, date) || !overlaps(item.startTime, item.endTime, startTime, endTime)) return false;
    return item.roomIds.some((roomId) => selectedRoomIds.has(roomId));
  });
}

function hasInvigilatorConflict(assignments, invigilatorId, date, startTime, endTime) {
  const load = assignments.get(invigilatorId) || [];
  return load.some((item) => sameDate(item.date, date) && overlaps(item.startTime, item.endTime, startTime, endTime));
}

function countStudentExamsOnDay(placed, students, date) {
  const counts = new Map();
  const studentIds = new Set(students.map((student) => student.id));
  for (const item of placed) {
    if (!sameDate(item.date, date)) continue;
    for (const studentId of item.studentIds) {
      if (!studentIds.has(studentId)) continue;
      counts.set(studentId, (counts.get(studentId) || 0) + 1);
    }
  }
  return counts;
}

function studentDayLoadPenalty(placed, students, date, strategy = 'balanced') {
  const counts = countStudentExamsOnDay(placed, students, date);
  let penalty = 0;
  for (const currentCount of counts.values()) {
    const nextCount = currentCount + 1;
    if (nextCount === 2) penalty += strategy === 'compact' ? 8 : 18;
    if (nextCount >= 3) penalty += strategy === 'compact' ? 90 : 140;
  }
  return penalty;
}

function availabilityAllows(invigilator, date, startTime, endTime) {
  if (!Array.isArray(invigilator.availability) || invigilator.availability.length === 0) return true;
  return invigilator.availability.some((item) => {
    if (item.status && String(item.status).toUpperCase() !== 'MUSAIT') return false;
    return sameDate(item.date, date) && item.startTime <= startTime && item.endTime >= endTime;
  });
}

module.exports = {
  availabilityAllows,
  countStudentExamsOnDay,
  hasInvigilatorConflict,
  hasRoomConflict,
  hasStudentConflict,
  scheduleKey,
  studentDayLoadPenalty,
};
