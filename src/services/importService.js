const { parse } = require('csv-parse/sync');
const XLSX = require('xlsx');
const prisma = require('../config/prisma');

function readRows(file) {
  if (!file) {
    const error = new Error('Dosya yüklenmedi.');
    error.status = 400;
    throw error;
  }

  if (file.originalname.endsWith('.csv')) {
    return parse(file.buffer, { columns: true, skip_empty_lines: true, trim: true });
  }

  const workbook = XLSX.read(file.buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { defval: '' });
}

function value(row, keys) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '') return String(row[key]).trim();
  }
  return '';
}

function numberValue(row, keys, fallback = null) {
  const raw = value(row, keys);
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function bookletValue(row, keys) {
  const raw = value(row, keys);
  if (!raw) return null;
  // Accept JSON array, comma-separated, or slash-separated: "A,B" / "A/B/C/D" / ["A","B"]
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
  } catch {
    // ignore
  }
  return raw.split(/[,\/]/).map((s) => s.trim().toUpperCase()).filter(Boolean);
}

function jsonValue(row, keys) {
  const raw = value(row, keys);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return raw
      .split(/[;,]/)
      .map((item) => item.trim())
      .filter(Boolean)
      .reduce((features, feature) => ({ ...features, [feature]: true }), {});
  }
}

async function importStudents(file) {
  const rows = readRows(file);
  const errors = [];
  let successRows = 0;

  const batch = await prisma.importBatch.create({
    data: { entityType: 'students', fileName: file.originalname, totalRows: rows.length },
  });

  for (const [index, row] of rows.entries()) {
    const studentNo = value(row, ['studentNo', 'ogrenciNo', 'Öğrenci No', 'numara']);
    const fullName = value(row, ['fullName', 'adSoyad', 'Ad Soyad', 'ad_soyad']);
    const department = value(row, ['department', 'bolum', 'Bölüm']) || 'Genel';
    const courseCodes = value(row, ['courses', 'dersler', 'Dersler'])
      .split(/[;,]/)
      .map((item) => item.trim())
      .filter(Boolean);

    if (!studentNo || !fullName) {
      errors.push({ row: index + 2, message: 'Öğrenci numarası ve ad soyad zorunludur.' });
      continue;
    }

    try {
      const student = await prisma.student.upsert({
        where: { studentNo },
        update: { fullName, department, specialNeeds: value(row, ['specialNeeds', 'ozelDurum', 'Özel Durum']) || null },
        create: { studentNo, fullName, department, specialNeeds: value(row, ['specialNeeds', 'ozelDurum', 'Özel Durum']) || null },
      });

      for (const code of courseCodes) {
        const course = await prisma.course.findUnique({ where: { code } });
        if (course) {
          await prisma.courseEnrollment.upsert({
            where: { studentId_courseId: { studentId: student.id, courseId: course.id } },
            update: {},
            create: { studentId: student.id, courseId: course.id },
          });
        }
      }
      successRows += 1;
    } catch (error) {
      errors.push({ row: index + 2, message: error.message });
    }
  }

  return prisma.importBatch.update({
    where: { id: batch.id },
    data: {
      status: errors.length ? 'COMPLETED_WITH_ERRORS' : 'COMPLETED',
      successRows,
      errorRows: errors.length,
      errors,
    },
  });
}

async function importCourses(file) {
  const rows = readRows(file);
  const errors = [];
  let successRows = 0;
  const batch = await prisma.importBatch.create({ data: { entityType: 'courses', fileName: file.originalname, totalRows: rows.length } });

  for (const [index, row] of rows.entries()) {
    const code = value(row, ['code', 'dersKodu', 'Ders Kodu']);
    const name = value(row, ['name', 'dersAd', 'Ders Adı']);
    if (!code || !name) {
      errors.push({ row: index + 2, message: 'Ders kodu ve ders adı zorunludur.' });
      continue;
    }

    const courseData = {
      name,
      instructorName: value(row, ['instructorName', 'ogretimElemani', 'Öğretim Elemanı']) || null,
      department: value(row, ['department', 'bolum', 'Bölüm']) || null,
      studentCount: Number(value(row, ['studentCount', 'ogrenciSayisi', 'Öğrenci Sayısı'])) || 0,
      durationMinutes: Number(value(row, ['durationMinutes', 'sure', 'Süre'])) || 120,
      requiredRoomType: value(row, ['requiredRoomType', 'roomType', 'derslikTipi', 'Derslik Tipi']) || null,
      requiredFeatures: jsonValue(row, ['requiredFeatures', 'features', 'ozellikler', 'Özellikler']),
      specialRules: jsonValue(row, ['specialRules', 'kurallar', 'Kurallar']),
      bookletTypes: bookletValue(row, ['bookletTypes', 'kitapciklar', 'Kitapçıklar', 'kitapçıklar']),
    };
    await prisma.course.upsert({
      where: { code },
      update: courseData,
      create: { code, ...courseData },
    });
    successRows += 1;
  }

  return prisma.importBatch.update({ where: { id: batch.id }, data: { status: errors.length ? 'COMPLETED_WITH_ERRORS' : 'COMPLETED', successRows, errorRows: errors.length, errors } });
}

