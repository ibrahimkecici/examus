const { overlaps, sameDate } = require('../../utils/time');
const { requiresFrontRow } = require('./specialNeeds');

function warning(type, message, severity = 'soft', extra = {}) {
  return { type, message, severity, ...extra };
}

function validateSeatClassroomConsistency(seatAssignments) {
  return seatAssignments
    .filter((assignment) => assignment.seat.classroomId && assignment.classroomId && assignment.seat.classroomId !== assignment.classroomId)
    .map((assignment) => warning('SEAT_CLASSROOM_MISMATCH', `${assignment.student.fullName} için seatId ile classroomId tutarsız.`, 'hard', { examId: assignment.examId }));
}

function validateFrontRow(seatAssignments) {
  return seatAssignments
    .filter((assignment) => requiresFrontRow(assignment.student) && assignment.seat.row !== 1)
    .map((assignment) => warning('SPECIAL_NEEDS_FRONT_ROW', `${assignment.student.fullName} ön sıra ihtiyacı olduğu halde ${assignment.seat.label} koltuğuna atandı.`, 'soft', { examId: assignment.examId }));
}

// Risk is same course AND same booklet adjacent. Different booklet types of the same course are acceptable.
function validateSameCourseHorizontalAdjacency(seatAssignments, severity = 'soft') {
  const warnings = [];
  for (let left = 0; left < seatAssignments.length; left += 1) {
    for (let right = left + 1; right < seatAssignments.length; right += 1) {
      const a = seatAssignments[left];
      const b = seatAssignments[right];
      if (a.courseCode !== b.courseCode) continue;
      if (a.seat.classroomId !== b.seat.classroomId) continue;
      // Different booklet types of the same course: acceptable
      if (a.bookletType && b.bookletType && a.bookletType !== b.bookletType) continue;
      if (a.seat.row === b.seat.row && Math.abs(a.seat.column - b.seat.column) === 1) {
        warnings.push(warning('SAME_COURSE_HORIZONTAL_ADJACENT', `${a.courseCode}: ${a.student.fullName} (${a.seat.label}) ile ${b.student.fullName} (${b.seat.label}) aynı kitapçıkla yan yana oturuyor.`, severity, { examId: a.exam.id }));
      }
    }
  }
  return warnings;
}

function validateSameCourseDiagonalAdjacency(seatAssignments, severity = 'soft') {
  const warnings = [];
  for (let left = 0; left < seatAssignments.length; left += 1) {
    for (let right = left + 1; right < seatAssignments.length; right += 1) {
      const a = seatAssignments[left];
      const b = seatAssignments[right];
      if (a.courseCode !== b.courseCode) continue;
      if (a.seat.classroomId !== b.seat.classroomId) continue;
      // Different booklet types: acceptable
      if (a.bookletType && b.bookletType && a.bookletType !== b.bookletType) continue;
      if (Math.abs(a.seat.row - b.seat.row) === 1 && Math.abs(a.seat.column - b.seat.column) === 1) {
        warnings.push(warning('SAME_COURSE_DIAGONAL_ADJACENT', `${a.courseCode}: ${a.student.fullName} (${a.seat.label}) ile ${b.student.fullName} (${b.seat.label}) aynı kitapçıkla çapraz bitişik oturuyor.`, severity, { examId: a.exam.id }));
      }
    }
  }
  return warnings;
}

// Column spacing is only required for single-booklet single-course exams.
// Multi-booklet exams use adjacent columns intentionally (booklet alternation prevents cheating).
function validateSingleCourseColumnSpacing(seatAssignments) {
  const warnings = [];

  const byClassroom = new Map();
  for (const a of seatAssignments) {
    const key = a.seat.classroomId || '';
    if (!byClassroom.has(key)) byClassroom.set(key, []);
    byClassroom.get(key).push(a);
  }

  for (const [, assignments] of byClassroom) {
    const courseCodes = new Set(assignments.map((a) => a.courseCode));
    if (courseCodes.size !== 1) continue;

    // Multi-booklet: adjacent columns are intentional — skip spacing check
    const bookletTypes = new Set(assignments.map((a) => a.bookletType).filter(Boolean));
    if (bookletTypes.size > 1) continue;

    const courseCode = [...courseCodes][0];
    const usedColumns = new Set(assignments.map((a) => a.seat.column));
    const sortedCols = [...usedColumns].sort((a, b) => a - b);

    for (let i = 1; i < sortedCols.length; i++) {
      if (sortedCols[i] - sortedCols[i - 1] === 1) {
        warnings.push(warning('COLUMN_SPACING_NOTICE', `${courseCode}: Tek kitapçıklı sınavda ${sortedCols[i - 1]} ve ${sortedCols[i]} nolu sütunlar birlikte kullanılmış; mümkünse alternatif sütun düzeni tercih edilir.`, 'info'));
        break;
      }
    }
  }

  return warnings;
}

