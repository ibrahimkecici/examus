const { requiresAccessibleRoom, requiresLowDistraction } = require('./specialNeeds');

function activeSeatCapacity(room) {
  if (room.examCapacity) return room.examCapacity;
  if (Array.isArray(room.seats) && room.seats.length > 0) {
    return room.seats.filter((seat) => seat.status === 'AKTIF').reduce((sum, seat) => sum + (seat.capacity || 1), 0);
  }
  return room.capacity || 0;
}

function parseJson(value) {
  if (!value) return {};
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return {};
    }
  }
  return value;
}

function requiredRoomTypeForExam(exam) {
  return exam.requiredRoomType || exam.specialRules?.requiredRoomType || exam.course?.requiredRoomType || exam.course?.specialRules?.requiredRoomType || null;
}

function requiredFeaturesForExam(exam, students = []) {
  const required = {
    ...parseJson(exam.course?.requiredFeatures),
    ...parseJson(exam.course?.specialRules?.requiredFeatures),
    ...parseJson(exam.requiredFeatures),
    ...parseJson(exam.specialRules?.requiredFeatures),
  };
  if (students.some(requiresAccessibleRoom)) required.accessible = true;
  return required;
}

function classroomMeetsRequirements(room, examGroups) {
  const features = parseJson(room.features);
  for (const group of examGroups) {
    const roomType = requiredRoomTypeForExam(group.exam);
    if (roomType && room.roomType && room.roomType !== roomType) return false;
    if (roomType && !room.roomType) return false;
    const requiredFeatures = requiredFeaturesForExam(group.exam, group.students);
    for (const [feature, required] of Object.entries(requiredFeatures)) {
      if (required && !features[feature]) return false;
    }
    if (group.students.some(requiresLowDistraction) && activeSeatCapacity(room) > group.students.length * 2) return false;
  }
  return true;
}

function roomWastePenalty(totalCapacity, needed, strategyWeights, strategy) {
  const unused = Math.max(0, totalCapacity - needed);
  const utilization = totalCapacity > 0 ? needed / totalCapacity : 0;
  let penalty = unused * strategyWeights.roomWastePenalty * 0.12;
  if (utilization < 0.5) penalty += strategyWeights.roomWastePenalty;
  if (needed <= 6 && totalCapacity >= 14) penalty += strategyWeights.roomWastePenalty * 1.8;
  if (strategy === 'minimum_rooms') penalty *= 0.75;
  return penalty;
}

function buildRoomCandidates(classrooms, examGroups, strategyWeights, strategy = 'efficient') {
  const needed = examGroups.reduce((sum, group) => sum + group.students.length, 0);
  return [...classrooms]
    .filter((room) => classroomMeetsRequirements(room, examGroups))
    .map((room) => {
      const totalCapacity = activeSeatCapacity(room);
      return {
        rooms: [room],
        totalCapacity,
        unusedCapacity: Math.max(0, totalCapacity - needed),
        utilization: totalCapacity > 0 ? needed / totalCapacity : 0,
      };
    })
    .filter((candidate) => candidate.totalCapacity >= needed)
    .sort((a, b) => a.totalCapacity - b.totalCapacity || String(a.rooms[0].code).localeCompare(String(b.rooms[0].code), 'tr'))
    .slice(0, 16)
    .map((candidate) => ({
      ...candidate,
      score: roomWastePenalty(candidate.totalCapacity, needed, strategyWeights, strategy) + strategyWeights.roomCountPenalty,
    }));
}

module.exports = {
  activeSeatCapacity,
  buildRoomCandidates,
  classroomMeetsRequirements,
  parseJson,
  requiredFeaturesForExam,
  requiredRoomTypeForExam,
  roomWastePenalty,
};
