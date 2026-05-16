const test = require('node:test');
const assert = require('node:assert/strict');
const { buildCpSatInput, optionConflict } = require('../src/services/planning/cpSatOptimizer');
const { DEFAULT_PLANNING_CONFIG, strategyWeights } = require('../src/services/planning/config');
const { buildCourseConflictMatrix } = require('../src/services/planning/courseConflictMatrixBuilder');
const { buildPlanningGroups, makeSingleGroup } = require('../src/services/planning/mixedRoomPlanner');

function roomWithGrid(code, rows, cols) {
  const seats = [];
  for (let row = 1; row <= rows; row += 1) {
    for (let column = 1; column <= cols; column += 1) {
      seats.push({ id: `${code}-${row}-${column}`, classroomId: code, label: `${row}-${column}`, row, column, status: 'AKTIF', capacity: 1 });
    }
  }
  return { id: code, code, name: code, capacity: rows * cols, seats };
}

function exam(id, code, students, overrides = {}) {
  return {
    id,
    durationMinutes: 90,
    pinned: false,
    ...overrides,
    course: {
      id: `C-${id}`,
      code,
      name: code,
      department: 'Bilgisayar Mühendisliği',
      enrollments: students.map((student) => ({ student })),
      ...(overrides.course || {}),
    },
  };
}

function period() {
  return {
    startDate: new Date('2026-12-01T00:00:00.000Z'),
    endDate: new Date('2026-12-02T00:00:00.000Z'),
    slots: [{ startTime: '09:00', endTime: '11:00' }, { startTime: '12:00', endTime: '14:00' }],
  };
}

function invigilator(id) {
  return { id, firstName: id, lastName: 'Test', maxAssignments: 4, availability: [] };
}

function baseInputArgs(groups, classrooms = [roomWithGrid('R1', 4, 4)]) {
  return {
    groups,
    period: period(),
    dates: [new Date('2026-12-01T00:00:00.000Z'), new Date('2026-12-02T00:00:00.000Z')],
    classrooms,
    invigilators: [invigilator('I1'), invigilator('I2')],
    weights: strategyWeights('efficient'),
    config: DEFAULT_PLANNING_CONFIG,
    strategy: 'efficient',
  };
}

test('CP-SAT input honors pinned exam schedule', () => {
  const students = [{ id: 'S1', fullName: 'S1' }];
  const item = exam('E1', 'MAT101', students, {
    pinned: true,
    date: new Date('2026-12-02T00:00:00.000Z'),
    startTime: '12:00',
    endTime: '13:30',
  });
  const input = buildCpSatInput(baseInputArgs([makeSingleGroup(item)]));

  assert.equal(input.diagnostics.length, 0);
  assert.ok(input.options.length > 0);
  assert.equal(new Set(input.options.map((option) => option.date)).size, 1);
  assert.equal(input.options[0].date, '2026-12-02');
  assert.equal(input.options[0].startTime, '12:00');
  assert.equal(input.options[0].endTime, '13:30');
});

test('CP-SAT input reports infeasible groups when capacity is insufficient', () => {
  const students = Array.from({ length: 20 }, (_, index) => ({ id: `S${index}` }));
  const item = exam('E1', 'MAT101', students);
  const input = buildCpSatInput(baseInputArgs([makeSingleGroup(item)], [roomWithGrid('R1', 2, 2)]));

  assert.equal(input.options.length, 0);
  assert.equal(input.diagnostics[0].type, 'NO_OPTIONS_FOR_GROUP');
});

test('CP-SAT input separates effective exam capacity from physical room capacity', () => {
  const students = Array.from({ length: 4 }, (_, index) => ({ id: `S${index}` }));
  const item = exam('E1', 'MAT101', students);
  const input = buildCpSatInput(baseInputArgs([makeSingleGroup(item)], [roomWithGrid('R1', 4, 4)]));
  const option = input.options[0];

  assert.equal(option.studentCount, 4);
  assert.equal(option.effectiveExamCapacity, 8);
  assert.equal(option.physicalCapacity, 16);
  assert.equal(option.utilizationPercent, 50);
  assert.equal(option.physicalUtilizationPercent, 25);
  assert.equal(option.roomWaste, 4);
  assert.equal(option.physicalRoomWaste, 12);
});

test('CP-SAT input includes multi-room alternatives even when one large room fits', () => {
  const students = Array.from({ length: 32 }, (_, index) => ({ id: `S${index}` }));
  const item = exam('E1', 'MAT101', students);
  const rooms = [roomWithGrid('BZ05', 6, 6), roomWithGrid('BZ04', 5, 8), roomWithGrid('A102', 10, 10)];
  const input = buildCpSatInput(baseInputArgs([makeSingleGroup(item)], rooms));
  const roomSets = new Set(input.options.map((option) => option.roomIds.join('+')));

  assert.ok(roomSets.has('A102'), 'single large room must remain available');
  assert.ok([...roomSets].some((value) => value.includes('BZ05') && value.includes('BZ04')), 'two smaller rooms must be offered to CP-SAT');
});

test('CP-SAT input filters room options that would break locked classroom assignments', () => {
  const students = [{ id: 'S1' }, { id: 'S2' }];
  const item = exam('E1', 'MAT101', students);
  const rooms = [roomWithGrid('R1', 4, 4), roomWithGrid('R2', 4, 4)];
  const input = buildCpSatInput({
    ...baseInputArgs([makeSingleGroup(item)], rooms),
    lockedAssignments: [{ examId: 'E1', classroomId: 'R2' }],
  });

  assert.ok(input.options.length > 0);
  assert.deepEqual([...new Set(input.options.map((option) => option.roomIds.join('+')))], ['R2']);
});

test('CP-SAT option conflict detects overlapping hard resources', () => {
  const left = {
    date: '2026-12-01',
    startTime: '09:00',
    endTime: '10:30',
    roomIds: ['R1'],
    studentIds: ['S1'],
    invigilatorIds: ['I1'],
  };
  assert.equal(optionConflict(left, { ...left, roomIds: ['R2'], studentIds: ['S2'], invigilatorIds: ['I2'], startTime: '10:30', endTime: '12:00' }), false);
  assert.equal(optionConflict(left, { ...left, roomIds: ['R1'], studentIds: ['S2'], invigilatorIds: ['I2'] }), true);
  assert.equal(optionConflict(left, { ...left, roomIds: ['R2'], studentIds: ['S1'], invigilatorIds: ['I2'] }), true);
  assert.equal(optionConflict(left, { ...left, roomIds: ['R2'], studentIds: ['S2'], invigilatorIds: ['I1'] }), true);
});

test('planning groups for CP-SAT still prevent shared-student mixed rooms', () => {
  const shared = { id: 'S1' };
  const left = exam('E1', 'MAT101', [shared]);
  const right = exam('E2', 'FIZ102', [shared]);
  const groups = buildPlanningGroups([left, right], buildCourseConflictMatrix([left, right]), [roomWithGrid('R1', 4, 4)], DEFAULT_PLANNING_CONFIG, 'efficient');

  assert.equal(groups.length, 2);
  assert.equal(groups.some((group) => group.mixed), false);
});
