const { estimateSavings } = require('./mixedRoomPlanner');

function distributionByName(invigilatorLoad, invigilatorById) {
  const output = {};
  for (const [id, load] of invigilatorLoad.entries()) {
    const invigilator = invigilatorById.get(id);
    const name = invigilator ? `${invigilator.title || ''} ${invigilator.firstName} ${invigilator.lastName}`.replace(/\s+/g, ' ').trim() : id;
    output[name] = load.length;
  }
  return output;
}

function scoreBreakdown(scoreParts) {
  if (scoreParts.length === 0) {
    return { timeEfficiency: 100, roomEfficiency: 100, invigilatorFairness: 100, studentLoadBalance: 100, specialNeedsCompliance: 100, mixedRoomEfficiency: 100 };
  }
  const n = scoreParts.length;
  const avg = (key) => scoreParts.reduce((sum, p) => sum + Math.max(0, p[key] || 0), 0) / n;
  const avgMixed = scoreParts.reduce((sum, p) => sum + Math.abs(Math.min(0, p.mixedRoomEfficiency || 0)), 0) / n;

  // Scale each average penalty to a 0-100 score. Penalty values are raw room/time costs —
  // divide by a reference budget so 1 average-room-worth of waste ≈ 30 points deducted.
  const toScore = (avgPenalty, budget) => Math.max(0, Math.min(100, Math.round(100 - (avgPenalty / budget) * 100)));

  return {
    timeEfficiency: toScore(avg('timeEfficiency'), 50),
    roomEfficiency: toScore(avg('roomEfficiency'), 250),
    invigilatorFairness: toScore(avg('invigilatorFairness'), 50),
    studentLoadBalance: toScore(avg('studentLoadBalance'), 50),
    specialNeedsCompliance: 100,
    mixedRoomEfficiency: Math.min(100, Math.round(100 + avgMixed * 0.15)),
  };
}

