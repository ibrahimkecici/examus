const express = require('express');
const prisma = require('../config/prisma');

const router = express.Router();

router.get('/', async (req, res) => {
  let connected = false;

  try {
    await prisma.$queryRaw`SELECT 1`;
    connected = true;
  } catch (error) {
    connected = false;
  }

  res.status(200).json({
    success: true,
    service: 'examus-api',
    env: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    db: {
      connected,
      provider: 'postgresql',
    },
  });
});

module.exports = router;
