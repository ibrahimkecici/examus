const test = require('node:test');
const assert = require('node:assert/strict');
const XLSX = require('xlsx');
const { availabilityResult } = require('../src/services/planning/availabilityChecker');
const { buildCourseConflictMatrix, getCourseConflict } = require('../src/services/planning/courseConflictMatrixBuilder');
const { DEFAULT_PLANNING_CONFIG, strategyWeights } = require('../src/services/planning/config');
const { scoreInvigilator, selectInvigilators } = require('../src/services/planning/invigilatorAllocator');
const { buildPlanningGroups, canMergeGroups, makeSingleGroup } = require('../src/services/planning/mixedRoomPlanner');
const { buildScenarioMetrics } = require('../src/services/planning/metricsBuilder');
const { buildRoomCandidates } = require('../src/services/planning/roomAllocator');
const { evaluateCandidate } = require('../src/services/planning/scorer');
const { allocateSeatsForRoom } = require('../src/services/planning/seatAllocator');

function readRows(path) {
  const workbook = XLSX.readFile(path);
  return XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: '' });
}

function classroom(row) {
  return {
    id: row.code,
    code: row.code,
    name: row.name,
    building: row.building,
    capacity: row.capacity,
    seats: Array.from({ length: row.capacity }, (_, index) => ({
      id: `${row.code}-${index + 1}`,
      classroomId: row.code,
      label: `${Math.floor(index / 4) + 1}-${(index % 4) + 1}`,
      row: Math.floor(index / 4) + 1,
      column: (index % 4) + 1,
      status: 'AKTIF',
      capacity: 1,
    })),
  };
}

function exam(id, code, students, durationMinutes = 90, specialRules = {}) {
  return {
    id,
    durationMinutes,
    specialRules,
    course: {
      id: `C-${id}`,
      code,
      name: code,
      department: 'Bilgisayar Mühendisliği',
      specialRules,
      enrollments: students.map((student) => ({ student })),
    },
  };
}

function examGroup(examItem) {
  const students = examItem.course.enrollments.map((enrollment) => enrollment.student);
  return { exam: examItem, course: examItem.course, students };
}

test('small dataset chooses smallest sufficient rooms instead of C103', () => {
  const courses = readRows('test_verileri/ders_listesi_kucuk.xlsx');
  const rooms = readRows('test_verileri/derslik_listesi_kucuk.xlsx').map(classroom);
  const weights = strategyWeights('efficient');

  for (const course of courses) {
    const students = Array.from({ length: course.studentCount }, (_, index) => ({ id: `${course.code}-${index}` }));
    const candidate = buildRoomCandidates(rooms, [{ exam: { course: { code: course.code } }, course, students }], weights, 'efficient')[0];
    assert.ok(candidate.totalCapacity >= course.studentCount);
    assert.notEqual(candidate.rooms[0].code, 'C103');
    assert.ok(candidate.totalCapacity <= 10, `${course.code} should use an 8 or 10 seat room`);
  }
});

test('room allocator rejects insufficient capacity and uses examCapacity', () => {
  const weights = strategyWeights('efficient');
  assert.equal(buildRoomCandidates([{ id: 'R1', code: 'R1', capacity: 4, seats: [] }], [{ exam: {}, course: {}, students: Array.from({ length: 5 }, (_, id) => ({ id })) }], weights).length, 0);
  const candidate = buildRoomCandidates([{ id: 'R2', code: 'R2', capacity: 30, examCapacity: 8, seats: [] }], [{ exam: {}, course: {}, students: Array.from({ length: 8 }, (_, id) => ({ id })) }], weights)[0];
  assert.equal(candidate.totalCapacity, 8);
});

test('availability honors MUSAIT, unavailable records, and strict default', () => {
  const date = new Date('2026-12-01T00:00:00.000Z');
  assert.equal(availabilityResult({ availability: [{ date, startTime: '09:00', endTime: '12:00', status: 'MUSAIT' }] }, date, '10:00', '11:00').valid, true);
  assert.equal(availabilityResult({ availability: [{ date, startTime: '09:00', endTime: '12:00', status: 'MUSAIT_DEGIL' }] }, date, '10:00', '11:00').valid, false);
  assert.equal(availabilityResult({ availability: [] }, date, '10:00', '11:00', { ...DEFAULT_PLANNING_CONFIG, strictAvailability: false }).valid, true);
  assert.equal(availabilityResult({ availability: [] }, date, '10:00', '11:00', { ...DEFAULT_PLANNING_CONFIG, strictAvailability: true }).valid, false);
});

test('course conflict matrix counts shared students', () => {
  const s1 = { id: 'S1' };
  const s2 = { id: 'S2' };
  const left = exam('E1', 'MAT101', [s1, s2]);
  const right = exam('E2', 'FIZ102', [s1]);
  const matrix = buildCourseConflictMatrix([left, right]);
  assert.equal(getCourseConflict(matrix, 'E1', 'E2').sharedStudentCount, 1);
  assert.equal(getCourseConflict(matrix, 'E1', 'E2').sharedStudentRatio, 1);
});

