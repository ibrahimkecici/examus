const express = require('express');
const asyncHandler = require('./asyncHandler');
const prisma = require('../config/prisma');

function crudRouter(modelName, options = {}) {
  const router = express.Router();
  const model = prisma[modelName];
  const include = options.include;
  const orderBy = options.orderBy || { createdAt: 'desc' };

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const data = await model.findMany({ include, orderBy });
      res.json({ success: true, count: data.length, data });
    }),
  );

  router.get(
    '/:id',
    asyncHandler(async (req, res) => {
      const data = await model.findUnique({ where: { id: req.params.id }, include });
      if (!data) return res.status(404).json({ success: false, message: 'Kayıt bulunamadı.' });
      res.json({ success: true, data });
    }),
  );

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const data = await model.create({ data: options.mapCreate ? options.mapCreate(req.body) : req.body, include });
      res.status(201).json({ success: true, data });
    }),
  );

  router.put(
    '/:id',
    asyncHandler(async (req, res) => {
      const data = await model.update({
        where: { id: req.params.id },
        data: options.mapUpdate ? options.mapUpdate(req.body) : req.body,
        include,
      });
      res.json({ success: true, data });
    }),
  );

  router.delete(
    '/:id',
    asyncHandler(async (req, res) => {
      await model.delete({ where: { id: req.params.id } });
      res.json({ success: true, data: {} });
    }),
  );

  return router;
}

module.exports = crudRouter;
