const express = require('express');
const prisma = require('../config/prisma');
const asyncHandler = require('../utils/asyncHandler');
const { requireRole } = require('../middleware/auth');
const { generateInsight } = require('../services/aiService');

const router = express.Router();

router.post('/scenarios/:id/insights', requireRole('ADMIN', 'DEPARTMENT_MANAGER'), asyncHandler(async (req, res) => res.status(201).json({ success: true, data: await generateInsight(req.params.id) })));

router.get(
  '/scenarios/:id/insights',
  requireRole('ADMIN', 'DEPARTMENT_MANAGER'),
  asyncHandler(async (req, res) => {
    const data = await prisma.aiInsight.findMany({ where: { scenarioId: req.params.id }, orderBy: { createdAt: 'desc' } });
    res.json({ success: true, count: data.length, data });
  }),
);

module.exports = router;
