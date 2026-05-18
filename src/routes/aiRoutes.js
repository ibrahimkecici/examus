const express = require('express');
const prisma = require('../config/prisma');
const asyncHandler = require('../utils/asyncHandler');
const { requireRole } = require('../middleware/auth');
const { generateInsight } = require('../services/aiService');
const { scenarioWhereForUser } = require('../utils/scenarioAccess');

const router = express.Router();

router.post('/scenarios/:id/insights', requireRole('ADMIN', 'DEPARTMENT_MANAGER'), asyncHandler(async (req, res) => res.status(201).json({ success: true, data: await generateInsight(req.params.id) })));

router.delete(
  '/insights/:id',
  requireRole('ADMIN', 'DEPARTMENT_MANAGER'),
  asyncHandler(async (req, res) => {
    const insight = await prisma.aiInsight.findUnique({ where: { id: req.params.id } });
    if (!insight) return res.status(404).json({ success: false, message: 'AI önerisi bulunamadı.' });
    const visibleScenario = await prisma.planningScenario.findFirst({ where: { id: insight.scenarioId, ...scenarioWhereForUser(req.user) }, select: { id: true } });
    if (!visibleScenario) {
      return res.status(403).json({ success: false, message: 'Bu işlem için yetkiniz yok.' });
    }
    await prisma.aiInsight.delete({ where: { id: req.params.id } });
    res.json({ success: true, data: {} });
  }),
);

router.get(
  '/scenarios/:id/insights',
  requireRole('ADMIN', 'DEPARTMENT_MANAGER'),
  asyncHandler(async (req, res) => {
    const data = await prisma.aiInsight.findMany({ where: { scenarioId: req.params.id }, orderBy: { createdAt: 'desc' } });
    res.json({ success: true, count: data.length, data });
  }),
);

module.exports = router;
