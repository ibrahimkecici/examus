const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const prisma = require('../config/prisma');

async function getScenarioReportData(scenarioId) {
  const scenario = await prisma.planningScenario.findUnique({
    where: { id: scenarioId },
    include: {
      period: true,
      rooms: { include: { classroom: true, exam: { include: { course: true } } } },
      seats: { include: { student: true, seat: true, exam: { include: { course: true } } } },
      invigilators: { include: { invigilator: true, exam: { include: { course: true } } } },
    },
  });

  if (!scenario) {
    const error = new Error('Planlama senaryosu bulunamadı.');
    error.status = 404;
    throw error;
  }
  return scenario;
}

async function buildCalendarWorkbook(scenarioId) {
  const scenario = await getScenarioReportData(scenarioId);
  const workbook = new ExcelJS.Workbook();

  const calendar = workbook.addWorksheet('Genel Takvim');
  calendar.columns = [
    { header: 'Ders Kodu', key: 'code', width: 16 },
    { header: 'Ders Adı', key: 'name', width: 28 },
    { header: 'Tarih', key: 'date', width: 14 },
    { header: 'Saat', key: 'time', width: 16 },
    { header: 'Derslik', key: 'classroom', width: 22 },
    { header: 'Atanan Öğrenci', key: 'count', width: 18 },
  ];
  for (const room of scenario.rooms) {
    calendar.addRow({
      code: room.exam.course.code,
      name: room.exam.course.name,
      date: room.exam.date?.toISOString().slice(0, 10),
      time: `${room.exam.startTime || ''}-${room.exam.endTime || ''}`,
      classroom: room.classroom.name,
      count: room.assignedCount,
    });
  }

  const seats = workbook.addWorksheet('Oturma Planı');
  seats.columns = [
    { header: 'Ders', key: 'course', width: 18 },
    { header: 'Öğrenci No', key: 'studentNo', width: 18 },
    { header: 'Öğrenci', key: 'student', width: 28 },
    { header: 'Sıra', key: 'seat', width: 14 },
  ];
  for (const assignment of scenario.seats) {
    seats.addRow({
      course: assignment.exam.course.code,
      studentNo: assignment.student.studentNo,
      student: assignment.student.fullName,
      seat: assignment.seat.label,
    });
  }

  const invigilators = workbook.addWorksheet('Gözetmenler');
  invigilators.columns = [
    { header: 'Ders', key: 'course', width: 18 },
    { header: 'Gözetmen', key: 'name', width: 28 },
    { header: 'Rol', key: 'role', width: 12 },
  ];
  for (const assignment of scenario.invigilators) {
    invigilators.addRow({
      course: assignment.exam.course.code,
      name: `${assignment.invigilator.title || ''} ${assignment.invigilator.firstName} ${assignment.invigilator.lastName}`.trim(),
      role: assignment.role,
    });
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

  for (const room of scenario.rooms) {
    doc.fontSize(12).text(`${room.exam.course.code} - ${room.exam.course.name}`, { continued: false });
    doc.fontSize(10).text(`${room.exam.date?.toISOString().slice(0, 10)} ${room.exam.startTime}-${room.exam.endTime} | ${room.classroom.name} | ${room.assignedCount} öğrenci`);
    doc.moveDown(0.5);
  }

  doc.end();
}

module.exports = { buildCalendarWorkbook, getScenarioReportData, streamPdf };
