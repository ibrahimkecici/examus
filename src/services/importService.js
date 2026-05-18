const { parse } = require('csv-parse/sync');
const XLSX = require('xlsx');
const bcrypt = require('bcryptjs');
const prisma = require('../config/prisma');
const { syncCourseStudentCounts } = require('./courseStatsService');
const { normalizeDepartmentCode, resolveDepartment } = require('../utils/departmentResolver');

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

const IMPORT_SCHEMAS = {
  students: {
    required: [['studentNo', 'ogrenciNo', 'Öğrenci No', 'numara'], ['fullName', 'adSoyad', 'Ad Soyad', 'ad_soyad']],
    known: ['studentNo', 'ogrenciNo', 'Öğrenci No', 'numara', 'fullName', 'adSoyad', 'Ad Soyad', 'ad_soyad', 'department', 'bolum', 'Bölüm', 'courses', 'dersler', 'Dersler', 'specialNeeds', 'ozelDurum', 'Özel Durum'],
  },
  courses: {
    required: [['code', 'dersKodu', 'Ders Kodu'], ['name', 'dersAd', 'Ders Adı']],
    known: ['code', 'dersKodu', 'Ders Kodu', 'name', 'dersAd', 'Ders Adı', 'instructorName', 'ogretimElemani', 'Öğretim Elemanı', 'department', 'bolum', 'Bölüm', 'studentCount', 'ogrenciSayisi', 'Öğrenci Sayısı', 'durationMinutes', 'sure', 'Süre', 'requiredRoomType', 'roomType', 'derslikTipi', 'Derslik Tipi', 'requiredFeatures', 'features', 'ozellikler', 'Özellikler', 'specialRules', 'kurallar', 'Kurallar', 'bookletTypes', 'kitapciklar', 'Kitapçıklar', 'kitapçıklar'],
  },
  classrooms: {
    required: [['code', 'derslikKodu', 'Sınıf Kodu'], ['capacity', 'kapasite', 'Kapasite']],
    known: ['code', 'derslikKodu', 'Sınıf Kodu', 'name', 'ad', 'Sınıf Adı', 'capacity', 'kapasite', 'Kapasite', 'examCapacity', 'sinavKapasitesi', 'Sınav Kapasitesi', 'roomType', 'derslikTipi', 'Derslik Tipi', 'features', 'ozellikler', 'Özellikler', 'building', 'bina', 'Bina', 'floor', 'kat', 'Kat'],
  },
  invigilators: {
    required: [['staffNo', 'sicilNo', 'Sicil No'], ['firstName', 'ad', 'Ad'], ['lastName', 'soyad', 'Soyad']],
    known: ['staffNo', 'sicilNo', 'Sicil No', 'firstName', 'ad', 'Ad', 'lastName', 'soyad', 'Soyad', 'title', 'unvan', 'Unvan', 'department', 'bolum', 'Bölüm', 'email', 'Email', 'maxAssignments', 'maksGorev', 'Maks Görev', 'priority', 'oncelik', 'Öncelik', 'constraints', 'kisitlar', 'Kısıtlar', 'account'],
  },
};

function value(row, keys) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '') return String(row[key]).trim();
  }
  return '';
}

function hasAnyColumn(columns, keys) {
  return keys.some((key) => columns.includes(key));
}

