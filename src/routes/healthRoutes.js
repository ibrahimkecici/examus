const express = require('express');
const mongoose = require('mongoose');

const router = express.Router();

const READY_STATE_LABELS = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting'
};

router.get('/', (req, res) => {
  const readyState = mongoose.connection.readyState;
  const readyStateLabel = READY_STATE_LABELS[readyState] || 'unknown';

  res.status(200).json({
    success: true,
    service: 'examoptim-api',
    env: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    db: {
      connected: readyState === 1,
      readyState,
      readyStateLabel
    }
  });
});

module.exports = router;