function validateBooklets(seatAssignments) {
  const warnings = [];
  const allowedTypesByExam = new Map();
  for (const a of seatAssignments) {
    const key = a.exam?.id || a.examId;
    if (!key || allowedTypesByExam.has(key)) continue;
    const examTypes = Array.isArray(a.exam?.bookletTypes) && a.exam.bookletTypes.length > 0
      ? a.exam.bookletTypes
      : Array.isArray(a.exam?.course?.bookletTypes) && a.exam.course.bookletTypes.length > 0
        ? a.exam.course.bookletTypes
        : ['A'];
    allowedTypesByExam.set(key, new Set(examTypes));
  }

  // Missing booklet
  for (const a of seatAssignments) {
    if (!a.bookletType) {
      warnings.push(warning('MISSING_BOOKLET', `${a.student.fullName} için kitapçık türü atanmadı.`, 'hard', { examId: a.exam?.id || a.examId }));
      continue;
    }
    const allowedTypes = allowedTypesByExam.get(a.exam?.id || a.examId);
    if (allowedTypes && !allowedTypes.has(a.bookletType)) {
      warnings.push(warning('INVALID_BOOKLET', `${a.student.fullName} için geçersiz kitapçık türü (${a.bookletType}) atanmış.`, 'hard', { examId: a.exam?.id || a.examId, bookletType: a.bookletType }));
    }
  }

  // Same course + same booklet horizontal adjacency (the actual cheating risk)
  const bookletTypesByExam = new Map();
  for (const a of seatAssignments) {
    const key = a.exam?.id || a.examId;
    if (!key || !a.bookletType) continue;
    if (!bookletTypesByExam.has(key)) bookletTypesByExam.set(key, new Set());
    bookletTypesByExam.get(key).add(a.bookletType);
  }
  for (let left = 0; left < seatAssignments.length; left += 1) {
    for (let right = left + 1; right < seatAssignments.length; right += 1) {
      const a = seatAssignments[left];
      const b = seatAssignments[right];
      if (a.courseCode !== b.courseCode) continue;
      if (!a.bookletType || !b.bookletType || a.bookletType !== b.bookletType) continue;
      if (a.seat.classroomId !== b.seat.classroomId) continue;
      // Only meaningful when the exam actually has multiple booklet types available
      const examTypes = bookletTypesByExam.get(a.exam?.id || a.examId);
      if (!examTypes || examTypes.size < 2) continue;
      if (a.seat.row === b.seat.row && Math.abs(a.seat.column - b.seat.column) === 1) {
        warnings.push(warning('BOOKLET_ADJACENT_CONFLICT', `${a.bookletType} kitapçığı: ${a.student.fullName} (${a.seat.label}) ile ${b.student.fullName} (${b.seat.label}) yan yana oturuyor.`, 'hard', { examId: a.exam?.id || a.examId }));
      }
    }
  }

  // Booklet balance check per exam
  const byExam = new Map();
  for (const a of seatAssignments) {
    const key = a.exam?.id || a.examId;
    if (!key || !a.bookletType) continue;
    if (!byExam.has(key)) byExam.set(key, {});
    const counts = byExam.get(key);
    counts[a.bookletType] = (counts[a.bookletType] || 0) + 1;
  }
  for (const [examId, counts] of byExam) {
    const values = Object.values(counts);
    if (values.length < 2) continue;
    const max = Math.max(...values);
    const min = Math.min(...values);
    if (max - min > Math.ceil(values.reduce((s, v) => s + v, 0) / values.length * 0.3 + 1)) {
      warnings.push(warning('BOOKLET_IMBALANCE', `Sınav kitapçık dağılımı dengesiz (min ${min}, max ${max}).`, 'soft', { examId }));
    }
  }

  return warnings;
}