test('invigilator scoring distributes load and honors max assignments and maxPerDay', () => {
  const schedule = { date: new Date('2026-12-01T00:00:00.000Z'), startTime: '09:00', endTime: '10:30' };
  const groups = [{ course: { department: 'Bilgisayar Mühendisliği' } }];
  const invigilators = [
    { id: 'I1', firstName: 'Selin', lastName: 'Aydın', department: 'Bilgisayar Mühendisliği', maxAssignments: 4, availability: [] },
    { id: 'I2', firstName: 'Ahmet', lastName: 'Yılmaz', department: 'Bilgisayar Mühendisliği', maxAssignments: 4, availability: [] },
  ];
  const load = new Map([['I1', [{ date: schedule.date, startTime: '12:00', endTime: '13:30' }]]]);
  const weights = strategyWeights('fair_invigilator');

  assert.ok(scoreInvigilator(invigilators[0], groups, schedule, load, weights).score > scoreInvigilator(invigilators[1], groups, schedule, load, weights).score);
  assert.equal(scoreInvigilator({ ...invigilators[0], maxAssignments: 1 }, groups, schedule, load, weights).valid, false);
  assert.equal(scoreInvigilator({ ...invigilators[0], constraints: { maxPerDay: 1 } }, groups, schedule, load, weights).valid, false);
});

test('small dataset invigilator selection does not assign every exam to one person', () => {
  const rawInvigilators = readRows('test_verileri/gozetmen_listesi_kucuk.xlsx');
  const invigilators = rawInvigilators.map((row) => ({ ...row, id: row.staffNo, maxAssignments: 4, priority: 0, availability: [] }));
  const courses = readRows('test_verileri/ders_listesi_kucuk.xlsx');
  const load = new Map();
  const assigned = [];
  const weights = strategyWeights('fair_invigilator');

  courses.forEach((course, index) => {
    const schedule = {
      date: new Date('2026-12-01T00:00:00.000Z'),
      startTime: `${String(9 + index * 2).padStart(2, '0')}:00`,
      endTime: `${String(10 + index * 2).padStart(2, '0')}:30`,
    };
    const selected = selectInvigilators(invigilators, [{ course }], schedule, load, 1, weights);
    assert.equal(selected.valid, true);
    const invigilator = selected.invigilators[0];
    assigned.push(invigilator.id);
    load.set(invigilator.id, [...(load.get(invigilator.id) || []), schedule]);
  });

  assert.ok(new Set(assigned).size > 1);
});

test('front-row special need students are seated in front row', () => {
  const room = classroom({ code: 'R1', name: 'Room', capacity: 2 });
  const item = exam('E1', 'MAT101', [
    { id: 'S1', studentNo: '1', fullName: 'Normal Öğrenci', specialNeeds: '' },
    { id: 'S2', studentNo: '2', fullName: 'Ön Sıra Öğrenci', specialNeeds: 'Ön sıra' },
  ]);
  const result = allocateSeatsForRoom(room, [examGroup(item)]);
  assert.equal(result.assignments.find((assignment) => assignment.student.id === 'S2').seat.row, 1);
});

test('mixed room planner merges only compatible exams', () => {
  const s1 = { id: 'S1' };
  const s2 = { id: 'S2' };
  const s3 = { id: 'S3' };
  const e1 = exam('E1', 'FIZ102', [s1], 90);
  const e2 = exam('E2', 'ING101', [s2, s3], 90);
  const e3 = exam('E3', 'MAT101', [s1], 90);
  const matrix = buildCourseConflictMatrix([e1, e2, e3]);
  assert.equal(canMergeGroups(makeSingleGroup(e1), makeSingleGroup(e2), matrix, DEFAULT_PLANNING_CONFIG), true);
  assert.equal(canMergeGroups(makeSingleGroup(e1), makeSingleGroup(e3), matrix, DEFAULT_PLANNING_CONFIG), false);
  assert.equal(canMergeGroups(makeSingleGroup(e1), makeSingleGroup(exam('E4', 'LAB101', [s3], 120)), matrix, DEFAULT_PLANNING_CONFIG), false);
  assert.equal(canMergeGroups(makeSingleGroup(e1), makeSingleGroup(exam('E5', 'DED101', [s3], 90, { requiresDedicatedRoom: true })), matrix, DEFAULT_PLANNING_CONFIG), false);
});

test('mixed room seating avoids adjacent same-course seats when possible', () => {
  const room = classroom({ code: 'LAB-Z04', name: 'Lab', capacity: 8 });
  const e1 = exam('E1', 'FIZ102', [{ id: 'A1', studentNo: '1', fullName: 'A1' }, { id: 'A2', studentNo: '2', fullName: 'A2' }]);
  const e2 = exam('E2', 'ING101', [{ id: 'B1', studentNo: '3', fullName: 'B1' }, { id: 'B2', studentNo: '4', fullName: 'B2' }]);
  const result = allocateSeatsForRoom(room, [examGroup(e1), examGroup(e2)]);
  assert.equal(result.sameCourseAdjacentSeatCount, 0);
});

