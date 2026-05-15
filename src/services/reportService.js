const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const prisma = require('../config/prisma');
const { sameDate } = require('../utils/time');
const { activeSeatCapacity } = require('./planning/roomAllocator');
const { groupSpecialNeedSummary, specialNeedNote } = require('./planning/specialNeeds');

async function getScenarioReportData(scenarioId) {
  const scenario = await prisma.planningScenario.findUnique({
    where: { id: scenarioId },
    include: {
      period: true,
      schedules: true,
      roomSlots: { include: { classroom: { include: { seats: true } }, assignments: { include: { exam: { include: { course: true } } } } } },
      rooms: { include: { classroom: { include: { seats: true } }, roomSlot: true, exam: { include: { course: true } } } },
      seats: { include: { student: true, seat: true, classroom: true, exam: { include: { course: true } } } },
      invigilators: { include: { invigilator: true, exam: { include: { course: true } } } },
    },
  });

  if (!scenario) {
    const error = new Error('Planlama senaryosu bulunamadı.');
    error.status = 404;
    throw error;
  }
  if (scenario.status === 'FAILED' && (scenario.warnings || []).some((item) => item.severity === 'hard')) {
    const error = new Error('Hard validasyon hatası olan senaryo export edilemez.');
    error.status = 409;
    throw error;
  }
  return scenario;
}

function scheduleFor(scenario, exam) {
  return scenario.schedules.find((schedule) => schedule.examId === exam.id) || exam;
}

function invigilatorName(invigilator) {
  return `${invigilator.title || ''} ${invigilator.firstName} ${invigilator.lastName}`.replace(/\s+/g, ' ').trim();
}

