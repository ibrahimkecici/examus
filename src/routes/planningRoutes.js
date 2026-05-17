const express = require('express');
const prisma = require('../config/prisma');
const asyncHandler = require('../utils/asyncHandler');
const { requireRole } = require('../middleware/auth');
const { recheckScenario, runScenario } = require('../services/planningService');

const router = express.Router();

router.post(
  '/scenarios',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const data = await prisma.planningScenario.create({
      data: {
        periodId: req.body.periodId,
        name: req.body.name || 'Yeni planlama senaryosu',
        strategy: req.body.strategy || 'efficient',
      },
    });
    res.status(201).json({ success: true, data });
  }),
);

router.get(
  '/scenarios',
  asyncHandler(async (req, res) => {
    const data = await prisma.planningScenario.findMany({ include: { period: true }, orderBy: { createdAt: 'desc' } });
    res.json({ success: true, count: data.length, data });
  }),
);

router.get(
  '/scenarios/:id',
  asyncHandler(async (req, res) => {
    const data = await prisma.planningScenario.findUnique({
      where: { id: req.params.id },
      include: {
        period: true,
        schedules: true,
        roomSlots: { include: { classroom: true, assignments: { include: { exam: { include: { course: true } } } } } },
        rooms: { include: { classroom: true, exam: { include: { course: true } } } },
        seats: { include: { student: true, seat: true, exam: { include: { course: true } }, classroom: true } },
        invigilators: { include: { invigilator: true, exam: { include: { course: true } } } },
        insights: true,
      },
    });
    if (!data) return res.status(404).json({ success: false, message: 'Planlama senaryosu bulunamadı.' });
    res.json({ success: true, data });
  }),
);

router.post(
  '/scenarios/:id/run',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    try {
      res.json({ success: true, data: await runScenario(req.params.id) });
    } catch (error) {
      const data = await prisma.planningScenario.update({
        where: { id: req.params.id },
        data: {
          status: 'FAILED',
          warnings: [{ type: 'PLANNING_RUN_ERROR', severity: 'hard', message: error.message || 'Planlama çalıştırması tamamlanamadı.' }],
        },
      });
      res.status(500).json({ success: false, message: error.message || 'Planlama çalıştırması tamamlanamadı.', data });
    }
  }),
);
router.post('/scenarios/:id/recheck', requireRole('ADMIN'), asyncHandler(async (req, res) => res.json({ success: true, data: await recheckScenario(req.params.id) })));

router.post(
  '/scenarios/:id/approve',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const scenario = await prisma.planningScenario.findUnique({ where: { id: req.params.id }, include: { schedules: true } });
    if (!scenario) return res.status(404).json({ success: false, message: 'Planlama senaryosu bulunamadı.' });
    if (scenario.status === 'FAILED') return res.status(409).json({ success: false, message: 'Hard validasyon hatası olan senaryo onaylanamaz.' });
    await prisma.$transaction(
      scenario.schedules.map((schedule) =>
        prisma.exam.update({
          where: { id: schedule.examId },
          data: {
            date: schedule.date,
            startTime: schedule.startTime,
            endTime: schedule.endTime,
            durationMinutes: schedule.durationMinutes,
            status: 'APPROVED',
          },
        }),
      ),
    );
    const data = await prisma.planningScenario.update({
      where: { id: req.params.id },
      data: { status: 'APPROVED', approvedAt: new Date() },
    });
    res.json({ success: true, data });
  }),
);

module.exports = router;
