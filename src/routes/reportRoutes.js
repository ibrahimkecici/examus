const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { buildCalendarWorkbook, streamPdf } = require('../services/reportService');

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
    res.setHeader('Content-Disposition', `attachment; filename="examus-${req.params.id}.pdf"`);
    await streamPdf(req.params.id, res);
  }),
);

router.get('/scenarios/:id/students.xlsx', asyncHandler(async (req, res) => {
  const workbook = await buildCalendarWorkbook(req.params.id);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="examus-students-${req.params.id}.xlsx"`);
  await workbook.xlsx.write(res);
  res.end();
}));

router.get('/scenarios/:id/classrooms.xlsx', asyncHandler(async (req, res) => {
  const workbook = await buildCalendarWorkbook(req.params.id);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="examus-classrooms-${req.params.id}.xlsx"`);
  await workbook.xlsx.write(res);
  res.end();
}));

router.get('/scenarios/:id/invigilators.xlsx', asyncHandler(async (req, res) => {
  const workbook = await buildCalendarWorkbook(req.params.id);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="examus-invigilators-${req.params.id}.xlsx"`);
  await workbook.xlsx.write(res);
  res.end();
}));

module.exports = router;