function uniqueBy(items, keyFn) {
  const seen = new Set();
  return items.filter((item) => {
    const key = keyFn(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function slotAssignments(scenario, slot) {
  return scenario.rooms.filter((room) => room.roomSlotId === slot.id);
}

function slotSeatAssignments(scenario, slot) {
  const examIds = new Set(slotAssignments(scenario, slot).map((assignment) => assignment.examId));
  return scenario.seats.filter((assignment) => examIds.has(assignment.examId) && assignment.classroomId === slot.classroomId);
}

function slotInvigilators(scenario, slot) {
  const examIds = new Set(slotAssignments(scenario, slot).map((assignment) => assignment.examId));
  return uniqueBy(
    scenario.invigilators.filter((assignment) => examIds.has(assignment.examId)),
    (assignment) => assignment.invigilatorId,
  );
}

function warningTextForSlot(scenario, slot) {
  const examIds = new Set(slotAssignments(scenario, slot).map((assignment) => assignment.examId));
  return (scenario.warnings || [])
    .filter((warning) => !warning.examId || examIds.has(warning.examId))
    .map((warning) => warning.message)
    .join(' | ');
}

function formatSpecialNeeds(students) {
  return groupSpecialNeedSummary(students) || '-';
}

async function buildCalendarWorkbook(scenarioId) {
  const scenario = await getScenarioReportData(scenarioId);
  const workbook = new ExcelJS.Workbook();

  const calendar = workbook.addWorksheet('Genel Takvim');
  calendar.columns = [
    { header: 'Tarih', key: 'date', width: 14 },
    { header: 'Saat', key: 'time', width: 16 },
    { header: 'Derslik', key: 'classroom', width: 28 },
    { header: 'Karma Salon mu?', key: 'mixed', width: 16 },
    { header: 'Ders Kodları', key: 'codes', width: 22 },
    { header: 'Ders Adları', key: 'names', width: 36 },
    { header: 'Süre', key: 'duration', width: 10 },
    { header: 'Kapasite', key: 'capacity', width: 12 },
    { header: 'Atanan Öğrenci Sayısı', key: 'count', width: 22 },
    { header: 'Doluluk Oranı', key: 'utilization', width: 16 },
    { header: 'Gözetmenler', key: 'invigilators', width: 36 },
    { header: 'Özel İhtiyaç Özeti', key: 'specialNeeds', width: 42 },
    { header: 'Uyarılar', key: 'warnings', width: 54 },
  ];
  for (const slot of scenario.roomSlots) {
    const assignments = slotAssignments(scenario, slot);
    const seats = slotSeatAssignments(scenario, slot);
    const invigilators = slotInvigilators(scenario, slot);
    const capacity = activeSeatCapacity(slot.classroom);
    calendar.addRow({
      date: slot.date.toISOString().slice(0, 10),
      time: `${slot.startTime}-${slot.endTime}`,
      classroom: `${slot.classroom.code} - ${slot.classroom.name}`,
      mixed: slot.mixed ? 'Evet' : 'Hayır',
      codes: assignments.map((assignment) => assignment.exam.course.code).join(', '),
      names: assignments.map((assignment) => assignment.exam.course.name).join(', '),
      duration: assignments[0]?.exam.durationMinutes || '',
      capacity,
      count: seats.length,
      utilization: capacity > 0 ? Number((seats.length / capacity).toFixed(2)) : 0,
      invigilators: invigilators.map((assignment) => invigilatorName(assignment.invigilator)).join(', '),
      specialNeeds: formatSpecialNeeds(seats.map((assignment) => assignment.student)),
      warnings: warningTextForSlot(scenario, slot),
    });
  }

  const seatsSheet = workbook.addWorksheet('Oturma Planı');
  seatsSheet.columns = [
    { header: 'Tarih', key: 'date', width: 14 },
    { header: 'Saat', key: 'time', width: 16 },
    { header: 'Derslik Kodu', key: 'classroomCode', width: 16 },
    { header: 'Derslik Adı', key: 'classroomName', width: 24 },
    { header: 'Koltuk/Sıra', key: 'seat', width: 14 },
    { header: 'Öğrenci No', key: 'studentNo', width: 18 },
    { header: 'Öğrenci Adı', key: 'student', width: 28 },
    { header: 'Ders Kodu', key: 'code', width: 16 },
    { header: 'Ders Adı', key: 'name', width: 28 },
    { header: 'Özel İhtiyaç', key: 'specialNeeds', width: 24 },
    { header: 'Not', key: 'note', width: 38 },
  ];
  for (const assignment of scenario.seats) {
    const schedule = scheduleFor(scenario, assignment.exam);
    seatsSheet.addRow({
      date: schedule.date?.toISOString().slice(0, 10),
      time: `${schedule.startTime || ''}-${schedule.endTime || ''}`,
      classroomCode: assignment.classroom?.code || '',
      classroomName: assignment.classroom?.name || '',
      seat: assignment.seat.label,
      studentNo: assignment.student.studentNo,
      student: assignment.student.fullName,
      code: assignment.exam.course.code,
      name: assignment.exam.course.name,
      specialNeeds: specialNeedNote(assignment.student),
      note: specialNeedNote(assignment.student),
    });
  }

  const invigilators = workbook.addWorksheet('Gözetmenler');
  invigilators.columns = [
    { header: 'Gözetmen', key: 'name', width: 28 },
    { header: 'Sicil No', key: 'staffNo', width: 16 },
    { header: 'Tarih', key: 'date', width: 14 },
    { header: 'Saat', key: 'time', width: 16 },
    { header: 'Derslik', key: 'classroom', width: 28 },
    { header: 'Karma Salon mu?', key: 'mixed', width: 16 },
    { header: 'Dersler', key: 'courses', width: 34 },
    { header: 'Rol', key: 'role', width: 12 },
    { header: 'Günlük Görev Sayısı', key: 'dailyCount', width: 20 },
    { header: 'Toplam Görev Sayısı', key: 'totalCount', width: 20 },
    { header: 'Not', key: 'note', width: 44 },
  ];

  const invigilatorSlotRows = [];
  for (const slot of scenario.roomSlots) {
    for (const assignment of slotInvigilators(scenario, slot)) {
      invigilatorSlotRows.push({ slot, assignment });
    }
  }

  for (const row of invigilatorSlotRows) {
    const { slot, assignment } = row;
    const assignments = slotAssignments(scenario, slot);
    const totalCount = invigilatorSlotRows.filter((item) => item.assignment.invigilatorId === assignment.invigilatorId).length;
    const dailyCount = invigilatorSlotRows.filter((item) => item.assignment.invigilatorId === assignment.invigilatorId && sameDate(item.slot.date, slot.date)).length;
    const specialNotes = formatSpecialNeeds(slotSeatAssignments(scenario, slot).map((item) => item.student));
    invigilators.addRow({
      name: invigilatorName(assignment.invigilator),
      staffNo: assignment.invigilator.staffNo,
      date: slot.date.toISOString().slice(0, 10),
      time: `${slot.startTime}-${slot.endTime}`,
      classroom: `${slot.classroom.code} - ${slot.classroom.name}`,
      mixed: slot.mixed ? 'Evet' : 'Hayır',
      courses: assignments.map((item) => `${item.exam.course.code} - ${item.exam.course.name}`).join(', '),
      role: assignment.role,
      dailyCount,
      totalCount,
      note: specialNotes,
    });
  }

  for (const sheet of workbook.worksheets) {
    sheet.getRow(1).font = { bold: true };
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    sheet.autoFilter = { from: 'A1', to: sheet.getRow(1).getCell(sheet.columnCount).address };
  }

  return workbook;
}

async function streamPdf(scenarioId, res) {
  const scenario = await getScenarioReportData(scenarioId);
  const doc = new PDFDocument({ margin: 40 });
  doc.pipe(res);
  doc.fontSize(18).text(`Examus Sınav Planı: ${scenario.name}`);
  doc.moveDown();
  doc.fontSize(10).text(`Skor: ${scenario.score} | Durum: ${scenario.status}`);
  doc.moveDown();

  for (const slot of scenario.roomSlots) {
    const assignments = slotAssignments(scenario, slot);
    const seats = slotSeatAssignments(scenario, slot);
    const capacity = activeSeatCapacity(slot.classroom);
    doc.fontSize(12).text(`${slot.classroom.code} ${slot.classroom.name} ${slot.mixed ? '(Karma)' : ''}`);
    doc.fontSize(10).text(`${slot.date.toISOString().slice(0, 10)} ${slot.startTime}-${slot.endTime} | ${assignments.map((item) => item.exam.course.code).join(', ')} | ${seats.length}/${capacity} öğrenci`);
    const warnings = warningTextForSlot(scenario, slot);
    if (warnings) doc.fontSize(9).text(`Uyarılar: ${warnings}`);
    doc.moveDown(0.5);
  }

  doc.end();
}

module.exports = { buildCalendarWorkbook, getScenarioReportData, streamPdf };
