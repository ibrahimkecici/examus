const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { getExamOperation } = require('../services/operationService');

const router = express.Router();

router.get(
  '/:id/operations',
  asyncHandler(async (req, res) => {
    const data = await getExamOperation(req.params.id, req.user, req.query.scenarioId || null);
    res.json({ success: true, data });
  }),
);

module.exports = router;
