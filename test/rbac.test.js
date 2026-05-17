const test = require('node:test');
const assert = require('node:assert/strict');
const {
  assertResourceWrite,
  assertValidRole,
  resourceReadWhere,
} = require('../src/utils/accessControl');
const { filterScenarioForUser, scenarioWhereForUser } = require('../src/utils/scenarioAccess');

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
