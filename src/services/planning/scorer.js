const { evaluatePlacementCandidate, dateIndexPenalty } = require('./scenarioScorer');

function evaluateCandidate(args) {
  if (args.group) return evaluatePlacementCandidate(args);
  const group = {
    mixed: false,
    exams: [args.exam],
    examGroups: [{ exam: args.exam, course: args.exam.course, students: args.students }],
    students: args.students,
    studentIds: args.students.map((student) => student.id),
    durationMinutes: args.exam.durationMinutes || args.schedule.durationMinutes,
  };
  return evaluatePlacementCandidate({
    ...args,
    group,
    weights: args.weights || {
      usedDayCountPenalty: 0,
      roomWastePenalty: 1,
      roomCountPenalty: 0,
      invigilatorFairnessPenalty: 1,
      sameDayStudentPenalty: 1,
      backToBackStudentPenalty: 1,
      mixedRoomEfficiencyBonus: 0,
      compactSlotPenalty: 0,
    },
    config: args.config || { strictAvailability: false, invigilatorRules: [{ maxStudents: Number.POSITIVE_INFINITY, count: args.requiredInvigilators || 1 }] },
  });
}

module.exports = { dateIndexPenalty, evaluateCandidate, evaluatePlacementCandidate };
