const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { buildCalendarWorkbook, buildScenarioWorkbook, streamPdf, streamScenarioExamPdf, streamScenarioPdf } = require('../services/reportService');

const router = express.Router();

router.get(
  '/scenarios/:id/calendar.xlsx',
  asyncHandler(async (req, res) => {
    const workbook = await buildCalendarWorkbook(req.params.id);
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
    await streamPdf(req.params.id, res);
  }),
);

router.get(
  '/scenarios/:id/full.pdf',
  asyncHandler(async (req, res) => {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="examus-full-${req.params.id}.pdf"`);
    await streamScenarioPdf(req.params.id, res, 'full');
  }),
);

router.get(
  '/scenarios/:id/classrooms.pdf',
  asyncHandler(async (req, res) => {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="examus-classrooms-${req.params.id}.pdf"`);
    await streamScenarioPdf(req.params.id, res, 'classrooms');
  }),
);

router.get(
  '/scenarios/:id/students.pdf',
  asyncHandler(async (req, res) => {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="examus-students-${req.params.id}.pdf"`);
    await streamScenarioPdf(req.params.id, res, 'students');
  }),
);

router.get(
  '/scenarios/:id/invigilators.pdf',
  asyncHandler(async (req, res) => {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="examus-invigilators-${req.params.id}.pdf"`);
    await streamScenarioPdf(req.params.id, res, 'invigilators');
  }),
);

router.get(
  '/scenarios/:id/exams/:examId.pdf',
  asyncHandler(async (req, res) => {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="examus-exam-${req.params.examId}-${req.params.id}.pdf"`);
    await streamScenarioExamPdf(req.params.id, req.params.examId, res);
  }),
);

router.get('/scenarios/:id/students.xlsx', asyncHandler(async (req, res) => {
  const workbook = await buildScenarioWorkbook(req.params.id, 'students');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="examus-students-${req.params.id}.xlsx"`);
  await workbook.xlsx.write(res);
  res.end();
}));

router.get('/scenarios/:id/classrooms.xlsx', asyncHandler(async (req, res) => {
  const workbook = await buildScenarioWorkbook(req.params.id, 'classrooms');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="examus-classrooms-${req.params.id}.xlsx"`);
  await workbook.xlsx.write(res);
  res.end();
}));

router.get('/scenarios/:id/invigilators.xlsx', asyncHandler(async (req, res) => {
  const workbook = await buildScenarioWorkbook(req.params.id, 'invigilators');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="examus-invigilators-${req.params.id}.xlsx"`);
  await workbook.xlsx.write(res);
  res.end();
}));

module.exports = router;