test('candidate scorer invalidates room conflict', () => {
  const item = exam('E2', 'BIL201', [{ id: 'S2' }]);
  const schedule = { date: new Date('2026-12-01T00:00:00.000Z'), startTime: '09:30', endTime: '10:30' };
  const invigilators = [{ id: 'I1', firstName: 'A', lastName: 'B', maxAssignments: 4, availability: [] }];
  const candidate = evaluateCandidate({
    exam: item,
    students: [{ id: 'S2' }],
    schedule,
    roomCandidate: { rooms: [{ id: 'R1', code: 'R1', capacity: 10 }], score: 0 },
    invigilators,
    placements: [{ date: schedule.date, startTime: '09:00', endTime: '10:00', studentIds: ['S3'], roomIds: ['R1'] }],
    placed: [{ date: schedule.date, startTime: '09:00', endTime: '10:00', studentIds: ['S3'], roomIds: ['R1'] }],
    invigilatorLoad: new Map(),
    requiredInvigilators: 1,
    dates: [schedule.date],
    strategy: 'balanced',
  });
  assert.equal(candidate.valid, false);
  assert.equal(candidate.reason, 'ROOM_CONFLICT');
});

test('single-course alternating column seating avoids adjacent same-course students', () => {
  const room = classroom({ code: 'R1', name: 'Room', capacity: 12 });
  const students = Array.from({ length: 6 }, (_, index) => ({ id: `S${index + 1}`, studentNo: String(index + 1), fullName: `Öğrenci ${index + 1}` }));
  const item = exam('E1', 'MAT101', students);
  const result = allocateSeatsForRoom(room, [examGroup(item)]);
  assert.equal(result.missingCount, 0);
  assert.equal(result.sameCourseAdjacentSeatCount, 0);
  assert.equal(result.strategy, 'SINGLE_COURSE_ALTERNATING_COLUMNS');
});

test('single-course alternating columns leaves students unplaced when safe capacity insufficient', () => {
  const room = classroom({ code: 'R1', name: 'Room', capacity: 4 });
  const students = Array.from({ length: 4 }, (_, index) => ({ id: `S${index + 1}`, studentNo: String(index + 1), fullName: `Öğrenci ${index + 1}` }));
  const item = exam('E1', 'MAT101', students);
  const result = allocateSeatsForRoom(room, [examGroup(item)]);
  assert.equal(result.missingCount, 2);
  assert.equal(result.strategy, 'SINGLE_COURSE_ALTERNATING_COLUMNS');
  assert.equal(result.assignments.length, 2);
  assert.equal(result.sameCourseAdjacentSeatCount, 0);
  assert.ok(result.strategyWarnings.length > 0);
});

test('multi-course interleaved columns assigns different courses to alternating columns', () => {
  const room = classroom({ code: 'R1', name: 'Room', capacity: 12 });
  const e1 = exam('E1', 'MAT101', [
    { id: 'A1', studentNo: '1', fullName: 'A1' },
    { id: 'A2', studentNo: '2', fullName: 'A2' },
    { id: 'A3', studentNo: '3', fullName: 'A3' },
  ]);
  const e2 = exam('E2', 'FIZ102', [
    { id: 'B1', studentNo: '4', fullName: 'B1' },
    { id: 'B2', studentNo: '5', fullName: 'B2' },
    { id: 'B3', studentNo: '6', fullName: 'B3' },
  ]);
  const result = allocateSeatsForRoom(room, [examGroup(e1), examGroup(e2)]);
  assert.equal(result.sameCourseAdjacentSeatCount, 0);
  assert.equal(result.strategy, 'MULTI_COURSE_INTERLEAVED_COLUMNS');
});

test('safe column capacity picks best alternating pattern', () => {
  const { safeColumnCapacity, bestAlternatingColumns, seatsGroupedByColumn } = require('../src/services/planning/seatingStrategy');
  const { activeSeatsForRoom } = require('../src/services/planning/seatAllocator');

  const room = classroom({ code: 'R1', name: 'Room', capacity: 8 });
  const safeCap = safeColumnCapacity(activeSeatsForRoom(room));
  assert.equal(safeCap, 4);

  const uneven = [
    { id: 'S1', classroomId: 'R2', label: '1-1', row: 1, column: 1, status: 'AKTIF', capacity: 1 },
    { id: 'S2', classroomId: 'R2', label: '1-2', row: 1, column: 2, status: 'AKTIF', capacity: 1 },
    { id: 'S3', classroomId: 'R2', label: '1-3', row: 1, column: 3, status: 'AKTIF', capacity: 1 },
    { id: 'S4', classroomId: 'R2', label: '2-1', row: 2, column: 1, status: 'AKTIF', capacity: 1 },
    { id: 'S5', classroomId: 'R2', label: '2-3', row: 2, column: 3, status: 'AKTIF', capacity: 1 },
  ];
  const colMap = seatsGroupedByColumn(uneven);
  const best = bestAlternatingColumns(colMap);
  assert.equal(best.length, 2);
  assert.ok(best.includes(1));
  assert.ok(best.includes(3));
  const unevenCap = safeColumnCapacity(uneven);
  assert.equal(unevenCap, 4);
});