async function previewImport(type, file, req) {
  const schema = IMPORT_SCHEMAS[type];
  if (!schema) {
    const error = new Error('Geçersiz import tipi.');
    error.status = 400;
    throw error;
  }
  if (type === 'classrooms' && req.user.role !== 'ADMIN') {
    const error = new Error('Derslik importu sadece admin tarafından yapılabilir.');
    error.status = 403;
    throw error;
  }
  const rows = readRows(file);
  const columns = Object.keys(rows[0] || {});
  const missingColumns = schema.required
    .filter((aliases) => !hasAnyColumn(columns, aliases))
    .map((aliases) => aliases[0]);
  const unknownColumns = columns.filter((column) => !schema.known.includes(column));
  const rowErrors = [];
  let creatableRows = 0;
  let updateRows = 0;
  let createdUserAccounts = 0;
  const departments = new Map();

  for (const [index, row] of rows.entries()) {
    const rowNumber = index + 2;
    const requiredMissing = schema.required
      .filter((aliases) => !value(row, aliases))
      .map((aliases) => aliases[0]);
    if (requiredMissing.length) {
      rowErrors.push({ row: rowNumber, field: requiredMissing.join(', '), message: 'Zorunlu alan eksik.' });
      continue;
    }

    const departmentName = value(row, ['department', 'bolum', 'Bölüm']) || (req.user.role === 'DEPARTMENT_MANAGER' ? req.user.department : null);
    if (departmentName || req.user.role === 'DEPARTMENT_MANAGER') {
      try {
        const department = req.user.role === 'DEPARTMENT_MANAGER'
          ? await prisma.department.findUnique({ where: { id: req.user.departmentId || '__missing__' } })
          : await prisma.department.findUnique({ where: { code: normalizeDepartmentCode(departmentName) } });
        if (!department && req.user.role === 'DEPARTMENT_MANAGER') throw new Error('Bölüm kapsamı tanımlı olmayan kullanıcı bu işlemi yapamaz.');
        const previewDepartment = department || { id: null, code: normalizeDepartmentCode(departmentName), name: departmentName || 'Genel', willCreate: true };
        departments.set(previewDepartment.code, previewDepartment);
      } catch (error) {
        rowErrors.push({ row: rowNumber, field: 'department', message: error.message });
        continue;
      }
    }

    if (type === 'students') {
      const studentNo = value(row, ['studentNo', 'ogrenciNo', 'Öğrenci No', 'numara']);
      const existing = await prisma.student.findUnique({ where: { studentNo } });
      if (existing) updateRows += 1;
      else creatableRows += 1;
      if (!existing?.userId) createdUserAccounts += 1;
    } else if (type === 'courses') {
      const code = value(row, ['code', 'dersKodu', 'Ders Kodu']);
      const existing = await prisma.course.findUnique({ where: { code } });
      if (existing) updateRows += 1;
      else creatableRows += 1;
    } else if (type === 'classrooms') {
      const code = value(row, ['code', 'derslikKodu', 'Sınıf Kodu']);
      const existing = await prisma.classroom.findUnique({ where: { code } });
      if (existing) updateRows += 1;
      else creatableRows += 1;
    } else if (type === 'invigilators') {
      const staffNo = value(row, ['staffNo', 'sicilNo', 'Sicil No']);
      const existing = await prisma.invigilator.findUnique({ where: { staffNo } });
      if (existing) updateRows += 1;
      else creatableRows += 1;
      if (!existing?.userId) createdUserAccounts += 1;
    }
  }

  return {
    entityType: type,
    fileName: file.originalname,
    totalRows: rows.length,
    columns,
    missingColumns,
    unknownColumns,
    validRows: Math.max(0, rows.length - rowErrors.length),
    errorRows: rowErrors.length,
    creatableRows,
    updateRows,
    createdUserAccounts,
    departments: [...departments.values()],
    rowErrors: rowErrors.slice(0, 50),
    departmentLockedToUser: req.user.role === 'DEPARTMENT_MANAGER',
  };
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

async function importStudents(file, req) {
  const rows = readRows(file);
  const errors = [];
  let successRows = 0;
  let createdRows = 0;
  let updatedRows = 0;
  let createdUserAccounts = 0;

  const batch = await prisma.importBatch.create({
    data: { entityType: 'students', fileName: file.originalname, totalRows: rows.length },
  });
  const touchedCourseIds = new Set();

  for (const [index, row] of rows.entries()) {
    const studentNo = value(row, ['studentNo', 'ogrenciNo', 'Öğrenci No', 'numara']);
    const fullName = value(row, ['fullName', 'adSoyad', 'Ad Soyad', 'ad_soyad']);
    const department = value(row, ['department', 'bolum', 'Bölüm']) || 'Genel';
    let departmentRecord = null;
    const courseCodes = value(row, ['courses', 'dersler', 'Dersler'])
      .split(/[;,]/)
      .map((item) => item.trim())
      .filter(Boolean);

    if (!studentNo || !fullName) {
      errors.push({ row: index + 2, message: 'Öğrenci numarası ve ad soyad zorunludur.' });
      continue;
    }

    try {
      departmentRecord = await resolveDepartment(prisma, department, req);
      const existingStudent = await prisma.student.findUnique({ where: { studentNo } });
      const student = await prisma.student.upsert({
        where: { studentNo },
        update: { fullName, department: departmentRecord.name, departmentId: departmentRecord.id, specialNeeds: value(row, ['specialNeeds', 'ozelDurum', 'Özel Durum']) || null },
        create: { studentNo, fullName, department: departmentRecord.name, departmentId: departmentRecord.id, specialNeeds: value(row, ['specialNeeds', 'ozelDurum', 'Özel Durum']) || null },
      });
      if (existingStudent) updatedRows += 1;
      else createdRows += 1;
      if (!student.userId) {
        const user = await prisma.user.upsert({
          where: { email: `${studentNo}@students.examus.local` },
          update: { name: fullName, role: 'STUDENT', department: departmentRecord.name, departmentId: departmentRecord.id, mustChangePassword: true },
          create: {
            name: fullName,
            email: `${studentNo}@students.examus.local`,
            role: 'STUDENT',
            department: departmentRecord.name,
            departmentId: departmentRecord.id,
            mustChangePassword: true,
            passwordHash: await bcrypt.hash('12345678', 10),
          },
        });
        await prisma.student.update({ where: { id: student.id }, data: { userId: user.id } });
        createdUserAccounts += 1;
      }

      for (const code of courseCodes) {
        const course = await prisma.course.findUnique({ where: { code } });
        if (course) {
          await prisma.courseEnrollment.upsert({
            where: { studentId_courseId: { studentId: student.id, courseId: course.id } },
            update: {},
            create: { studentId: student.id, courseId: course.id },
          });
          touchedCourseIds.add(course.id);
        }
      }
      successRows += 1;
    } catch (error) {
      errors.push({ row: index + 2, message: error.message });
    }
  }

  await syncCourseStudentCounts([...touchedCourseIds]);

  const batchResult = await prisma.importBatch.update({
    where: { id: batch.id },
    data: {
      status: errors.length ? 'COMPLETED_WITH_ERRORS' : 'COMPLETED',
      successRows,
      errorRows: errors.length,
      errors,
    },
  });
  return { ...batchResult, createdRows, updatedRows, createdUserAccounts };
}

async function importCourses(file, req) {
  const rows = readRows(file);
  const errors = [];
  let successRows = 0;
  let createdRows = 0;
  let updatedRows = 0;
  const batch = await prisma.importBatch.create({ data: { entityType: 'courses', fileName: file.originalname, totalRows: rows.length } });

  for (const [index, row] of rows.entries()) {
    const code = value(row, ['code', 'dersKodu', 'Ders Kodu']);
    const name = value(row, ['name', 'dersAd', 'Ders Adı']);
    if (!code || !name) {
      errors.push({ row: index + 2, message: 'Ders kodu ve ders adı zorunludur.' });
      continue;
    }

    const departmentName = value(row, ['department', 'bolum', 'Bölüm']) || null;
    const department = (departmentName || req?.user?.role === 'DEPARTMENT_MANAGER') ? await resolveDepartment(prisma, departmentName, req) : null;
    const existingCourse = await prisma.course.findUnique({ where: { code } });
    const courseData = {
      name,
      instructorName: value(row, ['instructorName', 'ogretimElemani', 'Öğretim Elemanı']) || null,
      department: department?.name || departmentName,
      departmentId: department?.id || null,
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
    if (existingCourse) updatedRows += 1;
    else createdRows += 1;
    successRows += 1;
  }

  const batchResult = await prisma.importBatch.update({ where: { id: batch.id }, data: { status: errors.length ? 'COMPLETED_WITH_ERRORS' : 'COMPLETED', successRows, errorRows: errors.length, errors } });
  return { ...batchResult, createdRows, updatedRows, createdUserAccounts: 0 };
}

async function importClassrooms(file) {
  const rows = readRows(file);
  const errors = [];
  let successRows = 0;
  let createdRows = 0;
  let updatedRows = 0;
  const batch = await prisma.importBatch.create({ data: { entityType: 'classrooms', fileName: file.originalname, totalRows: rows.length } });

  for (const [index, row] of rows.entries()) {
    const code = value(row, ['code', 'derslikKodu', 'Sınıf Kodu']);
    const name = value(row, ['name', 'ad', 'Sınıf Adı']) || code;
    const capacity = Number(value(row, ['capacity', 'kapasite', 'Kapasite']));
    if (!code || !capacity) {
      errors.push({ row: index + 2, message: 'Sınıf kodu ve kapasite zorunludur.' });
      continue;
    }
    const existingClassroom = await prisma.classroom.findUnique({ where: { code } });
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
    if (existingClassroom) updatedRows += 1;
    else createdRows += 1;
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

  const batchResult = await prisma.importBatch.update({ where: { id: batch.id }, data: { status: errors.length ? 'COMPLETED_WITH_ERRORS' : 'COMPLETED', successRows, errorRows: errors.length, errors } });
  return { ...batchResult, createdRows, updatedRows, createdUserAccounts: 0 };
}

async function importInvigilators(file, req) {
  const rows = readRows(file);
  const errors = [];
  let successRows = 0;
  let createdRows = 0;
  let updatedRows = 0;
  let createdUserAccounts = 0;
  const batch = await prisma.importBatch.create({ data: { entityType: 'invigilators', fileName: file.originalname, totalRows: rows.length } });

  for (const [index, row] of rows.entries()) {
    const staffNo = value(row, ['staffNo', 'sicilNo', 'Sicil No']);
    const firstName = value(row, ['firstName', 'ad', 'Ad']);
    const lastName = value(row, ['lastName', 'soyad', 'Soyad']);
    if (!staffNo || !firstName || !lastName) {
      errors.push({ row: index + 2, message: 'Sicil no, ad ve soyad zorunludur.' });
      continue;
    }
    const departmentName = value(row, ['department', 'bolum', 'Bölüm']) || null;
    const department = (departmentName || req?.user?.role === 'DEPARTMENT_MANAGER') ? await resolveDepartment(prisma, departmentName, req) : null;
    const email = value(row, ['email', 'Email']) || null;
    const existingInvigilator = await prisma.invigilator.findUnique({ where: { staffNo } });
    const invigilator = await prisma.invigilator.upsert({
      where: { staffNo },
      update: {
        firstName,
        lastName,
        title: value(row, ['title', 'unvan', 'Unvan']) || null,
        email,
        department: department?.name || departmentName,
        departmentId: department?.id || null,
        maxAssignments: numberValue(row, ['maxAssignments', 'maksGorev', 'Maks Görev'], 4),
        priority: numberValue(row, ['priority', 'oncelik', 'Öncelik'], 0),
        constraints: jsonValue(row, ['constraints', 'kisitlar', 'Kısıtlar']),
      },
      create: {
        staffNo,
        firstName,
        lastName,
        title: value(row, ['title', 'unvan', 'Unvan']) || null,
        email,
        department: department?.name || departmentName,
        departmentId: department?.id || null,
        maxAssignments: numberValue(row, ['maxAssignments', 'maksGorev', 'Maks Görev'], 4),
        priority: numberValue(row, ['priority', 'oncelik', 'Öncelik'], 0),
        constraints: jsonValue(row, ['constraints', 'kisitlar', 'Kısıtlar']),
      },
    });
    if (existingInvigilator) updatedRows += 1;
    else createdRows += 1;
    if (!invigilator.userId) {
      const user = await prisma.user.upsert({
        where: { email: email || `${staffNo}@invigilators.examus.local` },
        update: {
          name: `${firstName} ${lastName}`.trim(),
          role: 'INVIGILATOR',
          department: department?.name || departmentName,
          departmentId: department?.id || null,
          mustChangePassword: true,
        },
        create: {
          name: `${firstName} ${lastName}`.trim(),
          email: email || `${staffNo}@invigilators.examus.local`,
          role: 'INVIGILATOR',
          department: department?.name || departmentName,
          departmentId: department?.id || null,
          mustChangePassword: true,
          passwordHash: await bcrypt.hash('12345678', 10),
        },
      });
      await prisma.invigilator.update({ where: { id: invigilator.id }, data: { userId: user.id } });
      createdUserAccounts += 1;
    }
    successRows += 1;
  }

  const batchResult = await prisma.importBatch.update({ where: { id: batch.id }, data: { status: errors.length ? 'COMPLETED_WITH_ERRORS' : 'COMPLETED', successRows, errorRows: errors.length, errors } });
  return { ...batchResult, createdRows, updatedRows, createdUserAccounts };
}

module.exports = { importClassrooms, importCourses, importInvigilators, importStudents, previewImport };
