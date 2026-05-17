const ROLE_LABELS = {
  ADMIN: 'Sistem Yöneticisi',
  DEPARTMENT_MANAGER: 'Bölüm Koordinatörü',
  INSTRUCTOR: 'Ders Sorumlusu',
  INVIGILATOR: 'Gözetmen',
  STUDENT: 'Öğrenci',
};

const VALID_ROLES = Object.keys(ROLE_LABELS);

function forbid(message = 'Bu işlem için yetkiniz yok.') {
  const error = new Error(message);
  error.status = 403;
  throw error;
}

function assertValidRole(role) {
  if (!VALID_ROLES.includes(role)) {
    const error = new Error('Geçersiz kullanıcı rolü.');
    error.status = 400;
    throw error;
  }
}

function hasRole(req, roles) {
  return Boolean(req.user && roles.includes(req.user.role));
}

function requireAnyRole(req, roles) {
  if (!hasRole(req, roles)) forbid();
}

function departmentScope(req, field = 'departmentId') {
  if (!req.user.departmentId) return { id: '__no_department_scope__' };
  return { [field]: req.user.departmentId };
}

function resourceReadWhere(modelName, req) {
  const role = req.user?.role;
  if (role === 'ADMIN') return {};
  if (role === 'DEPARTMENT_MANAGER') {
    if (['student', 'course', 'invigilator', 'user'].includes(modelName)) return departmentScope(req);
    if (modelName === 'exam') return { course: departmentScope(req) };
    if (modelName === 'examPeriod' || modelName === 'classroom' || modelName === 'department') return {};
  }
  if (role === 'INSTRUCTOR') {
    if (modelName === 'course') return { instructorId: req.user.id };
    if (modelName === 'exam') return { course: { instructorId: req.user.id } };
    if (modelName === 'student') return { enrollments: { some: { course: { instructorId: req.user.id } } } };
    if (modelName === 'examPeriod' || modelName === 'classroom') return {};
  }
  if (role === 'INVIGILATOR') {
    if (modelName === 'invigilator') return { userId: req.user.id };
    if (modelName === 'exam') return { invigilators: { some: { invigilator: { userId: req.user.id } } } };
  }
  if (role === 'STUDENT') {
    if (modelName === 'student') return { userId: req.user.id };
    if (modelName === 'course') return { enrollments: { some: { student: { userId: req.user.id } } } };
    if (modelName === 'exam') return { course: { enrollments: { some: { student: { userId: req.user.id } } } } };
  }
  return { id: '__forbidden__' };
}

function resourceWriteRoles(modelName) {
  if (modelName === 'department') return ['ADMIN'];
  if (['examPeriod', 'classroom'].includes(modelName)) return ['ADMIN'];
  if (['student', 'course', 'invigilator', 'exam'].includes(modelName)) return ['ADMIN', 'DEPARTMENT_MANAGER'];
  return ['ADMIN'];
}

function assertResourceWrite(modelName, req, existing = null) {
  requireAnyRole(req, resourceWriteRoles(modelName));
  if (req.user.role !== 'DEPARTMENT_MANAGER') return;
  if (!req.user.departmentId) forbid('Bölüm kapsamı tanımlı olmayan kullanıcı bu işlemi yapamaz.');
  if (!existing) return;
  const departmentId = existing.departmentId || existing.course?.departmentId;
  if (departmentId && departmentId !== req.user.departmentId) forbid();
}

module.exports = {
  ROLE_LABELS,
  VALID_ROLES,
  assertValidRole,
  assertResourceWrite,
  forbid,
  hasRole,
  requireAnyRole,
  resourceReadWhere,
};