test('validate same-course horizontal adjacency is detected', () => {
  const { validateSameCourseHorizontalAdjacency } = require('../src/services/planning/validationService');
  const assignments = [
    { courseCode: 'MAT101', student: { fullName: 'Ali' }, seat: { row: 1, column: 1, label: '1-1' }, exam: { id: 'E1' } },
    { courseCode: 'MAT101', student: { fullName: 'Veli' }, seat: { row: 1, column: 2, label: '1-2' }, exam: { id: 'E1' } },
  ];
  const warnings = validateSameCourseHorizontalAdjacency(assignments);
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].type, 'SAME_COURSE_HORIZONTAL_ADJACENT');
});

test('validate same-course diagonal adjacency from neighboring columns is detected', () => {
  const { validateSameCourseDiagonalAdjacency } = require('../src/services/planning/validationService');
  const assignments = [
    { courseCode: 'MAT101', student: { fullName: 'Ali' }, seat: { row: 1, column: 1, label: '1-1' }, exam: { id: 'E1' } },
    { courseCode: 'MAT101', student: { fullName: 'Veli' }, seat: { row: 2, column: 2, label: '2-2' }, exam: { id: 'E1' } },
  ];
  const warnings = validateSameCourseDiagonalAdjacency(assignments);
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].type, 'SAME_COURSE_DIAGONAL_ADJACENT');
});

test('column spacing validator detects adjacent column violation in single-course', () => {
  const { validateSingleCourseColumnSpacing } = require('../src/services/planning/validationService');
  const assignments = [
    { courseCode: 'MAT101', student: { fullName: 'Ali' }, seat: { row: 1, column: 1, label: '1-1' }, exam: { id: 'E1' } },
    { courseCode: 'MAT101', student: { fullName: 'Veli' }, seat: { row: 1, column: 2, label: '1-2' }, exam: { id: 'E1' } },
    { courseCode: 'MAT101', student: { fullName: 'Can' }, seat: { row: 1, column: 3, label: '1-3' }, exam: { id: 'E1' } },
  ];
  const warnings = validateSingleCourseColumnSpacing(assignments);
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].type, 'COLUMN_SPACING_NOTICE');
  assert.equal(warnings[0].severity, 'info');
});

test('column spacing validator passes clean alternating pattern', () => {
  const { validateSingleCourseColumnSpacing } = require('../src/services/planning/validationService');
  const assignments = [
    { courseCode: 'MAT101', student: { fullName: 'Ali' }, seat: { row: 1, column: 1, label: '1-1' }, exam: { id: 'E1' } },
    { courseCode: 'MAT101', student: { fullName: 'Veli' }, seat: { row: 1, column: 3, label: '1-3' }, exam: { id: 'E1' } },
    { courseCode: 'MAT101', student: { fullName: 'Can' }, seat: { row: 1, column: 5, label: '1-5' }, exam: { id: 'E1' } },
  ];
  const warnings = validateSingleCourseColumnSpacing(assignments);
  assert.equal(warnings.length, 0);
});

function roomWithGrid(code, rows, cols) {
  const seats = [];
  for (let row = 1; row <= rows; row++) {
    for (let col = 1; col <= cols; col++) {
      seats.push({ id: `${code}-${row}-${col}`, classroomId: code, label: `${row}-${col}`, row, column: col, status: 'AKTIF', capacity: 1 });
    }
  }
  return { id: code, code, name: code, building: 'A', capacity: rows * cols, seats };
}

test('single-course 6x6 room: safe capacity is 18, rejects 30 students', () => {
  const weights = strategyWeights('efficient');
  const room = roomWithGrid('R6x6', 6, 6);
  const students = Array.from({ length: 30 }, (_, i) => ({ id: `S${i}`, studentNo: `${i}`, fullName: `Student ${i}` }));
  const item = exam('E1', 'MAT101', students);

  const candidates = buildRoomCandidates([room], [examGroup(item)], weights, 'efficient');
  assert.equal(candidates.length, 0, 'Room must be rejected: safe capacity 18 < 30 students');

  const seatResult = allocateSeatsForRoom(room, [examGroup(item)]);
  assert.equal(seatResult.strategy, 'SINGLE_COURSE_ALTERNATING_COLUMNS');
  assert.equal(seatResult.assignments.length, 18, 'Only 18 alternating-column seats should be assigned');
  assert.equal(seatResult.missingCount, 12);
  const usedCols = [...new Set(seatResult.assignments.map((a) => a.seat.column))].sort((a, b) => a - b);
  for (let i = 1; i < usedCols.length; i++) {
    assert.notEqual(usedCols[i] - usedCols[i - 1], 1, `Adjacent columns ${usedCols[i - 1]} and ${usedCols[i]} detected`);
  }
});

