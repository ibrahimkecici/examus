const test = require('node:test');
const assert = require('node:assert/strict');
const {
  assertResourceWrite,
  assertValidRole,
  resourceReadWhere,
} = require('../src/utils/accessControl');
const { filterScenarioForUser, scenarioWhereForUser } = require('../src/utils/scenarioAccess');
const { buildExamOperationFromScenario } = require('../src/services/operationService');

test('valid roles are limited to the five supported RBAC roles', () => {
  assert.doesNotThrow(() => assertValidRole('ADMIN'));
  assert.doesNotThrow(() => assertValidRole('DEPARTMENT_MANAGER'));
  assert.doesNotThrow(() => assertValidRole('INSTRUCTOR'));
  assert.doesNotThrow(() => assertValidRole('INVIGILATOR'));
  assert.doesNotThrow(() => assertValidRole('STUDENT'));
  assert.throws(() => assertValidRole('PLANNER'), /Geçersiz kullanıcı rolü/);
});

test('department manager reads only department scoped resources', () => {
  const req = { user: { role: 'DEPARTMENT_MANAGER', departmentId: 'dept-1' } };
  assert.deepEqual(resourceReadWhere('student', req), { departmentId: 'dept-1' });
  assert.deepEqual(resourceReadWhere('course', req), { departmentId: 'dept-1' });
  assert.deepEqual(resourceReadWhere('exam', req), { course: { departmentId: 'dept-1' } });
});

test('instructor, invigilator, and student scopes are tied to their own profiles', () => {
  assert.deepEqual(resourceReadWhere('course', { user: { role: 'INSTRUCTOR', id: 'u1' } }), { instructorId: 'u1' });
  assert.deepEqual(resourceReadWhere('invigilator', { user: { role: 'INVIGILATOR', id: 'u2' } }), { userId: 'u2' });
  assert.deepEqual(resourceReadWhere('student', { user: { role: 'STUDENT', id: 'u3' } }), { userId: 'u3' });
});

test('department manager cannot write outside own department', () => {
  const req = { user: { role: 'DEPARTMENT_MANAGER', departmentId: 'dept-1' } };
  assert.doesNotThrow(() => assertResourceWrite('student', req, { departmentId: 'dept-1' }));
  assert.throws(() => assertResourceWrite('student', req, { departmentId: 'dept-2' }), /yetkiniz yok/);
});

test('classroom and department writes are admin only', () => {
  assert.doesNotThrow(() => assertResourceWrite('department', { user: { role: 'ADMIN' } }));
  assert.throws(() => assertResourceWrite('department', { user: { role: 'DEPARTMENT_MANAGER', departmentId: 'dept-1' } }), /yetkiniz yok/);
  assert.throws(() => assertResourceWrite('classroom', { user: { role: 'DEPARTMENT_MANAGER', departmentId: 'dept-1' } }), /yetkiniz yok/);
});

test('scenario scope lets instructors see own exam seats and students only their own seat', () => {
  const scenario = {
    schedules: [
      { examId: 'exam-1', exam: { course: { instructorId: 'teacher-1' } } },
      { examId: 'exam-2', exam: { course: { instructorId: 'teacher-2' } } },
    ],
    rooms: [
      { examId: 'exam-1', exam: { course: { instructorId: 'teacher-1' } } },
      { examId: 'exam-2', exam: { course: { instructorId: 'teacher-2' } } },
    ],
    seats: [
      { examId: 'exam-1', student: { userId: 'student-1' } },
      { examId: 'exam-1', student: { userId: 'student-2' } },
      { examId: 'exam-2', student: { userId: 'student-3' } },
    ],
    invigilators: [],
    roomSlots: [
      { assignments: [{ examId: 'exam-1', exam: { course: { instructorId: 'teacher-1' } } }, { examId: 'exam-2', exam: { course: { instructorId: 'teacher-2' } } }] },
    ],
    warnings: [],
  };

  const instructorScoped = filterScenarioForUser(scenario, { role: 'INSTRUCTOR', id: 'teacher-1' });
  assert.equal(instructorScoped.seats.length, 2);
  assert.deepEqual(instructorScoped.schedules.map((item) => item.examId), ['exam-1']);

  const studentScoped = filterScenarioForUser(scenario, { role: 'STUDENT', id: 'student-1' });
  assert.equal(studentScoped.seats.length, 1);
  assert.equal(studentScoped.seats[0].student.userId, 'student-1');
  assert.deepEqual(studentScoped.schedules.map((item) => item.examId), ['exam-1']);
});

test('scenario where supports instructor, invigilator, and student scoped listings', () => {
  assert.deepEqual(scenarioWhereForUser({ role: 'INSTRUCTOR', id: 'teacher-1' }), {
    OR: [
      { schedules: { some: { exam: { course: { instructorId: 'teacher-1' } } } } },
      { rooms: { some: { exam: { course: { instructorId: 'teacher-1' } } } } },
    ],
  });
  assert.deepEqual(scenarioWhereForUser({ role: 'INVIGILATOR', id: 'inv-1' }), { invigilators: { some: { invigilator: { userId: 'inv-1' } } } });
  assert.deepEqual(scenarioWhereForUser({ role: 'STUDENT', id: 'student-1' }), { seats: { some: { student: { userId: 'student-1' } } } });
});

test('exam operation model exposes role scoped seating and room details', () => {
  const scenario = {
    id: 'scenario-1',
    name: 'Final plan',
    status: 'COMPLETED',
    strategy: 'optimal_cp_sat',
    score: 92,
    period: { id: 'period-1', name: 'Final' },
    schedules: [
      { examId: 'exam-1', date: new Date('2026-06-01'), startTime: '09:00', endTime: '11:00', exam: { id: 'exam-1', durationMinutes: 120, course: { code: 'MAT101', name: 'Matematik', studentCount: 1 } } },
    ],
    rooms: [
      { id: 'room-assignment-1', examId: 'exam-1', classroomId: 'room-1', assignedCount: 1, classroom: { code: 'A101', name: 'Amfi 101', capacity: 80, examCapacity: 40, rowCount: 2, columnCount: 2 } },
    ],
    seats: [
      {
        id: 'seat-assignment-1',
        examId: 'exam-1',
        studentId: 'student-1',
        classroomId: 'room-1',
        seatId: 'seat-1',
        bookletType: 'A',
        locked: false,
        student: { studentNo: '20240001', fullName: 'Ayşe Yılmaz', specialNeeds: 'Ön sıra' },
        seat: { label: 'A1', row: 1, column: 1 },
        classroom: { code: 'A101', name: 'Amfi 101', rowCount: 2, columnCount: 2 },
        exam: { course: { code: 'MAT101', name: 'Matematik' } },
      },
    ],
    invigilators: [
      { id: 'inv-assignment-1', examId: 'exam-1', invigilatorId: 'inv-1', role: 'SALON', invigilator: { staffNo: 'GZ001', firstName: 'Ali', lastName: 'Kaya', title: 'Dr.' } },
    ],
  };

  const operation = buildExamOperationFromScenario(scenario, 'exam-1', { role: 'INVIGILATOR' });
  assert.equal(operation.summary.assignedCount, 1);
  assert.equal(operation.rooms[0].classroomCode, 'A101');
  assert.equal(operation.rooms[0].seats[0].studentNo, '20240001');
  assert.equal(operation.seats[0].bookletType, 'A');
  assert.equal(operation.invigilators[0].name, 'Dr. Ali Kaya');
});
