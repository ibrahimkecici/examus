const test = require('node:test');
const assert = require('node:assert/strict');
const {
  assertResourceWrite,
  assertValidRole,
  resourceReadWhere,
} = require('../src/utils/accessControl');

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