test('single-course 6x6 room: 18 students fit exactly in alternating columns', () => {
  const weights = strategyWeights('efficient');
  const room = roomWithGrid('R6x6', 6, 6);
  const students = Array.from({ length: 18 }, (_, i) => ({ id: `S${i}`, studentNo: `${i}`, fullName: `Student ${i}` }));
  const item = exam('E1', 'MAT101', students);

  const candidates = buildRoomCandidates([room], [examGroup(item)], weights, 'efficient');
  assert.equal(candidates.length, 1, 'Room must be accepted: safe capacity 18 = 18 students');
  assert.equal(candidates[0].totalCapacity, 18);
  assert.equal(candidates[0].usedSafeCapacity, true);

  const seatResult = allocateSeatsForRoom(room, [examGroup(item)]);
  assert.equal(seatResult.missingCount, 0);
  const usedCols = [...new Set(seatResult.assignments.map((a) => a.seat.column))].sort((a, b) => a - b);
  assert.ok(usedCols.length <= 3, 'At most half of the 6 columns should be used');
  for (let i = 1; i < usedCols.length; i++) {
    assert.notEqual(usedCols[i] - usedCols[i - 1], 1, `Adjacent columns ${usedCols[i - 1]} and ${usedCols[i]} detected`);
  }
});

test('single-course 6x6 room: 19 students exceed safe capacity of 18', () => {
  const weights = strategyWeights('efficient');
  const room = roomWithGrid('R6x6', 6, 6);
  const students = Array.from({ length: 19 }, (_, i) => ({ id: `S${i}`, studentNo: `${i}`, fullName: `Student ${i}` }));
  const item = exam('E1', 'MAT101', students);

  const candidates = buildRoomCandidates([room], [examGroup(item)], weights, 'efficient');
  assert.equal(candidates.length, 0, 'Room must be rejected: safe capacity 18 < 19 students');
});

test('single-course 5x10 room: 30 students fit exactly using 3 of 5 columns', () => {
  const weights = strategyWeights('efficient');
  const room = roomWithGrid('R5x10', 10, 5); // 10 rows × 5 columns
  const students = Array.from({ length: 30 }, (_, i) => ({ id: `S${i}`, studentNo: `${i}`, fullName: `Student ${i}` }));
  const item = exam('E1', 'MAT101', students);

  const candidates = buildRoomCandidates([room], [examGroup(item)], weights, 'efficient');
  assert.equal(candidates.length, 1, 'Room must be accepted: safe capacity 30 = 30 students');
  assert.equal(candidates[0].totalCapacity, 30);

  const seatResult = allocateSeatsForRoom(room, [examGroup(item)]);
  assert.equal(seatResult.missingCount, 0);
  const usedCols = [...new Set(seatResult.assignments.map((a) => a.seat.column))].sort((a, b) => a - b);
  assert.equal(usedCols.length, 3, 'Exactly 3 alternating columns must be used');
  for (let i = 1; i < usedCols.length; i++) {
    assert.notEqual(usedCols[i] - usedCols[i - 1], 1, `Adjacent columns ${usedCols[i - 1]} and ${usedCols[i]} detected`);
  }
});

test('single-course 5x10 room: 31 students exceed safe capacity of 30', () => {
  const weights = strategyWeights('efficient');
  const room = roomWithGrid('R5x10', 10, 5); // 10 rows × 5 columns
  const students = Array.from({ length: 31 }, (_, i) => ({ id: `S${i}`, studentNo: `${i}`, fullName: `Student ${i}` }));
  const item = exam('E1', 'MAT101', students);

  const candidates = buildRoomCandidates([room], [examGroup(item)], weights, 'efficient');
  assert.equal(candidates.length, 0, 'Room must be rejected: safe capacity 30 < 31 students');
});

test('column spacing validation fires per-room even when multiple exams exist in scenario', () => {
  const { validateSingleCourseColumnSpacing } = require('../src/services/planning/validationService');
  const assignments = [
    { courseCode: 'MAT101', student: { fullName: 'Ali' }, seat: { row: 1, column: 1, label: '1-1', classroomId: 'R1' }, exam: { id: 'E1' } },
    { courseCode: 'MAT101', student: { fullName: 'Veli' }, seat: { row: 1, column: 2, label: '1-2', classroomId: 'R1' }, exam: { id: 'E1' } },
    { courseCode: 'FIZ102', student: { fullName: 'Can' }, seat: { row: 1, column: 1, label: '1-1', classroomId: 'R2' }, exam: { id: 'E2' } },
    { courseCode: 'FIZ102', student: { fullName: 'Selin' }, seat: { row: 1, column: 3, label: '1-3', classroomId: 'R2' }, exam: { id: 'E2' } },
  ];
  const warnings = validateSingleCourseColumnSpacing(assignments);
  assert.equal(warnings.length, 1, 'R1 violation must be detected even though a second exam exists in a different room');
  assert.equal(warnings[0].type, 'COLUMN_SPACING_NOTICE');
});

