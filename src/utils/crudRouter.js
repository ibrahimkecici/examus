const express = require('express');
const asyncHandler = require('./asyncHandler');
const prisma = require('../config/prisma');
const { assertResourceWrite, resourceReadWhere } = require('./accessControl');

function scopedWhere(modelName, req, extra = {}) {
  const base = resourceReadWhere(modelName, req);
  const parts = [base, extra].filter((part) => part && Object.keys(part).length);
  if (parts.length === 0) return {};
  if (parts.length === 1) return parts[0];
  return { AND: parts };
}

function crudRouter(modelName, options = {}) {
  const router = express.Router();
  const model = prisma[modelName];
  const include = options.include;
  const orderBy = options.orderBy || { createdAt: 'desc' };

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const data = await model.findMany({ where: scopedWhere(modelName, req), include, orderBy });
      res.json({ success: true, count: data.length, data });
    }),
  );

  router.get(
    '/:id',
    asyncHandler(async (req, res) => {
      const data = await model.findFirst({ where: scopedWhere(modelName, req, { id: req.params.id }), include });
      if (!data) return res.status(404).json({ success: false, message: 'Kayıt bulunamadı.' });
      res.json({ success: true, data });
    }),
  );

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      assertResourceWrite(modelName, req);
      const data = await model.create({ data: options.mapCreate ? await options.mapCreate(req.body, req) : req.body, include });
      res.status(201).json({ success: true, data });
    }),
  );

  router.put(
    '/:id',
    asyncHandler(async (req, res) => {
      const existing = await model.findFirst({ where: scopedWhere(modelName, req, { id: req.params.id }), include });
      if (!existing) return res.status(404).json({ success: false, message: 'Kayıt bulunamadı.' });
      assertResourceWrite(modelName, req, existing);
      const data = await model.update({
        where: { id: req.params.id },
        data: options.mapUpdate ? await options.mapUpdate(req.body, req, existing) : req.body,
        include,
      });
      res.json({ success: true, data });
    }),
  );

  router.delete(
    '/:id',
    asyncHandler(async (req, res) => {
      const existing = await model.findFirst({ where: scopedWhere(modelName, req, { id: req.params.id }), include });
      if (!existing) return res.status(404).json({ success: false, message: 'Kayıt bulunamadı.' });
      assertResourceWrite(modelName, req, existing);
      await model.delete({ where: { id: req.params.id } });
      res.json({ success: true, data: {} });
    }),
  );

  return router;
}

module.exports = crudRouter;
