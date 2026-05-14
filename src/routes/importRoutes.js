const express = require('express');
const multer = require('multer');
const prisma = require('../config/prisma');
const asyncHandler = require('../utils/asyncHandler');
const { importClassrooms, importCourses, importInvigilators, importStudents } = require('../services/importService');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.post('/students', upload.single('file'), asyncHandler(async (req, res) => res.status(201).json({ success: true, data: await importStudents(req.file) })));
router.post('/courses', upload.single('file'), asyncHandler(async (req, res) => res.status(201).json({ success: true, data: await importCourses(req.file) })));
router.post('/classrooms', upload.single('file'), asyncHandler(async (req, res) => res.status(201).json({ success: true, data: await importClassrooms(req.file) })));
router.post('/invigilators', upload.single('file'), asyncHandler(async (req, res) => res.status(201).json({ success: true, data: await importInvigilators(req.file) })));

router.get(
  '/:id/errors',
  asyncHandler(async (req, res) => {
    const batch = await prisma.importBatch.findUnique({ where: { id: req.params.id } });
    if (!batch) return res.status(404).json({ success: false, message: 'Import kaydı bulunamadı.' });
    res.json({ success: true, data: batch.errors || [] });
  }),
);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const data = await prisma.importBatch.findMany({ orderBy: { createdAt: 'desc' } });
    res.json({ success: true, count: data.length, data });
  }),
);

module.exports = router;
