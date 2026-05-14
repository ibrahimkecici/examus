const express = require('express');
const prisma = require('../config/prisma');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const [students, courses, classrooms, invigilators, exams, scenarios] = await Promise.all([
      prisma.student.count(),
      prisma.course.count(),
      prisma.classroom.count(),
      prisma.invigilator.count(),
      prisma.exam.count(),
      prisma.planningScenario.findMany({ orderBy: { createdAt: 'desc' }, take: 5, include: { period: true } }),
    ]);

    const warningCount = scenarios.reduce((sum, scenario) => sum + (Array.isArray(scenario.warnings) ? scenario.warnings.length : 0), 0);

    res.json({
      success: true,
      data: {
        counts: { students, courses, classrooms, invigilators, exams },
        warningCount,
        scenarios,
      },
    });
  }),
);

module.exports = router;
