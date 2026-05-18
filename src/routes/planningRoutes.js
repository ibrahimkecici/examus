const express = require('express');
const prisma = require('../config/prisma');
const asyncHandler = require('../utils/asyncHandler');
const { requireRole } = require('../middleware/auth');
const { filterScenarioForUser, scenarioWhereForUser } = require('../utils/scenarioAccess');
const { recheckScenario, runScenario } = require('../services/planningService');
const { writeAuditLog } = require('../utils/auditLog');

const router = express.Router();

function numberMetric(metrics, keys) {
  for (const key of keys) {
    const value = Number(metrics?.[key]);
    if (Number.isFinite(value)) return value;
  }
  return null;
}

function comparisonMetrics(scenario) {
  const metrics = scenario?.metrics || {};
  return {
    score: Number(scenario?.score ?? 0),
    physicalUtilization: numberMetric(metrics, ['averagePhysicalRoomUtilization', 'physicalRoomUtilization']),
    examCapacityUtilization: numberMetric(metrics, ['averageExamCapacityUtilization', 'examCapacityUtilization']),
    unusedCapacity: numberMetric(metrics, ['totalPhysicalUnusedCapacity', 'totalUnusedCapacity']),
    invigilatorLoad: numberMetric(metrics, ['invigilatorLoadImbalance', 'invigilatorFairnessPenalty']),
    studentLoad: numberMetric(metrics, ['studentDailyLoadPenalty', 'sameDayStudentPenalty']),
    backToBackLoad: numberMetric(metrics, ['backToBackPenalty', 'studentBackToBackPenalty']),
  };
}

function buildComparison(current, previous) {
  if (!previous) return { previous: null, metrics: comparisonMetrics(current), deltas: null };
  const currentMetrics = comparisonMetrics(current);
  const previousMetrics = comparisonMetrics(previous);
  const deltas = {};
  for (const key of Object.keys(currentMetrics)) {
    deltas[key] = currentMetrics[key] == null || previousMetrics[key] == null ? null : currentMetrics[key] - previousMetrics[key];
  }
  return {
    previous: {
      id: previous.id,
      name: previous.name,
      status: previous.status,
      strategy: previous.strategy,
      score: previous.score,
      createdAt: previous.createdAt,
      approvedAt: previous.approvedAt,
    },
    metrics: currentMetrics,
    previousMetrics,
    deltas,
  };
}

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
  requireRole('ADMIN', 'DEPARTMENT_MANAGER', 'INSTRUCTOR', 'INVIGILATOR', 'STUDENT'),
  asyncHandler(async (req, res) => {
    const data = await prisma.planningScenario.findMany({ where: scenarioWhereForUser(req.user), include: { period: true }, orderBy: { createdAt: 'desc' } });
    res.json({ success: true, count: data.length, data });
  }),
);

router.get(
  '/scenarios/:id',
  requireRole('ADMIN', 'DEPARTMENT_MANAGER', 'INSTRUCTOR', 'INVIGILATOR', 'STUDENT'),
  asyncHandler(async (req, res) => {
    const data = await prisma.planningScenario.findUnique({
      where: { id: req.params.id },
      include: {
        period: true,
        schedules: { include: { exam: { include: { course: true } } } },
        roomSlots: { include: { classroom: true, assignments: { include: { exam: { include: { course: true } } } } } },
        rooms: { include: { classroom: true, exam: { include: { course: true } } } },
        seats: { include: { student: true, seat: true, exam: { include: { course: true } }, classroom: { include: { seats: { orderBy: [{ row: 'asc' }, { column: 'asc' }] } } } } },
        invigilators: { include: { invigilator: true, exam: { include: { course: true } } } },
        insights: true,
      },
    });
    if (!data) return res.status(404).json({ success: false, message: 'Planlama senaryosu bulunamadı.' });
    const scoped = filterScenarioForUser(data, req.user);
    if (!scoped) return res.status(404).json({ success: false, message: 'Planlama senaryosu bulunamadı.' });
    res.json({ success: true, data: scoped });
  }),
);

router.get(
  '/scenarios/:id/comparison',
  requireRole('ADMIN', 'DEPARTMENT_MANAGER', 'INSTRUCTOR', 'INVIGILATOR', 'STUDENT'),
  asyncHandler(async (req, res) => {
    const current = await prisma.planningScenario.findUnique({ where: { id: req.params.id }, include: { period: true } });
    if (!current) return res.status(404).json({ success: false, message: 'Planlama senaryosu bulunamadı.' });
    if (req.user.role !== 'ADMIN') {
      const visible = await prisma.planningScenario.findFirst({ where: { id: current.id, ...scenarioWhereForUser(req.user) }, select: { id: true } });
      if (!visible) return res.status(404).json({ success: false, message: 'Planlama senaryosu bulunamadı.' });
    }
    const previous = await prisma.planningScenario.findFirst({
      where: {
        ...scenarioWhereForUser(req.user),
        id: { not: current.id },
        periodId: current.periodId,
        status: { in: ['APPROVED', 'COMPLETED'] },
        createdAt: { lt: current.createdAt },
      },
      orderBy: [{ approvedAt: 'desc' }, { createdAt: 'desc' }],
    });
    res.json({ success: true, data: buildComparison(current, previous) });
  }),
);

router.post(
  '/scenarios/:id/run',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    try {
      const data = await runScenario(req.params.id);
      await writeAuditLog(req, { action: 'PLANNING_RUN', entity: 'PlanningScenario', entityId: req.params.id, metadata: { status: data.status, score: data.score, strategy: data.strategy } });
      res.json({ success: true, data });
    } catch (error) {
      const data = await prisma.planningScenario.update({
        where: { id: req.params.id },
        data: {
          status: 'FAILED',
          warnings: [{ type: 'PLANNING_RUN_ERROR', severity: 'hard', message: error.message || 'Planlama çalıştırması tamamlanamadı.' }],
        },
      });
      await writeAuditLog(req, { action: 'PLANNING_RUN_FAILED', entity: 'PlanningScenario', entityId: req.params.id, metadata: { message: error.message } });
      res.status(500).json({ success: false, message: error.message || 'Planlama çalıştırması tamamlanamadı.', data });
    }
  }),
);
router.post('/scenarios/:id/recheck', requireRole('ADMIN'), asyncHandler(async (req, res) => {
  const data = await recheckScenario(req.params.id);
  await writeAuditLog(req, { action: 'PLANNING_RECHECK', entity: 'PlanningScenario', entityId: req.params.id, metadata: { status: data.status, warningCount: (data.warnings || []).length } });
  res.json({ success: true, data });
}));

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
    await writeAuditLog(req, { action: 'PLANNING_APPROVE', entity: 'PlanningScenario', entityId: req.params.id, metadata: { scheduleCount: scenario.schedules.length } });
    res.json({ success: true, data });
  }),
);

module.exports = router;
