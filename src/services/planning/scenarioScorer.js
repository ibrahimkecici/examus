const { hasRoomConflict, hasStudentConflict } = require('./conflictChecker');
const { requiredInvigilatorCount } = require('./config');
const { selectInvigilators } = require('./invigilatorAllocator');
const { activeSeatCapacity } = require('./roomAllocator');
const { studentBackToBackPenalty, studentDayLoadPenalty } = require('./studentLoadAnalyzer');

function dateKey(date) {
  return new Date(date).toISOString().slice(0, 10);
}

function dateIndexPenalty(schedule, dates, weights, strategy) {
  const index = dates.findIndex((item) => dateKey(item) === dateKey(schedule.date));
  if (strategy === 'compact') return index * weights.compactSlotPenalty;
  if (strategy === 'balanced' || strategy === 'student_friendly') {
    const middle = (dates.length - 1) / 2;
    return Math.abs(index - middle) * weights.usedDayCountPenalty * 0.08;
  }
  return index * weights.compactSlotPenalty * 0.35;
}

function newDayPenalty(placements, schedule, weights) {
  return placements.some((item) => dateKey(item.date) === dateKey(schedule.date)) ? 0 : weights.usedDayCountPenalty;
}

function evaluatePlacementCandidate({ group, schedule, roomCandidate, invigilators, placements, invigilatorLoad, dates, strategy, weights, config }) {
  if (hasStudentConflict(placements, group.students, schedule.date, schedule.startTime, schedule.endTime)) return { valid: false, reason: 'STUDENT_CONFLICT' };
  if (hasRoomConflict(placements, roomCandidate.rooms.map((room) => room.id), schedule.date, schedule.startTime, schedule.endTime)) return { valid: false, reason: 'ROOM_CONFLICT' };

  const classroom = roomCandidate.rooms[0];
  const requiredInvigilators = requiredInvigilatorCount(group.students.length, config);
  const invigilatorSelection = selectInvigilators(invigilators, group.examGroups, schedule, invigilatorLoad, requiredInvigilators, weights, config, classroom);
  if (!invigilatorSelection.valid) return { valid: false, reason: invigilatorSelection.reason || 'INVIGILATOR_UNAVAILABLE' };

  const studentLoadPenalty =
    studentDayLoadPenalty(placements, group.students, schedule.date, weights) +
    studentBackToBackPenalty(placements, group.students, schedule.date, schedule.startTime, schedule.endTime, weights);
  const timePenalty = dateIndexPenalty(schedule, dates, weights, strategy) + newDayPenalty(placements, schedule, weights);
  const mixedBonus = group.mixed ? weights.mixedRoomEfficiencyBonus + Math.max(0, group.exams.length - 1) * weights.roomCountPenalty : 0;
  const roomScore = roomCandidate.score;
  const invigilatorScore = invigilatorSelection.score;
  const score = roomScore + invigilatorScore + studentLoadPenalty + timePenalty - mixedBonus;

  return {
    valid: true,
    group,
    schedule,
    rooms: roomCandidate.rooms,
    roomCandidate,
    invigilators: invigilatorSelection.invigilators,
    score,
    scoreParts: {
      roomEfficiency: roomScore,
      invigilatorFairness: invigilatorScore,
      studentLoadBalance: studentLoadPenalty,
      timeEfficiency: timePenalty,
      mixedRoomEfficiency: -mixedBonus,
      specialNeedsCompliance: 0,
    },
    explanation: group.mixed
      ? `${group.examGroups.map((item) => item.course.code).join(', ')} karma salona aday oldu; ortak öğrenci yok ve ${activeSeatCapacity(classroom)} kapasiteli ${classroom.code} doluluğu artırıyor.`
      : `${group.examGroups[0].course.code}, ${classroom.code} dersliğine aday oldu çünkü ${group.students.length} öğrenci için uygun kapasite sağlıyor.`,
  };
}

module.exports = { dateIndexPenalty, evaluatePlacementCandidate, newDayPenalty };