function buildScenarioMetrics({ exams, placements, roomStats, invigilatorLoad, invigilators, warnings, scoreParts, specialNeeds, seatRisks, explanations, seatAssignments = [] }) {
  const totalAssigned = roomStats.reduce((sum, item) => sum + item.assignedCount, 0);
  const totalCapacity = roomStats.reduce((sum, item) => sum + item.capacity, 0);
  const totalEffectiveCapacity = roomStats.reduce((sum, item) => sum + (item.effectiveCapacity ?? item.capacity), 0);
  const totalUnusedCapacity = roomStats.reduce((sum, item) => sum + Math.max(0, (item.effectiveCapacity ?? item.capacity) - item.assignedCount), 0);
  const usedDayCount = new Set(placements.map((item) => new Date(item.date).toISOString().slice(0, 10))).size;
  const usedRoomCount = new Set(roomStats.map((item) => item.roomId)).size;
  const mixedSavings = estimateSavings(placements.map((item) => item.group));
  const mixedRoomStats = roomStats.filter((item) => item.mixed);
  const mixedCapacity = mixedRoomStats.reduce((sum, item) => sum + item.capacity, 0);
  const mixedAssigned = mixedRoomStats.reduce((sum, item) => sum + item.assignedCount, 0);
  const breakdown = scoreBreakdown(scoreParts);
  const rawPenalty = Object.values(breakdown).reduce((sum, value) => sum + (100 - value), 0);
  const studentConflictCount = warnings.filter((warning) => warning.type === 'STUDENT_CONFLICT').length;
  const roomConflictCount = warnings.filter((warning) => warning.type === 'ROOM_CONFLICT').length;
  const invigilatorConflictCount = warnings.filter((warning) => warning.type === 'INVIGILATOR_CONFLICT').length;

  // Coverage: derive from actual seat assignments and enrollment lists
  const uniqueAssignedByExam = new Map(); // examId -> Set<studentId>
  for (const a of seatAssignments) {
    const examId = a.exam?.id || a.examId;
    if (!examId || !a.student?.id) continue;
    if (!uniqueAssignedByExam.has(examId)) uniqueAssignedByExam.set(examId, new Set());
    uniqueAssignedByExam.get(examId).add(a.student.id);
  }

  const examCoverage = exams.map((exam) => {
    const expected = exam.course?.enrollments?.length ?? 0;
    const actual = uniqueAssignedByExam.get(exam.id)?.size ?? 0;
    return { examId: exam.id, courseCode: exam.course?.code, expected, actual, missing: Math.max(0, expected - actual), extra: Math.max(0, actual - expected) };
  });

  const totalExpectedStudents = examCoverage.reduce((sum, e) => sum + e.expected, 0);
  const totalAssignedStudents = examCoverage.reduce((sum, e) => sum + e.actual, 0);
  const unassignedStudentCount = examCoverage.reduce((sum, e) => sum + e.missing, 0);
  const overAssignedStudentCount = examCoverage.reduce((sum, e) => sum + e.extra, 0);

  // Count exams that are fully covered (all enrolled students assigned)
  const fullyCoveredExamCount = examCoverage.filter((e) => e.expected > 0 && e.missing === 0 && e.extra === 0).length;
  const partiallyPlannedExamIds = new Set(examCoverage.filter((e) => e.missing > 0 || e.extra > 0).map((e) => e.examId));

  const plannedExamCount = placements
    .reduce((sum, item) => sum + item.group.exams.filter((e) => !partiallyPlannedExamIds.has(e.id)).length, 0);

  const examCoveragePercent = totalExpectedStudents > 0
    ? Number(((totalAssignedStudents / totalExpectedStudents) * 100).toFixed(1))
    : 100;

  const score = Math.max(0, Math.round(100 - rawPenalty / 6 - warnings.filter((warning) => warning.severity === 'hard').length * 100));

  return {
    score,
    examCount: exams.length,
    plannedExamCount,
    totalExamCount: exams.length,
    usedDayCount,
    scheduledDays: usedDayCount,
    usedRoomCount,
    usedRoomSlotCount: roomStats.length,
    averageRoomUtilization: totalEffectiveCapacity > 0 ? Number((totalAssigned / totalEffectiveCapacity).toFixed(3)) : 0,
    totalUnusedCapacity,
    capacityWaste: totalUnusedCapacity,
    studentConflictCount,
    roomConflictCount,
    invigilatorConflictCount,
    sameDayStudentExamPenalty: scoreParts.reduce((sum, item) => sum + Math.max(0, item.studentLoadBalance || 0), 0),
    invigilatorLoadDistribution: distributionByName(invigilatorLoad, new Map(invigilators.map((item) => [item.id, item]))),
    specialNeedsHandledCount: specialNeeds.handledCount,
    specialNeedsWarningCount: specialNeeds.warningCount,
    mixedRoomCount: mixedSavings.mixedRoomCount,
    roomsSavedByMixing: mixedSavings.roomsSavedByMixing,
    invigilatorsSavedByMixing: mixedSavings.invigilatorsSavedByMixing,
    averageMixedRoomUtilization: mixedCapacity > 0 ? Number((mixedAssigned / mixedCapacity).toFixed(3)) : 0,
    sameCourseAdjacentSeatCount: seatRisks.sameCourseAdjacentSeatCount,
    sameCourseSameBookletFrontBackAvoidableCount: seatRisks.sameCourseSameBookletFrontBackAvoidableCount,
    sameCourseSameBookletFrontBackUnavoidableCount: seatRisks.sameCourseSameBookletFrontBackUnavoidableCount,
    warningCount: warnings.length,
    scoreBreakdown: breakdown,
    explanations,
    warnings,
    totalExpectedStudents,
    totalAssignedStudents,
    unassignedStudentCount,
    overAssignedStudentCount,
    examCoveragePercent,
    examCoverage,
  };
}

module.exports = { buildScenarioMetrics, scoreBreakdown };
