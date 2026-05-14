const express = require('express');
const bcrypt = require('bcryptjs');
const prisma = require('../config/prisma');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const data = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, email: true, role: true, department: true, createdAt: true, updatedAt: true },
    });
    res.json({ success: true, count: data.length, data });
  }),
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = await prisma.user.create({
      data: {
        name: req.body.name,
        email: req.body.email,
        role: req.body.role || 'DEPARTMENT_MANAGER',
        department: req.body.department || null,
        passwordHash: await bcrypt.hash(req.body.password || 'Examus123!', 10),
      },
      select: { id: true, name: true, email: true, role: true, department: true },
    });
    res.status(201).json({ success: true, data });
  }),
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const payload = { ...req.body };
    if (payload.password) {
      payload.passwordHash = await bcrypt.hash(payload.password, 10);
      delete payload.password;
    }
    const data = await prisma.user.update({
      where: { id: req.params.id },
      data: payload,
      select: { id: true, name: true, email: true, role: true, department: true },
    });
    res.json({ success: true, data });
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await prisma.user.delete({ where: { id: req.params.id } });
    res.json({ success: true, data: {} });
  }),
);

module.exports = router;
