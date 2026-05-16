const { requiresFrontRow, sortStudentsForSeating, specialNeedNote } = require('./specialNeeds');
const {
  SeatingStrategy,
  seatsGroupedByColumn,
  sortedColumns,
  bestAlternatingColumns,
  seatsInColumns,
  assignColumnsForInterleaving,
  determineStrategy,
} = require('./seatingStrategy');

function activeSeatsForRoom(room) {
  return (room.seats || [])
    .filter((seat) => seat.status === 'AKTIF')
    .map((seat) => ({ ...seat, classroomId: room.id }))
    .sort((a, b) => a.row - b.row || a.column - b.column || String(a.label).localeCompare(String(b.label), 'tr'));
}

function popNextStudent(queues, lastCourseCode) {
  const ordered = [...queues.entries()]
    .filter(([, queue]) => queue.length > 0)
    .sort((a, b) => {
      if (a[0] === lastCourseCode && b[0] !== lastCourseCode) return 1;
      if (b[0] === lastCourseCode && a[0] !== lastCourseCode) return -1;
      return b[1].length - a[1].length || a[0].localeCompare(b[0], 'tr');
    });
  if (!ordered.length) return null;
  const [courseCode, queue] = ordered[0];
  return { courseCode, student: queue.shift() };
}

// Risk = same course AND same booklet adjacent. Different booklet or different course is acceptable.
function countSeatRisks(assignments) {
  let sameCourseAdjacentSeatCount = 0;
  let sameCourseSameBookletFrontBackAvoidableCount = 0;
  let sameCourseSameBookletFrontBackUnavoidableCount = 0;

  // Per classroom+course: which booklet types were used (to distinguish multi-booklet vs single-booklet rooms)
  const bookletTypesByCourseClassroom = new Map();
  for (const a of assignments) {
    const key = `${a.courseCode}:${a.seat.classroomId}`;
    if (!bookletTypesByCourseClassroom.has(key)) bookletTypesByCourseClassroom.set(key, new Set());
    if (a.bookletType) bookletTypesByCourseClassroom.get(key).add(a.bookletType);
  }

  for (let left = 0; left < assignments.length; left += 1) {
    for (let right = left + 1; right < assignments.length; right += 1) {
      const a = assignments[left];
      const b = assignments[right];
      if (a.courseCode !== b.courseCode) continue;
      if (a.seat.classroomId !== b.seat.classroomId) continue;
      if (a.bookletType && b.bookletType && a.bookletType !== b.bookletType) continue;
      if (a.seat.row === b.seat.row && Math.abs(a.seat.column - b.seat.column) === 1) sameCourseAdjacentSeatCount += 1;
      if (a.seat.column === b.seat.column && Math.abs(a.seat.row - b.seat.row) === 1) {
        const key = `${a.courseCode}:${a.seat.classroomId}`;
        const usedBookletTypes = bookletTypesByCourseClassroom.get(key);
        if (usedBookletTypes && usedBookletTypes.size > 1) {
          sameCourseSameBookletFrontBackAvoidableCount += 1;
        } else {
          sameCourseSameBookletFrontBackUnavoidableCount += 1;
        }
      }
    }
  }
  return { sameCourseAdjacentSeatCount, sameCourseSameBookletFrontBackAvoidableCount, sameCourseSameBookletFrontBackUnavoidableCount };
}

function getBookletTypes(exam) {
  if (Array.isArray(exam.bookletTypes) && exam.bookletTypes.length > 0) return exam.bookletTypes;
  if (Array.isArray(exam.course?.bookletTypes) && exam.course.bookletTypes.length > 0) return exam.course.bookletTypes;
  return ['A'];
}

function examHasMultipleBooklets(exam) {
  return getBookletTypes(exam).length > 1;
}

function examHasDenseSafeBooklets(exam) {
  return getBookletTypes(exam).length >= 3;
}

function buildAssignmentIndex(assignments) {
  // key: "row:col" -> assignment
  const byPos = new Map();
  for (const a of assignments) {
    byPos.set(`${a.seat.row}:${a.seat.column}`, a);
  }
  return byPos;
}

