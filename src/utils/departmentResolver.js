function normalizeDepartmentCode(value) {
  const raw = String(value || 'Genel').trim() || 'Genel';
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase() || 'GENEL';
}

async function resolveDepartment(prisma, value, req) {
  const requested = String(value || '').trim();
  if (req?.user?.role === 'DEPARTMENT_MANAGER') {
    if (!req.user.departmentId) {
      const error = new Error('Bölüm kapsamı tanımlı olmayan kullanıcı bu işlemi yapamaz.');
      error.status = 403;
      throw error;
    }
    return prisma.department.findUnique({ where: { id: req.user.departmentId } });
  }

  const name = requested || 'Genel';
  const code = normalizeDepartmentCode(name);
  return prisma.department.upsert({
    where: { code },
    update: { name },
    create: { code, name },
  });
}

module.exports = { normalizeDepartmentCode, resolveDepartment };
