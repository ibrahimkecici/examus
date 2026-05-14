const express = require('express');
const bcrypt = require('bcryptjs');
const prisma = require('../config/prisma');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth, signToken } = require('../middleware/auth');

const router = express.Router();

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password || '', user.passwordHash))) {
      return res.status(401).json({ success: false, message: 'E-posta veya şifre hatalı.' });
    }

    const safeUser = { id: user.id, name: user.name, email: user.email, role: user.role, department: user.department };
    res.json({ success: true, token: signToken(user), data: safeUser });
  }),
);

router.get('/me', requireAuth, (req, res) => {
  res.json({ success: true, data: req.user });
});

router.post(
  '/change-password',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user || !(await bcrypt.compare(currentPassword || '', user.passwordHash))) {
      return res.status(400).json({ success: false, message: 'Mevcut şifre hatalı.' });
    }
    await prisma.user.update({
      where: { id: req.user.id },
      data: { passwordHash: await bcrypt.hash(newPassword, 10) },
    });
    res.json({ success: true });
  }),
);

router.post(
  '/bootstrap-admin',
  asyncHandler(async (req, res) => {
    const existing = await prisma.user.count();
    if (existing > 0) return res.status(409).json({ success: false, message: 'İlk kullanıcı zaten oluşturulmuş.' });
    const password = req.body.password || 'Admin123!';
    const user = await prisma.user.create({
      data: {
        name: req.body.name || 'Admin',
        email: req.body.email || 'admin@examus.local',
        role: 'ADMIN',
        passwordHash: await bcrypt.hash(password, 10),
      },
    });
    res.status(201).json({ success: true, token: signToken(user), data: { email: user.email, password } });
  }),
);

module.exports = router;