async function importClassrooms(file) {
  const rows = readRows(file);
  const errors = [];
  let successRows = 0;
  const batch = await prisma.importBatch.create({ data: { entityType: 'classrooms', fileName: file.originalname, totalRows: rows.length } });

  for (const [index, row] of rows.entries()) {
    const code = value(row, ['code', 'derslikKodu', 'Sınıf Kodu']);
    const name = value(row, ['name', 'ad', 'Sınıf Adı']) || code;
    const capacity = Number(value(row, ['capacity', 'kapasite', 'Kapasite']));
    if (!code || !capacity) {
      errors.push({ row: index + 2, message: 'Sınıf kodu ve kapasite zorunludur.' });
      continue;
    }
    const classroom = await prisma.classroom.upsert({
      where: { code },
      update: {
        name,
        capacity,
        examCapacity: numberValue(row, ['examCapacity', 'sinavKapasitesi', 'Sınav Kapasitesi']),
        roomType: value(row, ['roomType', 'derslikTipi', 'Derslik Tipi']) || null,
        features: jsonValue(row, ['features', 'ozellikler', 'Özellikler']),
        building: value(row, ['building', 'bina', 'Bina']) || null,
        floor: value(row, ['floor', 'kat', 'Kat']) || null,
      },
      create: {
        code,
        name,
        capacity,
        examCapacity: numberValue(row, ['examCapacity', 'sinavKapasitesi', 'Sınav Kapasitesi']),
        roomType: value(row, ['roomType', 'derslikTipi', 'Derslik Tipi']) || null,
        features: jsonValue(row, ['features', 'ozellikler', 'Özellikler']),
        building: value(row, ['building', 'bina', 'Bina']) || null,
        floor: value(row, ['floor', 'kat', 'Kat']) || null,
        rowCount: Math.ceil(capacity / 6),
        columnCount: Math.min(6, capacity),
      },
    });
    const seatCount = await prisma.seat.count({ where: { classroomId: classroom.id } });
    if (seatCount === 0) {
      const columnCount = Math.min(6, capacity);
      await prisma.seat.createMany({
        data: Array.from({ length: capacity }, (_, index) => ({
          classroomId: classroom.id,
          label: `${String.fromCharCode(65 + Math.floor(index / columnCount))}${(index % columnCount) + 1}`,
          row: Math.floor(index / columnCount) + 1,
          column: (index % columnCount) + 1,
          status: 'AKTIF',
          capacity: 1,
        })),
      });
    }
    successRows += 1;
  }

  return prisma.importBatch.update({ where: { id: batch.id }, data: { status: errors.length ? 'COMPLETED_WITH_ERRORS' : 'COMPLETED', successRows, errorRows: errors.length, errors } });
}

async function importInvigilators(file) {
  const rows = readRows(file);
  const errors = [];
  let successRows = 0;
  const batch = await prisma.importBatch.create({ data: { entityType: 'invigilators', fileName: file.originalname, totalRows: rows.length } });

  for (const [index, row] of rows.entries()) {
    const staffNo = value(row, ['staffNo', 'sicilNo', 'Sicil No']);
    const firstName = value(row, ['firstName', 'ad', 'Ad']);
    const lastName = value(row, ['lastName', 'soyad', 'Soyad']);
    if (!staffNo || !firstName || !lastName) {
      errors.push({ row: index + 2, message: 'Sicil no, ad ve soyad zorunludur.' });
      continue;
    }
    await prisma.invigilator.upsert({
      where: { staffNo },
      update: {
        firstName,
        lastName,
        title: value(row, ['title', 'unvan', 'Unvan']) || null,
        email: value(row, ['email', 'Email']) || null,
        department: value(row, ['department', 'bolum', 'Bölüm']) || null,
        maxAssignments: numberValue(row, ['maxAssignments', 'maksGorev', 'Maks Görev'], 4),
        priority: numberValue(row, ['priority', 'oncelik', 'Öncelik'], 0),
        constraints: jsonValue(row, ['constraints', 'kisitlar', 'Kısıtlar']),
      },
      create: {
        staffNo,
        firstName,
        lastName,
        title: value(row, ['title', 'unvan', 'Unvan']) || null,
        email: value(row, ['email', 'Email']) || null,
        department: value(row, ['department', 'bolum', 'Bölüm']) || null,
        maxAssignments: numberValue(row, ['maxAssignments', 'maksGorev', 'Maks Görev'], 4),
        priority: numberValue(row, ['priority', 'oncelik', 'Öncelik'], 0),
        constraints: jsonValue(row, ['constraints', 'kisitlar', 'Kısıtlar']),
      },
    });
    successRows += 1;
  }

  return prisma.importBatch.update({ where: { id: batch.id }, data: { status: errors.length ? 'COMPLETED_WITH_ERRORS' : 'COMPLETED', successRows, errorRows: errors.length, errors } });
}

module.exports = { importClassrooms, importCourses, importInvigilators, importStudents };
