const express = require('express');
const prisma = require('../config/prisma');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

router.patch(
  '/exams/:id/schedule',
  asyncHandler(async (req, res) => {
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
    res.json({ success: true, data });
  }),
);

router.patch(
  '/seat-assignments/:id',
  asyncHandler(async (req, res) => {
    const data = await prisma.seatAssignment.update({
      where: { id: req.params.id },
      data: { seatId: req.body.seatId, locked: req.body.locked === undefined ? undefined : Boolean(req.body.locked) },
      include: { student: true, seat: true, exam: { include: { course: true } } },
    });
    res.json({ success: true, data });
  }),
);

module.exports = router;
