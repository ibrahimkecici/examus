const { requiresAccessibleRoom, requiresLowDistraction } = require('./specialNeeds');
const { activeSeatsForRoom, examHasMultipleBooklets, examHasDenseSafeBooklets, diagonalSafeCapacity } = require('./seatAllocator');
const { safeColumnCapacity, interleavedColumnCapacity, seatsGroupedByColumn } = require('./seatingStrategy');

function activeSeatCapacity(room) {
  if (room.examCapacity) return room.examCapacity;
  if (Array.isArray(room.seats) && room.seats.length > 0) {
    return room.seats.filter((seat) => seat.status === 'AKTIF').reduce((sum, seat) => sum + (seat.capacity || 1), 0);
  }
  return room.capacity || 0;
}

function getEffectiveCapacity(room, isSingleCourse, multiBooklet = false, denseSafeBooklets = false) {
  if (!isSingleCourse) return activeSeatCapacity(room);
  if (multiBooklet && denseSafeBooklets) return activeSeatCapacity(room);
  if (multiBooklet) {
    const seats = activeSeatsForRoom(room);
    if (seats.length > 0) return diagonalSafeCapacity(seats);
    if (room.examCapacity) return room.examCapacity;
    return Math.floor((room.capacity || 0) / 2);
  }
  // Single booklet single course: alternating-column spacing required
  const seats = activeSeatsForRoom(room);
  if (seats.length > 0) return safeColumnCapacity(seats);
  if (room.examCapacity) return room.examCapacity;
  return Math.floor((room.capacity || 0) / 2);
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

function singleRoomCandidate(room, examGroups, strategyWeights, strategy, needed) {
  const isSingleCourse = examGroups.length === 1;
  const physicalCapacity = activeSeatCapacity(room);
  const multiBooklet = isSingleCourse && examHasMultipleBooklets(examGroups[0].exam);
  const denseSafeBooklets = isSingleCourse && examHasDenseSafeBooklets(examGroups[0].exam);
  let effectiveCapacity;
  let usedSafeCapacity = false;
  let safeCap = null;

  if (isSingleCourse) {
    effectiveCapacity = getEffectiveCapacity(room, true, multiBooklet, denseSafeBooklets);
    usedSafeCapacity = (!denseSafeBooklets) && effectiveCapacity !== physicalCapacity;
    safeCap = usedSafeCapacity ? effectiveCapacity : null;
  } else {
    const seats = activeSeatsForRoom(room);
    effectiveCapacity = seats.length > 0
      ? interleavedColumnCapacity(seatsGroupedByColumn(seats), examGroups)
      : physicalCapacity;
  }

  return {
    rooms: [room],
    totalCapacity: effectiveCapacity,
    physicalCapacity,
    safeCapacity: safeCap,
    usedSafeCapacity,
    unusedCapacity: Math.max(0, effectiveCapacity - needed),
    utilization: effectiveCapacity > 0 ? needed / effectiveCapacity : 0,
    score: roomWastePenalty(effectiveCapacity, needed, strategyWeights, strategy) + strategyWeights.roomCountPenalty,
  };
}

function multiRoomCandidates(eligibleRooms, examGroups, strategyWeights, strategy, needed, isSingleCourse, multiBooklet) {
  const denseSafeBooklets = isSingleCourse && multiBooklet && examHasDenseSafeBooklets(examGroups[0].exam);
  const sorted = [...eligibleRooms].sort((a, b) =>
    getEffectiveCapacity(a, isSingleCourse, multiBooklet, denseSafeBooklets) - getEffectiveCapacity(b, isSingleCourse, multiBooklet, denseSafeBooklets) ||
    String(a.code).localeCompare(String(b.code), 'tr'),
  );

  const results = [];
  for (let i = 0; i < sorted.length; i++) {
    let combined = [sorted[i]];
    let combinedCap = getEffectiveCapacity(sorted[i], isSingleCourse, multiBooklet, denseSafeBooklets);
    if (combinedCap >= needed) continue;

    for (let j = i + 1; j < sorted.length; j++) {
      combined = [sorted[i], sorted[j]];
      combinedCap = combined.reduce((sum, r) => sum + getEffectiveCapacity(r, isSingleCourse, multiBooklet, denseSafeBooklets), 0);
      if (combinedCap >= needed) break;
      combined = [];
    }

    if (combined.length >= 2 && combinedCap >= needed) {
      const totalPhysical = combined.reduce((sum, r) => sum + activeSeatCapacity(r), 0);
      results.push({
        rooms: combined,
        totalCapacity: combinedCap,
        physicalCapacity: totalPhysical,
        safeCapacity: (isSingleCourse && !denseSafeBooklets) ? combinedCap : null,
        usedSafeCapacity: isSingleCourse && !denseSafeBooklets,
        unusedCapacity: Math.max(0, combinedCap - needed),
        utilization: combinedCap > 0 ? needed / combinedCap : 0,
        score: roomWastePenalty(combinedCap, needed, strategyWeights, strategy) + strategyWeights.roomCountPenalty * combined.length * 2,
      });
    }
  }

  return results;
}

function buildRoomCandidates(classrooms, examGroups, strategyWeights, strategy = 'efficient') {
  const needed = examGroups.reduce((sum, group) => sum + group.students.length, 0);
  const isSingleCourse = examGroups.length === 1;
  const multiBooklet = isSingleCourse && examHasMultipleBooklets(examGroups[0].exam);

  const eligible = [...classrooms].filter((room) => classroomMeetsRequirements(room, examGroups));

  const singleCandidates = eligible
    .map((room) => singleRoomCandidate(room, examGroups, strategyWeights, strategy, needed))
    .filter((c) => c.totalCapacity >= needed);

  if (singleCandidates.length > 0) {
    return singleCandidates
      .sort((a, b) => a.totalCapacity - b.totalCapacity || String(a.rooms[0].code).localeCompare(String(b.rooms[0].code), 'tr'))
      .slice(0, 16);
  }

  if (!isSingleCourse) return [];

  const multiCandidates = multiRoomCandidates(eligible, examGroups, strategyWeights, strategy, needed, isSingleCourse, multiBooklet);

  return multiCandidates
    .sort((a, b) => a.score - b.score || a.totalCapacity - b.totalCapacity)
    .slice(0, 8);
}

module.exports = {
  activeSeatCapacity,
  buildRoomCandidates,
  classroomMeetsRequirements,
  getEffectiveCapacity,
  parseJson,
  requiredFeaturesForExam,
  requiredRoomTypeForExam,
  roomWastePenalty,
};
