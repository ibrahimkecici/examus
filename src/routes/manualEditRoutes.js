const express = require('express');
const prisma = require('../config/prisma');
const asyncHandler = require('../utils/asyncHandler');
const { requireRole } = require('../middleware/auth');
const {
  validateExamScheduleChange,
  validateInvigilatorAssignmentChange,
  validateRoomAssignmentChange,
  validateSeatAssignmentChange,
} = require('../services/manualValidationService');

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
    const validation = await validateExamScheduleChange(req.params.id, req.body);
    if (!validation.ok) return res.status(409).json({ success: false, message: 'Hard constraint ihlali nedeniyle değişiklik kaydedilmedi.', validation });
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
    res.json({ success: true, data, validation });
  }),
);

router.patch(
  '/seat-assignments/:id',
  requireRole('ADMIN', 'DEPARTMENT_MANAGER'),
  asyncHandler(async (req, res) => {
    const existing = await prisma.seatAssignment.findUnique({
      where: { id: req.params.id },
      include: { student: true, exam: { include: { course: true } } },
    });
    if (!existing) return res.status(404).json({ success: false, message: 'Oturma ataması bulunamadı.' });
    if (
      req.user.role === 'DEPARTMENT_MANAGER' &&
      existing.student.departmentId !== req.user.departmentId &&
      existing.exam.course.departmentId !== req.user.departmentId
    ) {
      return res.status(403).json({ success: false, message: 'Bu işlem için yetkiniz yok.' });
    }
    const validation = await validateSeatAssignmentChange(req.params.id, req.body);
    if (!validation.ok) return res.status(409).json({ success: false, message: 'Hard constraint ihlali nedeniyle değişiklik kaydedilmedi.', validation });
    const data = await prisma.seatAssignment.update({
      where: { id: req.params.id },
      data: { seatId: req.body.seatId, locked: req.body.locked === undefined ? undefined : Boolean(req.body.locked) },
      include: { student: true, seat: true, exam: { include: { course: true } } },
    });
    res.json({ success: true, data, validation });
  }),
);

router.patch(
  '/room-assignments/:id',
  requireRole('ADMIN', 'DEPARTMENT_MANAGER'),
  asyncHandler(async (req, res) => {
    const existing = await prisma.examRoomAssignment.findUnique({
      where: { id: req.params.id },
      include: { exam: { include: { course: true } } },
    });
    if (!existing) return res.status(404).json({ success: false, message: 'Salon ataması bulunamadı.' });
    if (req.user.role === 'DEPARTMENT_MANAGER' && existing.exam.course.departmentId !== req.user.departmentId) {
      return res.status(403).json({ success: false, message: 'Bu işlem için yetkiniz yok.' });
    }
    const validation = await validateRoomAssignmentChange(req.params.id, req.body);
    if (!validation.ok) return res.status(409).json({ success: false, message: 'Hard constraint ihlali nedeniyle değişiklik kaydedilmedi.', validation });
    const data = await prisma.examRoomAssignment.update({
      where: { id: req.params.id },
      data: {
        classroomId: req.body.classroomId || undefined,
        assignedCount: req.body.assignedCount === undefined ? undefined : Number(req.body.assignedCount),
      },
      include: { classroom: true, exam: { include: { course: true } } },
    });
    res.json({ success: true, data, validation });
  }),
);

router.patch(
  '/invigilator-assignments/:id',
  requireRole('ADMIN', 'DEPARTMENT_MANAGER'),
  asyncHandler(async (req, res) => {
    const existing = await prisma.invigilatorAssignment.findUnique({
      where: { id: req.params.id },
      include: { exam: { include: { course: true } }, invigilator: true },
    });
    if (!existing) return res.status(404).json({ success: false, message: 'Gözetmen ataması bulunamadı.' });
    if (req.user.role === 'DEPARTMENT_MANAGER' && existing.exam.course.departmentId !== req.user.departmentId) {
      return res.status(403).json({ success: false, message: 'Bu işlem için yetkiniz yok.' });
    }
    const validation = await validateInvigilatorAssignmentChange(req.params.id, req.body);
    if (!validation.ok) return res.status(409).json({ success: false, message: 'Hard constraint ihlali nedeniyle değişiklik kaydedilmedi.', validation });
    const data = await prisma.invigilatorAssignment.update({
      where: { id: req.params.id },
      data: {
        invigilatorId: req.body.invigilatorId || undefined,
        role: req.body.role || undefined,
      },
      include: { invigilator: true, exam: { include: { course: true } } },
    });
    res.json({ success: true, data, validation });
  }),
);

module.exports = router;