function assignBookletsGreedy(assignments, bookletTypes) {
  if (bookletTypes.length <= 1) {
    return assignments.map((a) => ({ ...a, bookletType: bookletTypes[0] || 'A' }));
  }

  const byPos = buildAssignmentIndex(assignments);
  const bookletMap = new Map(); // seatId -> bookletType
  const counts = Object.fromEntries(bookletTypes.map((t) => [t, 0]));

  // Process left-to-right, top-to-bottom so left/top neighbours are always already assigned
  const sorted = [...assignments].sort((a, b) => a.seat.row - b.seat.row || a.seat.column - b.seat.column);

  const HARD_NEIGHBOUR_OFFSETS = [
    [0, -1],
    [-1, 0],
    [-1, -1],
    [-1, 1],
  ];

  for (const assignment of sorted) {
    const { row, column } = assignment.seat;
    const forbiddenByNeighbors = new Set();

    for (const [dr, dc] of HARD_NEIGHBOUR_OFFSETS) {
      const neighbour = byPos.get(`${row + dr}:${column + dc}`);
      if (neighbour && bookletMap.has(neighbour.seat.id)) {
        forbiddenByNeighbors.add(bookletMap.get(neighbour.seat.id));
      }
    }

    const minCount = Math.min(...Object.values(counts));
    const maxAllowedCount = minCount + 1;

    const ranked = bookletTypes
      .filter((type) => !forbiddenByNeighbors.has(type))
      .map((type) => ({
        type,
        score: (counts[type] > maxAllowedCount ? 5 : 0) + counts[type],
      }))
      .sort((a, b) => a.score - b.score || bookletTypes.indexOf(a.type) - bookletTypes.indexOf(b.type));

    const chosen = ranked.length > 0
      ? ranked[0].type
      : bookletTypes.reduce((best, type) => (counts[type] < counts[best] ? type : best), bookletTypes[0]);

    bookletMap.set(assignment.seat.id, chosen);
    counts[chosen] += 1;
  }

  return assignments.map((a) => ({ ...a, bookletType: bookletMap.get(a.seat.id) }));
}

