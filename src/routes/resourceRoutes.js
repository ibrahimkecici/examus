const crudRouter = require('../utils/crudRouter');

const seatInclude = { seats: { orderBy: [{ row: 'asc' }, { column: 'asc' }] } };

function normalizeClassroom(body) {
  const rowCount = Number(body.rowCount || body.yerlesimPlani?.satirSayisi || 1);
  const columnCount = Number(body.columnCount || body.yerlesimPlani?.sutunSayisi || 1);
  const seats = body.seats || body.yerlesimPlani?.siralar || [];
  const data = {
    code: body.code || body.ad,
    name: body.name || body.ad,
    building: body.building || body.bina || null,
    block: body.block || null,
    floor: body.floor || null,
    capacity: Number(body.capacity || body.kapasite || seats.filter((seat) => seat.durum !== 'Boşluk' && seat.status !== 'BOSLUK').length || 1),
    rowCount,
    columnCount,
    layoutType: body.layoutType || 'TEKLI',
    availability: body.availability || null,
  };

  if (seats.length) {
    data.seats = {
      create: seats.map((seat) => ({
        label: seat.label || seat.siraNo,
        row: Number(seat.row || seat.satir),
        column: Number(seat.column || seat.sutun),
        status: seat.status || (seat.durum === 'Pasif' ? 'PASIF' : seat.durum === 'Boşluk' ? 'BOSLUK' : 'AKTIF'),
        capacity: Number(seat.capacity || seat.kapasite || 1),
      })),
    };
  }
  return data;
}

function normalizeClassroomUpdate(body) {
  const data = normalizeClassroom(body);
  delete data.seats;
  return data;
}

function normalizeInvigilator(body) {
  return {
    staffNo: body.staffNo || body.sicilNo,
    firstName: body.firstName || body.ad,
    lastName: body.lastName || body.soyad,
    title: body.title || body.unvan || null,
    email: body.email || null,
    phone: body.phone || body.telefon || null,
    department: body.department || body.bolum || null,
    maxAssignments: Number(body.maxAssignments || 4),
    priority: Number(body.priority || 0),
    constraints: body.constraints || null,
  };
}

function normalizeCourse(body) {
  return {
    code: body.code || body.dersKodu,
    name: body.name || body.dersAd,
    instructorName: body.instructorName || body.sorumluOgretimUyesi || null,
    department: body.department || body.bolum || null,
    studentCount: Number(body.studentCount || body.ogrenciSayisi || 0),
    durationMinutes: Number(body.durationMinutes || body.sure || 120),
    examType: body.examType || body.type || 'FINAL',
    specialRules: body.specialRules || null,
  };
}

function normalizeStudent(body) {
  return {
    studentNo: body.studentNo || body.ogrenciNo,
    fullName: body.fullName || body.adSoyad,
    department: body.department || body.bolum || 'Genel',
    classLevel: body.classLevel ? Number(body.classLevel) : null,
    specialNeeds: body.specialNeeds || body.ozelDurum || null,
  };
}

function normalizeExam(body) {
  return {
    courseId: body.courseId,
    periodId: body.periodId || null,
    date: body.date || body.tarih ? new Date(body.date || body.tarih) : null,
    startTime: body.startTime || body.baslangicSaati || null,
    endTime: body.endTime || body.bitisSaati || null,
    durationMinutes: Number(body.durationMinutes || 120),
    type: body.type || 'FINAL',
    status: body.status || 'DRAFT',
    minRooms: body.minRooms ? Number(body.minRooms) : null,
    maxRooms: body.maxRooms ? Number(body.maxRooms) : null,
    pinned: Boolean(body.pinned),
    specialRules: body.specialRules || null,
  };
}

module.exports = {
  classroomRoutes: crudRouter('classroom', { include: seatInclude, mapCreate: normalizeClassroom, mapUpdate: normalizeClassroomUpdate }),
  courseRoutes: crudRouter('course', { include: { enrollments: true, exams: true }, mapCreate: normalizeCourse, mapUpdate: normalizeCourse }),
  examPeriodRoutes: crudRouter('examPeriod', {
    include: { exams: { include: { course: true } }, scenarios: true },
    mapCreate: (body) => ({ name: body.name, startDate: new Date(body.startDate), endDate: new Date(body.endDate), slots: body.slots || [] }),
    mapUpdate: (body) => ({ ...body, startDate: body.startDate ? new Date(body.startDate) : undefined, endDate: body.endDate ? new Date(body.endDate) : undefined }),
  }),
  examRoutes: crudRouter('exam', { include: { course: true, period: true, roomAssignments: { include: { classroom: true } } }, mapCreate: normalizeExam, mapUpdate: normalizeExam }),
  invigilatorRoutes: crudRouter('invigilator', { include: { availability: true, assignments: { include: { exam: { include: { course: true } } } } }, mapCreate: normalizeInvigilator, mapUpdate: normalizeInvigilator }),
  studentRoutes: crudRouter('student', { include: { enrollments: { include: { course: true } } }, mapCreate: normalizeStudent, mapUpdate: normalizeStudent }),
};
