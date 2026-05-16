const DEFAULT_PLANNING_CONFIG = {
  strictAvailability: false,
  allowMixedRooms: true,
  mixedRoomDurationToleranceMinutes: 0,
  courseInstructorCanInvigilate: true,
  sameDepartmentAllowed: true,
  instructorMustBeAvailableForOwnExam: false,
  maxLocalSearchIterations: 30,
  invigilatorRules: [
    { maxStudents: 30, count: 1 },
    { maxStudents: 70, count: 2 },
    { maxStudents: Number.POSITIVE_INFINITY, count: 3 },
  ],
};

const STRATEGY_WEIGHTS = {
  efficient: {
    usedDayCountPenalty: 55,
    roomWastePenalty: 55,
    roomCountPenalty: 35,
    invigilatorFairnessPenalty: 45,
    sameDayStudentPenalty: 45,
    backToBackStudentPenalty: 30,
    mixedRoomEfficiencyBonus: 55,
    specialNeedsPenalty: 90,
    compactSlotPenalty: 25,
  },
  compact: {
    usedDayCountPenalty: 120,
    roomWastePenalty: 24,
    roomCountPenalty: 30,
    invigilatorFairnessPenalty: 24,
    sameDayStudentPenalty: 45,
    backToBackStudentPenalty: 25,
    mixedRoomEfficiencyBonus: 48,
    specialNeedsPenalty: 90,
    compactSlotPenalty: 4,
  },
  balanced: {
    usedDayCountPenalty: 45,
    roomWastePenalty: 50,
    roomCountPenalty: 35,
    invigilatorFairnessPenalty: 50,
    sameDayStudentPenalty: 85,
    backToBackStudentPenalty: 55,
    mixedRoomEfficiencyBonus: 35,
    specialNeedsPenalty: 95,
    compactSlotPenalty: 22,
  },
  minimum_rooms: {
    usedDayCountPenalty: 45,
    roomWastePenalty: 35,
    roomCountPenalty: 120,
    invigilatorFairnessPenalty: 28,
    sameDayStudentPenalty: 50,
    backToBackStudentPenalty: 30,
    mixedRoomEfficiencyBonus: 110,
    specialNeedsPenalty: 90,
    compactSlotPenalty: 16,
  },
  fair_invigilator: {
    usedDayCountPenalty: 35,
    roomWastePenalty: 35,
    roomCountPenalty: 25,
    invigilatorFairnessPenalty: 120,
    sameDayStudentPenalty: 55,
    backToBackStudentPenalty: 45,
    mixedRoomEfficiencyBonus: 25,
    specialNeedsPenalty: 95,
    compactSlotPenalty: 18,
  },
  student_friendly: {
    usedDayCountPenalty: 30,
    roomWastePenalty: 35,
    roomCountPenalty: 25,
    invigilatorFairnessPenalty: 45,
    sameDayStudentPenalty: 135,
    backToBackStudentPenalty: 100,
    mixedRoomEfficiencyBonus: 20,
    specialNeedsPenalty: 100,
    compactSlotPenalty: 25,
  },
};

function strategyWeights(strategy) {
  return STRATEGY_WEIGHTS[strategy] || STRATEGY_WEIGHTS.efficient;
}

function normalizeStrategy(strategy) {
  if (strategy === 'optimal_cp_sat') return 'efficient';
  if (strategy === 'heuristic' || strategy === 'legacy_heuristic') return 'efficient';
  if (STRATEGY_WEIGHTS[strategy]) return strategy;
  if (strategy === 'spread') return 'balanced';
  return 'efficient';
}

function requiredInvigilatorCount(studentCount, config = DEFAULT_PLANNING_CONFIG) {
  return config.invigilatorRules.find((rule) => studentCount <= rule.maxStudents)?.count || 1;
}

module.exports = { DEFAULT_PLANNING_CONFIG, STRATEGY_WEIGHTS, normalizeStrategy, requiredInvigilatorCount, strategyWeights };