function groupAssignmentsByExamCourse(assignments) {
  const groups = new Map();
  for (const assignment of assignments) {
    const key = `${assignment.exam?.id || assignment.examId || ''}:${assignment.exam?.courseId || assignment.exam?.course?.id || ''}:${assignment.courseCode}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(assignment);
  }
  return [...groups.values()];
}

function blockBooklets(courseAssignments, bookletTypes, offset = 0) {
  if (bookletTypes.length <= 1) {
    return courseAssignments.map((assignment) => ({ ...assignment, bookletType: bookletTypes[0] || 'A' }));
  }

  return courseAssignments.map((assignment) => {
    const rowParity = Math.abs(assignment.seat.row - 1) % 2;
    const colParity = Math.abs(assignment.seat.column - 1) % 2;
    const blockIndex = rowParity * 2 + colParity;
    return { ...assignment, bookletType: bookletTypes[(blockIndex + offset) % bookletTypes.length] };
  });
}

function countSameBookletDiagonalConflicts(assignments) {
  let count = 0;
  for (let left = 0; left < assignments.length; left += 1) {
    for (let right = left + 1; right < assignments.length; right += 1) {
      const a = assignments[left];
      const b = assignments[right];
      if (a.courseCode !== b.courseCode) continue;
      if (a.seat.classroomId !== b.seat.classroomId) continue;
      if (!a.bookletType || !b.bookletType || a.bookletType !== b.bookletType) continue;
      if (Math.abs(a.seat.row - b.seat.row) === 1 && Math.abs(a.seat.column - b.seat.column) === 1) count += 1;
    }
  }
  return count;
}

function optimizationScore(assignments) {
  const risks = countSeatRisks(assignments);
  return {
    ...risks,
    sameCourseSameBookletDiagonalCount: countSameBookletDiagonalConflicts(assignments),
  };
}

function hasHardBookletConflict(assignments) {
  const score = optimizationScore(assignments);
  return score.sameCourseAdjacentSeatCount > 0 || score.sameCourseSameBookletDiagonalCount > 0;
}

function isBetterBookletAssignment(candidateScore, bestScore) {
  if (candidateScore.sameCourseSameBookletFrontBackAvoidableCount !== bestScore.sameCourseSameBookletFrontBackAvoidableCount) {
    return candidateScore.sameCourseSameBookletFrontBackAvoidableCount < bestScore.sameCourseSameBookletFrontBackAvoidableCount;
  }
  if (candidateScore.sameCourseAdjacentSeatCount !== bestScore.sameCourseAdjacentSeatCount) {
    return candidateScore.sameCourseAdjacentSeatCount < bestScore.sameCourseAdjacentSeatCount;
  }
  if (candidateScore.sameCourseSameBookletDiagonalCount !== bestScore.sameCourseSameBookletDiagonalCount) {
    return candidateScore.sameCourseSameBookletDiagonalCount < bestScore.sameCourseSameBookletDiagonalCount;
  }
  return candidateScore.sameCourseSameBookletFrontBackUnavoidableCount < bestScore.sameCourseSameBookletFrontBackUnavoidableCount;
}

function optimizeBookletsAfterSeating(assignments) {
  let bestAssignments = assignments;
  let bestScore = optimizationScore(assignments);

  const groups = groupAssignmentsByExamCourse(assignments);
  for (const courseAssignments of groups) {
    const bookletTypes = getBookletTypes(courseAssignments[0].exam);
    if (bookletTypes.length <= 1) continue;

    const candidateCourseAssignments = [];
    if (bookletTypes.length >= 4) {
      for (let offset = 0; offset < bookletTypes.length; offset += 1) {
        candidateCourseAssignments.push(blockBooklets(courseAssignments, bookletTypes, offset));
      }
    } else if (bookletTypes.length === 3) {
      candidateCourseAssignments.push(assignBookletsGreedy(courseAssignments, bookletTypes));
      candidateCourseAssignments.push(...bookletTypes.map((_, offset) => blockBooklets(courseAssignments, bookletTypes, offset)));
    } else {
      candidateCourseAssignments.push(assignBookletsGreedy(courseAssignments, bookletTypes));
    }

    for (const candidateCourse of candidateCourseAssignments) {
      const replacementBySeatId = new Map(candidateCourse.map((assignment) => [assignment.seat.id, assignment]));
      const candidate = bestAssignments.map((assignment) => replacementBySeatId.get(assignment.seat.id) || assignment);
      const candidateScore = optimizationScore(candidate);

      if (candidateScore.sameCourseSameBookletDiagonalCount > bestScore.sameCourseSameBookletDiagonalCount) continue;
      if (candidateScore.sameCourseAdjacentSeatCount > bestScore.sameCourseAdjacentSeatCount) continue;

      if (isBetterBookletAssignment(candidateScore, bestScore)) {
        bestAssignments = candidate;
        bestScore = candidateScore;
      }
    }
  }

  return {
    assignments: bestAssignments,
    improved: bestAssignments !== assignments,
    ...countSeatRisks(bestAssignments),
  };
}

function bestDiagonalSafeAlternatingSeats(seats) {
  const rowMap = new Map();
  for (const seat of seats) {
    if (!rowMap.has(seat.row)) rowMap.set(seat.row, []);
    rowMap.get(seat.row).push(seat);
  }
  const rows = [...rowMap.keys()].sort((a, b) => a - b);
  const evenRows = rows.filter((_, index) => index % 2 === 0);
  const oddRows = rows.filter((_, index) => index % 2 === 1);
  const rowCount = (selectedRows) => selectedRows.reduce((sum, row) => sum + (rowMap.get(row) || []).length, 0);
  const bestRows = rowCount(evenRows) >= rowCount(oddRows) ? evenRows : oddRows;
  const rowSeats = new Set(bestRows);
  const bestRowSeats = seats.filter((seat) => rowSeats.has(seat.row)).sort((a, b) => a.seat?.row - b.seat?.row || a.row - b.row || a.column - b.column);

  const columnMap = seatsGroupedByColumn(seats);
  const bestCols = bestAlternatingColumns(columnMap);
  const bestColumnSeats = seatsInColumns(columnMap, bestCols).sort((a, b) => a.row - b.row || a.column - b.column);

  return bestRowSeats.length >= bestColumnSeats.length ? bestRowSeats : bestColumnSeats;
}

function diagonalSafeCapacity(seats) {
  return bestDiagonalSafeAlternatingSeats(seats).length;
}

function allocateAlternatingColumns(room, examGroups) {
  const seats = activeSeatsForRoom(room);
  const group = examGroups[0];
  const bookletTypes = getBookletTypes(group.exam);
  const multiBooklet = bookletTypes.length > 1;

  let usableSeats;
  let strategy;

  if (bookletTypes.length === 2) {
    usableSeats = bestDiagonalSafeAlternatingSeats(seats);
    strategy = SeatingStrategy.SINGLE_COURSE_ALTERNATING_COLUMNS;
  } else if (multiBooklet) {
    // Three or more booklet types can use dense seats; booklets are validated after assignment.
    usableSeats = [...seats];
    strategy = SeatingStrategy.SINGLE_COURSE_ALTERNATING_COLUMNS;
  } else {
    // Single booklet: must use alternating columns to prevent adjacent same-booklet seating
    const columnMap = seatsGroupedByColumn(seats);
    const usableCols = bestAlternatingColumns(columnMap);
    usableSeats = seatsInColumns(columnMap, usableCols).sort((a, b) => a.row - b.row || a.column - b.column);
    strategy = SeatingStrategy.SINGLE_COURSE_ALTERNATING_COLUMNS;
  }

  const studentQueue = sortStudentsForSeating(group.students).map((student) => ({
    student,
    exam: group.exam,
    courseCode: group.course.code,
  }));

  const assignments = [];
  const usedCount = Math.min(studentQueue.length, usableSeats.length);
  for (let i = 0; i < usedCount; i++) {
    assignments.push({ ...studentQueue[i], seat: usableSeats[i], note: specialNeedNote(studentQueue[i].student) });
  }

  const missingCount = Math.max(0, studentQueue.length - assignments.length);
  const strategyWarnings = [];

  if (missingCount > 0) {
    const capLabel = multiBooklet ? `${usableSeats.length} çapraz güvenli koltuk` : `${usableSeats.length} emniyetli koltuk`;
    strategyWarnings.push(
      `Sınav ${group.course.code} için ${room.code} dersliğinde kapasite yetersiz (${capLabel}, ${studentQueue.length} öğrenci). ${missingCount} öğrenci açıkta kaldı.`,
    );
  }

  const withBooklets = assignBookletsGreedy(assignments, bookletTypes);
  const optimized = optimizeBookletsAfterSeating(withBooklets);
  const finalAssignments = hasHardBookletConflict(optimized.assignments) && !hasHardBookletConflict(withBooklets)
    ? withBooklets
    : optimized.assignments;
  const finalRisks = countSeatRisks(finalAssignments);
  return {
    assignments: finalAssignments,
    missingCount,
    strategy,
    strategyWarnings,
    sameCourseAdjacentSeatCount: finalRisks.sameCourseAdjacentSeatCount,
    sameCourseSameBookletFrontBackAvoidableCount: finalRisks.sameCourseSameBookletFrontBackAvoidableCount,
    sameCourseSameBookletFrontBackUnavoidableCount: finalRisks.sameCourseSameBookletFrontBackUnavoidableCount,
  };
}

function allocateInterleavedColumns(room, examGroups) {
  const seats = activeSeatsForRoom(room);
  const columnMap = seatsGroupedByColumn(seats);
  // Largest group first so round-robin gives it the extra column(s) when totalCols % N !== 0
  const sortedGroups = [...examGroups].sort((a, b) => b.students.length - a.students.length);
  const courseColumnAssignments = assignColumnsForInterleaving(columnMap, sortedGroups.length);

  const assignments = [];
  const strategyWarnings = [];
  let missingCount = 0;

  for (let i = 0; i < sortedGroups.length; i++) {
    const group = sortedGroups[i];
    const assignedCols = courseColumnAssignments[i];
    const courseSeats = seatsInColumns(columnMap, assignedCols).sort((a, b) => a.row - b.row || a.column - b.column);

    const studentQueue = sortStudentsForSeating(group.students).map((student) => ({
      student,
      exam: group.exam,
      courseCode: group.course.code,
    }));

    const bookletTypes = getBookletTypes(group.exam);
    const usedCount = Math.min(studentQueue.length, courseSeats.length);
    const courseAssignments = [];
    for (let j = 0; j < usedCount; j++) {
      courseAssignments.push({ ...studentQueue[j], seat: courseSeats[j], note: specialNeedNote(studentQueue[j].student) });
    }
    const withBooklets = assignBookletsGreedy(courseAssignments, bookletTypes);
    assignments.push(...withBooklets);

    const overflow = studentQueue.length - usedCount;
    if (overflow > 0) {
      missingCount += overflow;
      strategyWarnings.push(`${group.course.code} için atanmış sütun kapasitesi yetersiz (${overflow} öğrenci sığmadı). Daha büyük bir derslik seçin veya karma yerleşimi devre dışı bırakın.`);
    }
  }

  const optimized = optimizeBookletsAfterSeating(assignments);
  const finalAssignments = hasHardBookletConflict(optimized.assignments) && !hasHardBookletConflict(assignments)
    ? assignments
    : optimized.assignments;
  const finalRisks = countSeatRisks(finalAssignments);

  return {
    assignments: finalAssignments,
    missingCount,
    strategy: missingCount > 0 ? SeatingStrategy.FALLBACK_COMPACT_WITH_WARNINGS : SeatingStrategy.MULTI_COURSE_INTERLEAVED_COLUMNS,
    strategyWarnings,
    sameCourseAdjacentSeatCount: finalRisks.sameCourseAdjacentSeatCount,
    sameCourseSameBookletFrontBackAvoidableCount: finalRisks.sameCourseSameBookletFrontBackAvoidableCount,
    sameCourseSameBookletFrontBackUnavoidableCount: finalRisks.sameCourseSameBookletFrontBackUnavoidableCount,
  };
}

function allocateSeatsForRoom(room, examGroups) {
  if (examGroups.length === 1) return allocateAlternatingColumns(room, examGroups);
  return allocateInterleavedColumns(room, examGroups);
}

module.exports = {
  activeSeatsForRoom,
  allocateSeatsForRoom,
  allocateAlternatingColumns,
  allocateInterleavedColumns,
  countSeatRisks,
  getBookletTypes,
  examHasMultipleBooklets,
  examHasDenseSafeBooklets,
  diagonalSafeCapacity,
  optimizeBookletsAfterSeating,
  countSameBookletDiagonalConflicts,
};