/**
 * Validates that every exam has exactly the right number of unique seat assignments.
 * expectedCount = number of enrolled students (from examGroups passed in planning).
 * actualAssignments come from the persisted SeatAssignment rows keyed by examId.
 */
function validateExamCoverage(exams, seatAssignments) {
  const warnings = [];

  // Count unique studentIds per exam from actual seat records
  const assignedByExam = new Map(); // examId -> Set<studentId>
  for (const a of seatAssignments) {
    const examId = a.exam?.id || a.examId;
    if (!examId || !a.student?.id) continue;
    if (!assignedByExam.has(examId)) assignedByExam.set(examId, new Set());
    assignedByExam.get(examId).add(a.student.id);
  }

  // Total seat records per exam (to detect duplicates)
  const recordsByExam = new Map(); // examId -> studentId[]
  for (const a of seatAssignments) {
    const examId = a.exam?.id || a.examId;
    if (!examId || !a.student?.id) continue;
    if (!recordsByExam.has(examId)) recordsByExam.set(examId, []);
    recordsByExam.get(examId).push(a.student.id);
  }

  for (const exam of exams) {
    const enrolled = exam.course?.enrollments?.length ?? 0;
    if (enrolled === 0) continue; // no enrollment data — skip

    const uniqueAssigned = assignedByExam.get(exam.id)?.size ?? 0;
    const totalRecords = recordsByExam.get(exam.id)?.length ?? 0;
    const courseCode = exam.course?.code || exam.id;

    if (uniqueAssigned < enrolled) {
      warnings.push(warning(
        'EXAM_STUDENT_UNDER_ASSIGNED',
        `${courseCode}: ${uniqueAssigned}/${enrolled} öğrenci oturuma atandı. ${enrolled - uniqueAssigned} öğrenci atamasız kaldı.`,
        'hard',
        { examId: exam.id, assignedCount: uniqueAssigned, expectedCount: enrolled, missingCount: enrolled - uniqueAssigned },
      ));
    } else if (uniqueAssigned > enrolled) {
      warnings.push(warning(
        'EXAM_STUDENT_OVER_ASSIGNED',
        `${courseCode}: ${uniqueAssigned} öğrenci atandı ancak kayıtlı öğrenci sayısı ${enrolled}. Fazla atama var.`,
        'hard',
        { examId: exam.id, assignedCount: uniqueAssigned, expectedCount: enrolled, extraCount: uniqueAssigned - enrolled },
      ));
    }

    const duplicateCount = totalRecords - uniqueAssigned;
    if (duplicateCount > 0) {
      warnings.push(warning(
        'DUPLICATE_STUDENT_ASSIGNMENT',
        `${courseCode}: ${duplicateCount} öğrenci aynı sınav için birden fazla koltuğa atanmış.`,
        'hard',
        { examId: exam.id, duplicateCount },
      ));
    }
  }

  return warnings;
}

function validatePlacementConflicts(placements) {
  const warnings = [];
  for (let left = 0; left < placements.length; left += 1) {
    for (let right = left + 1; right < placements.length; right += 1) {
      const a = placements[left];
      const b = placements[right];
      const sameSlot = sameDate(a.date, b.date) && overlaps(a.startTime, a.endTime, b.startTime, b.endTime);
      if (!sameSlot) continue;
      if (a.roomIds.some((roomId) => b.roomIds.includes(roomId))) warnings.push(warning('ROOM_CONFLICT', 'Aynı derslik aynı zaman aralığında birden fazla slotta kullanılmış.', 'hard'));
      if (a.studentIds.some((studentId) => b.studentIds.includes(studentId))) warnings.push(warning('STUDENT_CONFLICT', 'Ortak öğrencisi olan sınavlar aynı zaman aralığına konmuş.', 'hard'));
      if (a.invigilatorIds.some((id) => b.invigilatorIds.includes(id))) warnings.push(warning('INVIGILATOR_CONFLICT', 'Aynı gözetmen aynı zaman aralığında iki görevde görünüyor.', 'hard'));
    }
  }
  return warnings;
}

module.exports = {
  validateFrontRow,
  validatePlacementConflicts,
  validateSameCourseHorizontalAdjacency,
  validateSameCourseDiagonalAdjacency,
  validateSingleCourseColumnSpacing,
  validateSeatClassroomConsistency,
  validateBooklets,
  validateExamCoverage,
  warning,
};
