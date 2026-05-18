const express = require('express');
const prisma = require('../config/prisma');
const asyncHandler = require('../utils/asyncHandler');
const { scenarioWhereForUser } = require('../utils/scenarioAccess');
const { buildOperationalItems } = require('../services/operationService');

const router = express.Router();

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const departmentWhere = req.user.role === 'DEPARTMENT_MANAGER' ? { departmentId: req.user.departmentId || '__forbidden__' } : {};
    const studentWhere = req.user.role === 'STUDENT' ? { userId: req.user.id } : departmentWhere;
    const courseWhere = req.user.role === 'INSTRUCTOR' ? { instructorId: req.user.id } : req.user.role === 'STUDENT' ? { enrollments: { some: { student: { userId: req.user.id } } } } : departmentWhere;
    const invigilatorWhere = req.user.role === 'INVIGILATOR' ? { userId: req.user.id } : departmentWhere;
    const examWhere = req.user.role === 'INSTRUCTOR'
      ? { course: { instructorId: req.user.id } }
      : req.user.role === 'STUDENT'
        ? { course: { enrollments: { some: { student: { userId: req.user.id } } } } }
        : req.user.role === 'INVIGILATOR'
          ? { invigilators: { some: { invigilator: { userId: req.user.id } } } }
          : req.user.role === 'DEPARTMENT_MANAGER'
            ? { course: { departmentId: req.user.departmentId || '__forbidden__' } }
            : {};
    const [students, courses, classrooms, invigilators, exams, scenarios, operationalItems] = await Promise.all([
      prisma.student.count({ where: studentWhere }),
      prisma.course.count({ where: courseWhere }),
      prisma.classroom.count(),
      prisma.invigilator.count({ where: invigilatorWhere }),
      prisma.exam.count({ where: examWhere }),
      ['ADMIN', 'DEPARTMENT_MANAGER', 'INSTRUCTOR', 'INVIGILATOR', 'STUDENT'].includes(req.user.role)
        ? prisma.planningScenario.findMany({ where: scenarioWhereForUser(req.user), orderBy: { createdAt: 'desc' }, take: 5, include: { period: true } })
        : [],
      buildOperationalItems(req.user),
    ]);

    const warningCount = scenarios.reduce((sum, scenario) => sum + (Array.isArray(scenario.warnings) ? scenario.warnings.length : 0), 0);

    res.json({
      success: true,
      data: {
        counts: { students, courses, classrooms, invigilators, exams },
        warningCount,
        scenarios,
        operationalItems,
      },
    });
  }),
);

module.exports = router;
