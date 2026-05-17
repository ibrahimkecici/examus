const express = require('express');
const bcrypt = require('bcryptjs');
const prisma = require('../config/prisma');
const asyncHandler = require('../utils/asyncHandler');
const { requireRole } = require('../middleware/auth');
const { assertValidRole } = require('../utils/accessControl');
const { resolveDepartment } = require('../utils/departmentResolver');

const router = express.Router();
const STUDENT_DEFAULT_PASSWORD = '12345678';

router.use(requireRole('ADMIN'));

function splitName(body) {
  const firstName = body.firstName || '';
  const lastName = body.lastName || '';
  return body.name || `${firstName} ${lastName}`.trim() || body.email;
}

async function userPayload(body, existing = null) {
  const role = body.role || existing?.role || 'DEPARTMENT_MANAGER';
  assertValidRole(role);
  const payload = {
    name: splitName(body) || existing?.name,
    email: body.email || existing?.email,
    role,
    department: body.department || null,
    departmentId: body.departmentId || null,
    mustChangePassword: body.mustChangePassword === undefined ? false : Boolean(body.mustChangePassword),
  };

  if (body.departmentId) {
    const department = await prisma.department.findUnique({ where: { id: body.departmentId } });
    payload.department = department?.name || payload.department;
  } else if (body.department) {
    const department = await resolveDepartment(prisma, body.department);
    payload.department = department.name;
    payload.departmentId = department.id;
  }

  if (role === 'STUDENT') {
    const student = await prisma.student.findUnique({ where: { id: body.studentId }, include: { departmentRef: true } });
    if (!student) {
      const error = new Error('Öğrenci kullanıcısı için öğrenci profili seçilmelidir.');
      error.status = 400;
      throw error;
    }
    payload.name = student.fullName;
    payload.email = body.email || `${student.studentNo}@students.examus.local`;
    payload.department = student.department;
    payload.departmentId = student.departmentId;
    payload.passwordHash = await bcrypt.hash(STUDENT_DEFAULT_PASSWORD, 10);
    payload.mustChangePassword = true;
  } else if (body.password) {
    payload.passwordHash = await bcrypt.hash(body.password, 10);
  } else if (!existing) {
    payload.passwordHash = await bcrypt.hash('Examus123!', 10);
  }

  Object.keys(payload).forEach((key) => payload[key] === undefined && delete payload[key]);
  return payload;
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const data = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, email: true, role: true, department: true, departmentId: true, mustChangePassword: true, departmentRef: true, studentProfile: true, invigilatorProfile: true, createdAt: true, updatedAt: true },
    });
    res.json({ success: true, count: data.length, data });
  }),
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const payload = await userPayload(req.body);
    const data = await prisma.user.create({
      data: payload,
      select: { id: true, name: true, email: true, role: true, department: true, departmentId: true, mustChangePassword: true },
    });
    if (req.body.role === 'STUDENT' && req.body.studentId) {
      await prisma.student.update({ where: { id: req.body.studentId }, data: { userId: data.id } });
    }
    res.status(201).json({ success: true, data });
  }),
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const existing = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ success: false, message: 'Kayıt bulunamadı.' });
    const payload = await userPayload(req.body, existing);
    delete payload.email;
    if (req.body.email) payload.email = req.body.email;
    const data = await prisma.user.update({
      where: { id: req.params.id },
      data: payload,
      select: { id: true, name: true, email: true, role: true, department: true, departmentId: true, mustChangePassword: true },
    });
    if (req.body.role === 'STUDENT' && req.body.studentId) {
      await prisma.student.update({ where: { id: req.body.studentId }, data: { userId: data.id } });
    }
    res.json({ success: true, data });
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await prisma.user.delete({ where: { id: req.params.id } });
    res.json({ success: true, data: {} });
  }),
);

module.exports = router;
