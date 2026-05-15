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
    seatRisks: { sameCourseAdjacentSeatCount: 0, sameCourseFrontBackSeatCount: 0 },
    explanations: ['Karma salon üretildi.'],
  });
  assert.equal(metrics.mixedRoomCount, 1);
  assert.equal(metrics.roomsSavedByMixing, 1);
  assert.ok(metrics.scoreBreakdown.roomEfficiency < 100);
});
