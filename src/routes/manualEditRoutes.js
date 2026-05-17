const express = require('express');
const prisma = require('../config/prisma');
const asyncHandler = require('../utils/asyncHandler');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

router.patch(
  '/exams/:id/schedule',
  requireRole('ADMIN', 'DEPARTMENT_MANAGER', 'INSTRUCTOR'),
  asyncHandler(async (req, res) => {
    const existing = await prisma.exam.findUnique({ where: { id: req.params.id }, include: { course: true } });
    if (!existing) return res.status(404).json({ success: false, message: 'Sınav bulunamadı.' });
    if (req.user.role === 'DEPARTMENT_MANAGER' && existing.course.departmentId !== req.user.departmentId) {
      return res.status(403).json({ success: false, message: 'Bu işlem için yetkiniz yok.' });
    }
    if (req.user.role === 'INSTRUCTOR' && existing.course.instructorId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Bu işlem için yetkiniz yok.' });
    }
    const data = await prisma.exam.update({
      where: { id: req.params.id },
      data: {
        date: req.body.date ? new Date(req.body.date) : undefined,
        startTime: req.body.startTime,
        endTime: req.body.endTime,
        pinned: req.body.pinned === undefined ? undefined : Boolean(req.body.pinned),
      },
      include: { course: true },
    });
    res.json({ success: true, data });
  }),
);

router.patch(
  '/seat-assignments/:id',
  requireRole('ADMIN', 'DEPARTMENT_MANAGER'),
  asyncHandler(async (req, res) => {
    const data = await prisma.seatAssignment.update({
      where: { id: req.params.id },
      data: { seatId: req.body.seatId, locked: req.body.locked === undefined ? undefined : Boolean(req.body.locked) },
      include: { student: true, seat: true, exam: { include: { course: true } } },
    });
    res.json({ success: true, data });
  }),
);

module.exports = router;
