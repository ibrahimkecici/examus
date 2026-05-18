const express = require('express');
const multer = require('multer');
const prisma = require('../config/prisma');
const asyncHandler = require('../utils/asyncHandler');
const { requireRole } = require('../middleware/auth');
const { buildTemplateWorkbookBuffer, importClassrooms, importCourses, importInvigilators, importStudents, previewImport } = require('../services/importService');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.use(requireRole('ADMIN', 'DEPARTMENT_MANAGER'));

router.get('/templates/:type.xlsx', asyncHandler(async (req, res) => {
  if (req.params.type === 'classrooms' && req.user.role !== 'ADMIN') {
    return res.status(403).json({ success: false, message: 'Bu işlem için yetkiniz yok.' });
  }
  const buffer = buildTemplateWorkbookBuffer(req.params.type);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="examus-${req.params.type}-template.xlsx"`);
  res.send(buffer);
}));

router.post('/:type/preview', upload.single('file'), asyncHandler(async (req, res) => {
  const data = await previewImport(req.params.type, req.file, req);
  res.json({ success: true, data });
}));

router.post('/students', upload.single('file'), asyncHandler(async (req, res) => res.status(201).json({ success: true, data: await importStudents(req.file, req) })));
router.post('/courses', upload.single('file'), asyncHandler(async (req, res) => res.status(201).json({ success: true, data: await importCourses(req.file, req) })));
router.post('/classrooms', requireRole('ADMIN'), upload.single('file'), asyncHandler(async (req, res) => res.status(201).json({ success: true, data: await importClassrooms(req.file, req) })));
router.post('/invigilators', upload.single('file'), asyncHandler(async (req, res) => res.status(201).json({ success: true, data: await importInvigilators(req.file, req) })));

router.get(
  '/:id/errors',
  asyncHandler(async (req, res) => {
    const batch = await prisma.importBatch.findUnique({ where: { id: req.params.id } });
    if (!batch) return res.status(404).json({ success: false, message: 'Import kaydı bulunamadı.' });
    if (req.user.role !== 'ADMIN' && batch.entityType === 'classrooms') {
      return res.status(403).json({ success: false, message: 'Bu işlem için yetkiniz yok.' });
    }
    res.json({ success: true, data: batch.errors || [] });
  }),
);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const where = req.user.role === 'ADMIN' ? {} : { entityType: { in: ['students', 'courses', 'invigilators'] } };
    const data = await prisma.importBatch.findMany({ where, orderBy: { createdAt: 'desc' } });
    res.json({ success: true, count: data.length, data });
  }),
);

module.exports = router;
