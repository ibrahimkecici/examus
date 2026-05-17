const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requireRole } = require('../middleware/auth');
const { buildCalendarWorkbook, buildScenarioWorkbook, streamPdf, streamScenarioExamPdf, streamScenarioPdf } = require('../services/reportService');

const router = express.Router();
router.use(requireRole('ADMIN', 'DEPARTMENT_MANAGER'));

router.get(
  '/scenarios/:id/calendar.xlsx',
  asyncHandler(async (req, res) => {
    const workbook = await buildScenarioWorkbook(req.params.id, 'calendar', req.user);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="examus-${req.params.id}.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
  }),
);

router.get(
  '/scenarios/:id/calendar.pdf',
  asyncHandler(async (req, res) => {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="examus-calendar-${req.params.id}.pdf"`);
    await streamScenarioPdf(req.params.id, res, 'calendar', req.user);
  }),
);

router.get(
  '/scenarios/:id/full.pdf',
  asyncHandler(async (req, res) => {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="examus-full-${req.params.id}.pdf"`);
    await streamScenarioPdf(req.params.id, res, 'full', req.user);
  }),
);

router.get(
  '/scenarios/:id/classrooms.pdf',
  asyncHandler(async (req, res) => {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="examus-classrooms-${req.params.id}.pdf"`);
    await streamScenarioPdf(req.params.id, res, 'classrooms', req.user);
  }),
);

router.get(
  '/scenarios/:id/students.pdf',
  asyncHandler(async (req, res) => {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="examus-students-${req.params.id}.pdf"`);
    await streamScenarioPdf(req.params.id, res, 'students', req.user);
  }),
);

router.get(
  '/scenarios/:id/invigilators.pdf',
  asyncHandler(async (req, res) => {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="examus-invigilators-${req.params.id}.pdf"`);
    await streamScenarioPdf(req.params.id, res, 'invigilators', req.user);
  }),
);

router.get(
  '/scenarios/:id/exams/:examId.pdf',
  asyncHandler(async (req, res) => {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="examus-exam-${req.params.examId}-${req.params.id}.pdf"`);
    await streamScenarioExamPdf(req.params.id, req.params.examId, res, req.user);
  }),
);

router.get('/scenarios/:id/students.xlsx', asyncHandler(async (req, res) => {
  const workbook = await buildScenarioWorkbook(req.params.id, 'students', req.user);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="examus-students-${req.params.id}.xlsx"`);
  await workbook.xlsx.write(res);
  res.end();
}));

router.get('/scenarios/:id/classrooms.xlsx', asyncHandler(async (req, res) => {
  const workbook = await buildScenarioWorkbook(req.params.id, 'classrooms', req.user);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="examus-classrooms-${req.params.id}.xlsx"`);
  await workbook.xlsx.write(res);
  res.end();
}));

router.get('/scenarios/:id/invigilators.xlsx', asyncHandler(async (req, res) => {
  const workbook = await buildScenarioWorkbook(req.params.id, 'invigilators', req.user);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="examus-invigilators-${req.params.id}.xlsx"`);
  await workbook.xlsx.write(res);
  res.end();
}));

module.exports = router;