test('multi-course room selection rejects room when largest course overflows its column allocation', () => {
  const weights = strategyWeights('efficient');
  // 4 cols × 3 rows = 12 seats. Round-robin gives each of 2 courses 2 cols × 3 rows = 6 seats.
  // MAT101 needs 8 > 6 → interleavedColumnCapacity = min(8,6)+min(4,6) = 10 < 12 needed → rejected.
  const room = roomWithGrid('R4x3', 3, 4);
  const large = exam('E1', 'MAT101', Array.from({ length: 8 }, (_, i) => ({ id: `A${i}`, studentNo: `${i}`, fullName: `A ${i}` })));
  const small = exam('E2', 'FIZ102', Array.from({ length: 4 }, (_, i) => ({ id: `B${i}`, studentNo: `${i + 10}`, fullName: `B ${i}` })));
  const candidates = buildRoomCandidates([room], [examGroup(large), examGroup(small)], weights, 'efficient');
  assert.equal(candidates.length, 0, 'Room must be rejected: largest course overflows its column allocation');
});

test('multi-course room selection accepts room where both courses fit their column allocation', () => {
  const weights = strategyWeights('efficient');
  // 4 cols × 4 rows = 16 seats. Each of 2 courses gets 2 cols × 4 rows = 8 seats. Both need ≤ 8 → ok.
  const room = roomWithGrid('R4x4', 4, 4);
  const e1 = exam('E1', 'MAT101', Array.from({ length: 6 }, (_, i) => ({ id: `A${i}`, studentNo: `${i}`, fullName: `A ${i}` })));
  const e2 = exam('E2', 'FIZ102', Array.from({ length: 6 }, (_, i) => ({ id: `B${i}`, studentNo: `${i + 10}`, fullName: `B ${i}` })));
  const candidates = buildRoomCandidates([room], [examGroup(e1), examGroup(e2)], weights, 'efficient');
  assert.ok(candidates.length > 0, 'Room must be accepted');
  const result = allocateSeatsForRoom(room, [examGroup(e1), examGroup(e2)]);
  assert.equal(result.missingCount, 0);
  assert.equal(result.sameCourseAdjacentSeatCount, 0);
  assert.equal(result.strategy, 'MULTI_COURSE_INTERLEAVED_COLUMNS');
});

test('multi-course overflow does not compact-fill adjacent columns', () => {
  // When overflow occurs, missing students are left unplaced rather than filled compactly.
  const room = roomWithGrid('R4x3', 3, 4);
  const large = exam('E1', 'MAT101', Array.from({ length: 8 }, (_, i) => ({ id: `A${i}`, studentNo: `${i}`, fullName: `A ${i}` })));
  const small = exam('E2', 'FIZ102', Array.from({ length: 4 }, (_, i) => ({ id: `B${i}`, studentNo: `${i + 10}`, fullName: `B ${i}` })));
  const result = allocateSeatsForRoom(room, [examGroup(large), examGroup(small)]);
  assert.ok(result.missingCount > 0, 'Overflow students must be missing, not compacted into adjacent columns');
  assert.equal(result.sameCourseAdjacentSeatCount, 0, 'No same-course adjacent seats even when overflow occurs');
  assert.ok(result.strategyWarnings.length > 0, 'Overflow must emit a strategy warning');
});

test('single-course A/B booklet: uses diagonal-safe capacity, not dense checkerboard seating', () => {
  const weights = strategyWeights('efficient');
  const room = roomWithGrid('R6x6', 6, 6); // 36 seats, safe capacity = 18
  const students = Array.from({ length: 30 }, (_, i) => ({ id: `S${i}`, studentNo: `${i}`, fullName: `Student ${i}` }));
  const item = { ...exam('E1', 'MAT101', students), bookletTypes: ['A', 'B'] };

  const candidates = buildRoomCandidates([room], [examGroup(item)], weights, 'efficient');
  assert.equal(candidates.length, 0, 'Dense A/B seating must be rejected when diagonal same-booklet conflicts are invalid');

  const seatResult = allocateSeatsForRoom(room, [examGroup(item)]);
  assert.equal(seatResult.assignments.length, 18, 'Only diagonal-safe seats should be assigned');
  assert.equal(seatResult.missingCount, 12);
  assert.ok(seatResult.strategyWarnings.length > 0);
});

test('single-course A/B booklet: spacing prevents horizontal and diagonal same-booklet adjacency', () => {
  const room = roomWithGrid('R4x4', 4, 4); // 16 seats
  const students = Array.from({ length: 8 }, (_, i) => ({ id: `S${i}`, studentNo: `${i}`, fullName: `Student ${i}` }));
  const item = { ...exam('E1', 'MAT101', students), bookletTypes: ['A', 'B'] };

  const seatResult = allocateSeatsForRoom(room, [examGroup(item)]);
  assert.equal(seatResult.missingCount, 0);
  assert.equal(seatResult.sameCourseAdjacentSeatCount, 0);

  const assignments = seatResult.assignments;
  for (let i = 0; i < assignments.length; i++) {
    for (let j = i + 1; j < assignments.length; j++) {
      const a = assignments[i];
      const b = assignments[j];
      if (a.seat.row === b.seat.row && Math.abs(a.seat.column - b.seat.column) === 1) {
        assert.notEqual(a.bookletType, b.bookletType, `Adjacent seats ${a.seat.label} and ${b.seat.label} have same booklet ${a.bookletType}`);
      }
      if (Math.abs(a.seat.row - b.seat.row) === 1 && Math.abs(a.seat.column - b.seat.column) === 1) {
        assert.notEqual(a.bookletType, b.bookletType, `Diagonal seats ${a.seat.label} and ${b.seat.label} have same booklet ${a.bookletType}`);
      }
    }
  }

  // Verify booklet balance
  const counts = {};
  for (const a of assignments) counts[a.bookletType] = (counts[a.bookletType] || 0) + 1;
  assert.ok(Math.abs(counts['A'] - counts['B']) <= 1, `Booklet counts must be balanced: A=${counts['A']}, B=${counts['B']}`);
});

