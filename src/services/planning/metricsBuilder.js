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
  const totals = {
    timeEfficiency: 100,
    roomEfficiency: 100,
    invigilatorFairness: 100,
    studentLoadBalance: 100,
    specialNeedsCompliance: 100,
    mixedRoomEfficiency: 100,
  };
  for (const parts of scoreParts) {
    totals.timeEfficiency -= Math.max(0, parts.timeEfficiency || 0) * 0.2;
    totals.roomEfficiency -= Math.max(0, parts.roomEfficiency || 0) * 0.2;
    totals.invigilatorFairness -= Math.max(0, parts.invigilatorFairness || 0) * 0.2;
    totals.studentLoadBalance -= Math.max(0, parts.studentLoadBalance || 0) * 0.2;
    totals.mixedRoomEfficiency += Math.abs(Math.min(0, parts.mixedRoomEfficiency || 0)) * 0.15;
  }
  return Object.fromEntries(Object.entries(totals).map(([key, value]) => [key, Math.max(0, Math.min(100, Math.round(value)))]));
}

function buildScenarioMetrics({ exams, placements, roomStats, invigilatorLoad, invigilators, warnings, scoreParts, specialNeeds, seatRisks, explanations }) {
  const totalAssigned = roomStats.reduce((sum, item) => sum + item.assignedCount, 0);
  const totalCapacity = roomStats.reduce((sum, item) => sum + item.capacity, 0);
  const totalUnusedCapacity = roomStats.reduce((sum, item) => sum + Math.max(0, item.capacity - item.assignedCount), 0);
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
  const score = Math.max(0, Math.round(100 - rawPenalty / 6 - warnings.filter((warning) => warning.severity === 'hard').length * 100));

  return {
    score,
    examCount: exams.length,
    plannedExamCount: placements.reduce((sum, item) => sum + item.group.exams.length, 0),
    totalExamCount: exams.length,
    usedDayCount,
    scheduledDays: usedDayCount,
    usedRoomCount,
    usedRoomSlotCount: roomStats.length,
    averageRoomUtilization: totalCapacity > 0 ? Number((totalAssigned / totalCapacity).toFixed(3)) : 0,
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
    sameCourseFrontBackSeatCount: seatRisks.sameCourseFrontBackSeatCount,
    warningCount: warnings.length,
    scoreBreakdown: breakdown,
    explanations,
    warnings,
  };
}

module.exports = { buildScenarioMetrics, scoreBreakdown };