test('multi-course A/B booklet: avoids same-booklet hard adjacency without forcing checkerboard', () => {
  const room = roomWithGrid('R4x4', 4, 4);
  const matStudents = Array.from({ length: 8 }, (_, i) => ({ id: `M${i}`, studentNo: `M${i}`, fullName: `MAT ${i}` }));
  const fizStudents = Array.from({ length: 8 }, (_, i) => ({ id: `F${i}`, studentNo: `F${i}`, fullName: `FIZ ${i}` }));
  const mat = { ...exam('E1', 'MAT101', matStudents), bookletTypes: ['A', 'B'] };
  const fiz = { ...exam('E2', 'FIZ102', fizStudents), bookletTypes: ['A', 'B'] };

  const seatResult = allocateSeatsForRoom(room, [examGroup(mat), examGroup(fiz)]);
  assert.equal(seatResult.missingCount, 0);
  assert.equal(seatResult.sameCourseAdjacentSeatCount, 0);
  assert.equal(seatResult.sameCourseSameBookletFrontBackAvoidableCount, 0);

  assert.equal(require('../src/services/planning/seatAllocator').countSameBookletDiagonalConflicts(seatResult.assignments), 0);
});

test('multi-course A/B/C/D booklets use coordinate cycling and remain balanced', () => {
  const room = roomWithGrid('R4x4', 4, 4);
  const matStudents = Array.from({ length: 8 }, (_, i) => ({ id: `M4${i}`, studentNo: `M4${i}`, fullName: `MAT ${i}` }));
  const fizStudents = Array.from({ length: 8 }, (_, i) => ({ id: `F4${i}`, studentNo: `F4${i}`, fullName: `FIZ ${i}` }));
  const mat = { ...exam('E1', 'MAT101', matStudents), bookletTypes: ['A', 'B', 'C', 'D'] };
  const fiz = { ...exam('E2', 'FIZ102', fizStudents), bookletTypes: ['A', 'B', 'C', 'D'] };

  const seatResult = allocateSeatsForRoom(room, [examGroup(mat), examGroup(fiz)]);
  assert.equal(seatResult.missingCount, 0);
  assert.equal(seatResult.sameCourseAdjacentSeatCount, 0);
  assert.equal(seatResult.sameCourseSameBookletFrontBackAvoidableCount, 0);

  const counts = {};
  for (const assignment of seatResult.assignments.filter((a) => a.courseCode === 'MAT101')) {
    counts[assignment.bookletType] = (counts[assignment.bookletType] || 0) + 1;
  }
  assert.deepEqual(counts, { A: 2, B: 2, C: 2, D: 2 });
});

test('post-seating booklet optimization accepts only lower avoidable front/back count', () => {
  const { countSeatRisks, optimizeBookletsAfterSeating } = require('../src/services/planning/seatAllocator');
  const makeSeat = (row, col) => ({ id: `${row}-${col}`, row, column: col, label: `${row}-${col}`, classroomId: 'R1' });
  const examItem = { id: 'E1', bookletTypes: ['A', 'B'], course: { id: 'C1', code: 'MAT101' } };
  const assignments = [
    { exam: examItem, courseCode: 'MAT101', bookletType: 'A', seat: makeSeat(1, 1) },
    { exam: examItem, courseCode: 'MAT101', bookletType: 'A', seat: makeSeat(2, 1) },
    { exam: examItem, courseCode: 'MAT101', bookletType: 'B', seat: makeSeat(3, 1) },
    { exam: examItem, courseCode: 'MAT101', bookletType: 'B', seat: makeSeat(4, 1) },
  ];

  const before = countSeatRisks(assignments);
  const optimized = optimizeBookletsAfterSeating(assignments);
  assert.equal(before.sameCourseSameBookletFrontBackAvoidableCount, 2);
  assert.equal(optimized.sameCourseSameBookletFrontBackAvoidableCount, 0);
  assert.equal(optimized.sameCourseAdjacentSeatCount, 0);
  assert.deepEqual(optimized.assignments.map((assignment) => assignment.seat.id), assignments.map((assignment) => assignment.seat.id));
});

test('single-course single-booklet: still uses alternating columns', () => {
  const weights = strategyWeights('efficient');
  const room = roomWithGrid('R6x6', 6, 6); // safe capacity = 18
  const students = Array.from({ length: 20 }, (_, i) => ({ id: `S${i}`, studentNo: `${i}`, fullName: `Student ${i}` }));
  const item = exam('E1', 'MAT101', students); // no bookletTypes → defaults to ['A']

  const candidates = buildRoomCandidates([room], [examGroup(item)], weights, 'efficient');
  assert.equal(candidates.length, 0, 'Single-booklet exam must still be limited to alternating-column capacity (18 < 20)');
});

test('single-booklet front/back conflicts are counted as unavoidable', () => {
  const { countSeatRisks } = require('../src/services/planning/seatAllocator');
  const makeSeat = (row, col) => ({ id: `${row}-${col}`, row, column: col, label: `${row}-${col}`, classroomId: 'R1' });
  const assignments = [
    { courseCode: 'MAT101', bookletType: 'A', seat: makeSeat(1, 1) },
    { courseCode: 'MAT101', bookletType: 'A', seat: makeSeat(2, 1) },
  ];
  const risks = countSeatRisks(assignments);
  assert.equal(risks.sameCourseSameBookletFrontBackAvoidableCount, 0);
  assert.equal(risks.sameCourseSameBookletFrontBackUnavoidableCount, 1);
});

test('same-course different-booklet adjacency is not a risk', () => {
  const { countSeatRisks } = require('../src/services/planning/seatAllocator');
  const makeSeat = (row, col) => ({ id: `${row}-${col}`, row, column: col, label: `${row}-${col}`, classroomId: 'R1' });
  // Two students same course, adjacent, but different booklets
  const assignments = [
    { courseCode: 'MAT101', bookletType: 'A', seat: makeSeat(1, 1) },
    { courseCode: 'MAT101', bookletType: 'B', seat: makeSeat(1, 2) },
  ];
  const risks = countSeatRisks(assignments);
  assert.equal(risks.sameCourseAdjacentSeatCount, 0, 'Different booklet adjacency must not count as a risk');
});

test('same-course same-booklet adjacency is a risk', () => {
  const { countSeatRisks } = require('../src/services/planning/seatAllocator');
  const makeSeat = (row, col) => ({ id: `${row}-${col}`, row, column: col, label: `${row}-${col}`, classroomId: 'R1' });
  const assignments = [
    { courseCode: 'MAT101', bookletType: 'A', seat: makeSeat(1, 1) },
    { courseCode: 'MAT101', bookletType: 'A', seat: makeSeat(1, 2) },
  ];
  const risks = countSeatRisks(assignments);
  assert.equal(risks.sameCourseAdjacentSeatCount, 1, 'Same booklet same course adjacency must be counted as a risk');
});

test('column spacing validator skips multi-booklet single-course rooms', () => {
  const { validateSingleCourseColumnSpacing } = require('../src/services/planning/validationService');
  // Same course, adjacent columns, but two booklet types → intentional, should not fire
  const assignments = [
    { courseCode: 'MAT101', bookletType: 'A', student: { fullName: 'Ali' }, seat: { row: 1, column: 1, label: '1-1', classroomId: 'R1' }, exam: { id: 'E1' } },
    { courseCode: 'MAT101', bookletType: 'B', student: { fullName: 'Veli' }, seat: { row: 1, column: 2, label: '1-2', classroomId: 'R1' }, exam: { id: 'E1' } },
  ];
  const warnings = validateSingleCourseColumnSpacing(assignments);
  assert.equal(warnings.length, 0, 'Multi-booklet rooms must not trigger column spacing violation');
});

test('metrics include score breakdown and mixed room counts', () => {
  const e1 = exam('E1', 'FIZ102', [{ id: 'S1' }]);
  const e2 = exam('E2', 'ING101', [{ id: 'S2' }]);
  const group = buildPlanningGroups([e1, e2], buildCourseConflictMatrix([e1, e2]), [classroom({ code: 'R1', name: 'Room', capacity: 8 })], DEFAULT_PLANNING_CONFIG, 'minimum_rooms')[0];
  const metrics = buildScenarioMetrics({
    exams: [e1, e2],
    placements: [{ group, date: new Date('2026-12-01T00:00:00.000Z') }],
    roomStats: [{ roomId: 'R1', mixed: true, capacity: 8, assignedCount: 2 }],
    invigilatorLoad: new Map(),
    invigilators: [],
    warnings: [],
    scoreParts: [{ roomEfficiency: 10, invigilatorFairness: 5, studentLoadBalance: 0, timeEfficiency: 0, mixedRoomEfficiency: -30 }],
    specialNeeds: { handledCount: 0, warningCount: 0 },
    seatRisks: { sameCourseAdjacentSeatCount: 0, sameCourseSameBookletFrontBackAvoidableCount: 0, sameCourseSameBookletFrontBackUnavoidableCount: 0 },
    explanations: ['Karma salon üretildi.'],
  });
  assert.equal(metrics.mixedRoomCount, 1);
  assert.equal(metrics.roomsSavedByMixing, 1);
  assert.ok(metrics.scoreBreakdown.roomEfficiency < 100);
});
