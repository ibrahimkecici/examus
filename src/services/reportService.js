const path = require('path');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const prisma = require('../config/prisma');
const { filterScenarioForUser } = require('../utils/scenarioAccess');
const { sameDate } = require('../utils/time');
const { activeSeatCapacity, getEffectiveCapacity } = require('./planning/roomAllocator');
const { groupSpecialNeedSummary, specialNeedNote } = require('./planning/specialNeeds');

const FONT_PATH = path.join(__dirname, '..', 'assets', 'fonts', 'NotoSans-Regular.ttf');

function assertScenarioExportable(scenario) {
  if (scenario.status === 'FAILED' && (scenario.warnings || []).some((item) => item.severity === 'hard')) {
    const error = new Error('Hard validasyon hatası olan senaryo export edilemez.');
    error.status = 409;
    throw error;
  }
}

async function getScenarioReportData(scenarioId, user = null) {
  const scenario = await prisma.planningScenario.findUnique({
    where: { id: scenarioId },
    include: {
      period: true,
      schedules: { include: { exam: { include: { course: true } } } },
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
  assertScenarioExportable(scenario);
  const scoped = user ? filterScenarioForUser(scenario, user) : scenario;
  if (!scoped) {
    const error = new Error('Planlama senaryosu bulunamadı.');
    error.status = 404;
    throw error;
  }
  return scoped;
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

function slotAssignments(scenario, slot, options = {}) {
  return scenario.rooms.filter((room) => {
    if (room.roomSlotId !== slot.id) return false;
    if (options.examId && room.examId !== options.examId) return false;
    return true;
  });
}

function slotSeatAssignments(scenario, slot, options = {}) {
  const examIds = new Set(slotAssignments(scenario, slot, options).map((assignment) => assignment.examId));
  return scenario.seats.filter((assignment) => examIds.has(assignment.examId) && assignment.classroomId === slot.classroomId);
}

function slotInvigilators(scenario, slot, options = {}) {
  const examIds = new Set(slotAssignments(scenario, slot, options).map((assignment) => assignment.examId));
  return uniqueBy(
    scenario.invigilators.filter((assignment) => examIds.has(assignment.examId)),
    (assignment) => assignment.invigilatorId,
  );
}

function warningTextForSlot(scenario, slot, options = {}) {
  const examIds = new Set(slotAssignments(scenario, slot, options).map((assignment) => assignment.examId));
  return (scenario.warnings || [])
    .filter((warning) => (!options.examId || !warning.examId || warning.examId === options.examId) && (!warning.examId || examIds.has(warning.examId)))
    .map((warning) => warning.message)
    .join(' | ');
}

function warningCodesForSlot(scenario, slot, options = {}) {
  const examIds = new Set(slotAssignments(scenario, slot, options).map((assignment) => assignment.examId));
  const codes = (scenario.warnings || [])
    .filter((warning) => (!options.examId || !warning.examId || warning.examId === options.examId) && (!warning.examId || examIds.has(warning.examId)))
    .map((warning) => warning.code || warning.type)
    .filter(Boolean);
  return [...new Set(codes)].join(', ');
}

function formatSpecialNeeds(students) {
  return groupSpecialNeedSummary(students) || '-';
}

function physicalRoomCapacity(classroom) {
  return Number(classroom?.capacity || 0) || activeSeatCapacity(classroom);
}

function slotEffectiveExamCapacity(slot, assignments) {
  if (assignments.length === 1) {
    const exam = assignments[0].exam;
    const bookletTypes = Array.isArray(exam.bookletTypes) && exam.bookletTypes.length > 0 ? exam.bookletTypes : exam.course?.bookletTypes;
    return getEffectiveCapacity(slot.classroom, true, Array.isArray(bookletTypes) ? bookletTypes.length > 1 : false);
  }
  return activeSeatCapacity(slot.classroom);
}

function formatDate(date) {
  return date ? date.toISOString().slice(0, 10) : '-';
}

function formatPercent(value) {
  if (!Number.isFinite(value)) return '-';
  return `%${Math.round(value * 100)}`;
}

function sortedRoomSlots(scenario) {
  return [...scenario.roomSlots].sort((a, b) => {
    const dateDiff = a.date.getTime() - b.date.getTime();
    if (dateDiff !== 0) return dateDiff;
    const timeDiff = String(a.startTime).localeCompare(String(b.startTime));
    if (timeDiff !== 0) return timeDiff;
    return String(a.classroom.code).localeCompare(String(b.classroom.code));
  });
}

function sortedSeatAssignments(seats) {
  return [...seats].sort((a, b) => {
    const rowDiff = (a.seat?.row || 0) - (b.seat?.row || 0);
    if (rowDiff !== 0) return rowDiff;
    const columnDiff = (a.seat?.column || 0) - (b.seat?.column || 0);
    if (columnDiff !== 0) return columnDiff;
    return String(a.student?.studentNo || '').localeCompare(String(b.student?.studentNo || ''));
  });
}

function slotCourseLabel(assignments) {
  return assignments.map((item) => `${item.exam.course.code} - ${item.exam.course.name}`).join(', ');
}

function slotCourseCodes(assignments) {
  return assignments.map((item) => item.exam.course.code).join(', ');
}

function slotDurationLabel(assignments) {
  const durations = uniqueBy(assignments.map((item) => item.exam.durationMinutes).filter(Boolean), (item) => item);
  return durations.length === 1 ? `${durations[0]} dk` : durations.map((item) => `${item} dk`).join(', ');
}

function slotReportRow(scenario, slot, options = {}) {
  const assignments = slotAssignments(scenario, slot, options);
  const seats = slotSeatAssignments(scenario, slot, options);
  const invigilators = slotInvigilators(scenario, slot, options);
  const examCapacity = slotEffectiveExamCapacity(slot, assignments);
  const physicalCapacity = physicalRoomCapacity(slot.classroom);
  const assignedCount = seats.length;
  return {
    slot,
    assignments,
    seats,
    invigilators,
    date: formatDate(slot.date),
    time: `${slot.startTime}-${slot.endTime}`,
    classroom: `${slot.classroom.code} - ${slot.classroom.name}`,
    mixed: slot.mixed ? 'Evet' : 'Hayır',
    courses: slotCourseLabel(assignments),
    courseCodes: slotCourseCodes(assignments),
    duration: slotDurationLabel(assignments),
    examCapacity,
    physicalCapacity,
    assignedCount,
    examUtilization: examCapacity > 0 ? assignedCount / examCapacity : 0,
    physicalUtilization: physicalCapacity > 0 ? assignedCount / physicalCapacity : 0,
    invigilatorNames: invigilators.map((assignment) => invigilatorName(assignment.invigilator)).join(', '),
    specialNeeds: formatSpecialNeeds(seats.map((assignment) => assignment.student)),
    warningCodes: warningCodesForSlot(scenario, slot, options),
    warnings: warningTextForSlot(scenario, slot, options),
  };
}

function buildInvigilatorRows(scenario, slotRows) {
  const rows = [];
  for (const row of slotRows) {
    for (const assignment of row.invigilators) {
      rows.push({ slotRow: row, assignment });
    }
  }
  return rows.map((row) => {
    const totalCount = rows.filter((item) => item.assignment.invigilatorId === row.assignment.invigilatorId).length;
    const dailyCount = rows.filter((item) => (
      item.assignment.invigilatorId === row.assignment.invigilatorId
      && sameDate(item.slotRow.slot.date, row.slotRow.slot.date)
    )).length;
    return {
      name: invigilatorName(row.assignment.invigilator),
      staffNo: row.assignment.invigilator.staffNo || '-',
      date: row.slotRow.date,
      time: row.slotRow.time,
      classroom: row.slotRow.classroom,
      mixed: row.slotRow.mixed,
      courses: row.slotRow.courses,
      role: row.assignment.role,
      dailyCount,
      totalCount,
      note: row.slotRow.specialNeeds,
    };
  }).sort((a, b) => {
    const nameDiff = a.name.localeCompare(b.name);
    if (nameDiff !== 0) return nameDiff;
    const dateDiff = a.date.localeCompare(b.date);
    if (dateDiff !== 0) return dateDiff;
    return a.time.localeCompare(b.time);
  });
}

function warningSummary(warnings = []) {
  return warnings.reduce((acc, warning) => {
    const severity = warning.severity || 'info';
    acc[severity] = (acc[severity] || 0) + 1;
    return acc;
  }, {});
}

function examLabelForModel(scenario, examId) {
  if (!examId) return null;
  const roomAssignment = scenario.rooms.find((assignment) => assignment.examId === examId);
  const schedule = scenario.schedules.find((item) => item.examId === examId);
  const exam = roomAssignment?.exam || schedule?.exam || scenario.seats.find((seat) => seat.examId === examId)?.exam;
  if (!exam) return null;
  return `${exam.course.code} - ${exam.course.name}`;
}

function buildPdfReportModel(scenario, options = {}) {
  const slotRows = sortedRoomSlots(scenario)
    .map((slot) => slotReportRow(scenario, slot, options))
    .filter((row) => row.assignments.length > 0);
  const uniqueExamIds = new Set(options.examId ? [options.examId] : scenario.schedules.map((schedule) => schedule.examId));
  const usedDates = new Set(slotRows.map((row) => row.date));
  const filteredSeats = options.examId ? scenario.seats.filter((seat) => seat.examId === options.examId) : scenario.seats;
  const filteredInvigilators = options.examId ? scenario.invigilators.filter((assignment) => assignment.examId === options.examId) : scenario.invigilators;
  const assignedStudents = filteredSeats.length;
  const totalPhysicalCapacity = slotRows.reduce((sum, row) => sum + row.physicalCapacity, 0);
  const averagePhysicalUtilization = totalPhysicalCapacity > 0 ? assignedStudents / totalPhysicalCapacity : 0;
  const metrics = scenario.metrics || {};
  const filteredWarnings = (scenario.warnings || []).filter((warning) => !options.examId || !warning.examId || warning.examId === options.examId);
  return {
    scenario,
    generatedAt: new Date(),
    slotRows,
    invigilatorRows: buildInvigilatorRows(scenario, slotRows),
    warnings: filteredWarnings,
    warningSummary: warningSummary(filteredWarnings),
    examId: options.examId || null,
    examLabel: examLabelForModel(scenario, options.examId),
    userRole: options.userRole || 'ADMIN',
    summary: {
      scenarioName: scenario.name,
      periodName: scenario.period?.name || '-',
      status: scenario.status,
      strategy: scenario.strategy,
      score: Math.round(Number(scenario.score || 0)),
      examCount: uniqueExamIds.size,
      assignedStudents: filteredSeats.length,
      roomSlotCount: slotRows.length,
      invigilatorCount: new Set(filteredInvigilators.map((assignment) => assignment.invigilatorId)).size,
      usedDayCount: metrics.usedDayCount || usedDates.size,
      examCoveragePercent: metrics.examCoveragePercent,
      averagePhysicalUtilization: metrics.averagePhysicalRoomUtilization ?? averagePhysicalUtilization,
      totalPhysicalUnusedCapacity: metrics.totalPhysicalUnusedCapacity,
    },
  };
}

function addSummaryWorksheet(workbook, model) {
  const sheet = workbook.addWorksheet('Özet');
  sheet.columns = [
    { header: 'Metrik', key: 'metric', width: 30 },
    { header: 'Değer', key: 'value', width: 38 },
  ];
  sheet.addRows([
    { metric: 'Senaryo', value: model.summary.scenarioName },
    { metric: 'Dönem', value: model.summary.periodName },
    { metric: 'Durum', value: model.summary.status },
    { metric: 'Strateji', value: model.summary.strategy },
    { metric: 'Skor', value: model.summary.score },
    { metric: 'Sınav sayısı', value: model.summary.examCount },
    { metric: 'Atanan öğrenci', value: model.summary.assignedStudents },
    { metric: 'Kullanılan salon-slot', value: model.summary.roomSlotCount },
    { metric: 'Gözetmen sayısı', value: model.summary.invigilatorCount },
    { metric: 'Kapsam', value: model.summary.examCoveragePercent != null ? `%${model.summary.examCoveragePercent}` : '-' },
    { metric: 'Ortalama fiziksel doluluk', value: formatPercent(model.summary.averagePhysicalUtilization) },
    { metric: 'Boş fiziksel kapasite', value: model.summary.totalPhysicalUnusedCapacity ?? '-' },
  ]);
}

function addCalendarWorksheet(workbook, model) {
  const calendar = workbook.addWorksheet('Genel Takvim');
  calendar.columns = [
    { header: 'Tarih', key: 'date', width: 14 },
    { header: 'Saat', key: 'time', width: 16 },
    { header: 'Derslik', key: 'classroom', width: 28 },
    { header: 'Karma Salon mu?', key: 'mixed', width: 16 },
    { header: 'Ders Kodları', key: 'codes', width: 22 },
    { header: 'Ders Adları', key: 'names', width: 36 },
    { header: 'Süre', key: 'duration', width: 10 },
    { header: 'Sınav Kapasitesi', key: 'examCapacity', width: 16 },
    { header: 'Fiziksel Kapasite', key: 'physicalCapacity', width: 18 },
    { header: 'Atanan Öğrenci Sayısı', key: 'count', width: 22 },
    { header: 'Sınav Kapasitesi Doluluğu', key: 'examUtilization', width: 24 },
    { header: 'Fiziksel Salon Doluluğu', key: 'physicalUtilization', width: 24 },
    { header: 'Gözetmenler', key: 'invigilators', width: 36 },
    { header: 'Özel İhtiyaç Özeti', key: 'specialNeeds', width: 42 },
    { header: 'Uyarı Kodları', key: 'warningCodes', width: 24 },
  ];
  for (const row of model.slotRows) {
    calendar.addRow({
      date: row.date,
      time: row.time,
      classroom: row.classroom,
      mixed: row.mixed,
      codes: row.courseCodes,
      names: row.courses,
      duration: row.duration,
      examCapacity: row.examCapacity,
      physicalCapacity: row.physicalCapacity,
      count: row.assignedCount,
      examUtilization: Number(row.examUtilization.toFixed(2)),
      physicalUtilization: Number(row.physicalUtilization.toFixed(2)),
      invigilators: row.invigilatorNames,
      specialNeeds: row.specialNeeds,
      warningCodes: row.warningCodes || '-',
    });
  }
}

function addSeatsWorksheet(workbook, model) {
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
    { header: 'Kitapçık', key: 'booklet', width: 12 },
    { header: 'Özel İhtiyaç', key: 'specialNeeds', width: 24 },
    { header: 'Not', key: 'note', width: 38 },
  ];
  for (const row of model.slotRows) {
    for (const assignment of sortedSeatAssignments(row.seats)) {
      seatsSheet.addRow({
        date: row.date,
        time: row.time,
        classroomCode: assignment.classroom?.code || row.slot.classroom.code,
        classroomName: assignment.classroom?.name || row.slot.classroom.name,
        seat: assignment.seat.label,
        studentNo: assignment.student.studentNo,
        student: assignment.student.fullName,
        code: assignment.exam.course.code,
        name: assignment.exam.course.name,
        booklet: assignment.bookletType || '-',
        specialNeeds: specialNeedNote(assignment.student),
        note: specialNeedNote(assignment.student),
      });
    }
  }
}

function addClassroomsWorksheet(workbook, model) {
  const list = workbook.addWorksheet('Salon Kapı Listesi');
  list.columns = [
    { header: 'Tarih', key: 'date', width: 14 },
    { header: 'Saat', key: 'time', width: 16 },
    { header: 'Derslik Kodu', key: 'classroomCode', width: 16 },
    { header: 'Derslik Adı', key: 'classroomName', width: 26 },
    { header: 'Karma Salon mu?', key: 'mixed', width: 16 },
    { header: 'Ders Kodu', key: 'courseCode', width: 14 },
    { header: 'Ders Adı', key: 'courseName', width: 30 },
    { header: 'Koltuk/Sıra', key: 'seat', width: 14 },
    { header: 'Öğrenci No', key: 'studentNo', width: 18 },
    { header: 'Öğrenci Adı', key: 'student', width: 28 },
    { header: 'Kitapçık', key: 'booklet', width: 12 },
    { header: 'Özel İhtiyaç / Not', key: 'note', width: 34 },
    { header: 'Uyarı Kodları', key: 'warningCodes', width: 24 },
  ];
  for (const row of model.slotRows) {
    for (const assignment of sortedSeatAssignments(row.seats)) {
      list.addRow({
        date: row.date,
        time: row.time,
        classroomCode: row.slot.classroom.code,
        classroomName: row.slot.classroom.name,
        mixed: row.mixed,
        courseCode: assignment.exam.course.code,
        courseName: assignment.exam.course.name,
        seat: assignment.seat.label,
        studentNo: assignment.student.studentNo,
        student: assignment.student.fullName,
        booklet: assignment.bookletType || '-',
        note: specialNeedNote(assignment.student) || '-',
        warningCodes: row.warningCodes || '-',
      });
    }
  }

  const usage = workbook.addWorksheet('Salon Kullanım Özeti');
  usage.columns = [
    { header: 'Tarih', key: 'date', width: 14 },
    { header: 'Saat', key: 'time', width: 16 },
    { header: 'Derslik', key: 'classroom', width: 28 },
    { header: 'Dersler', key: 'courses', width: 42 },
    { header: 'Atanan', key: 'assigned', width: 12 },
    { header: 'Sınav Kapasitesi', key: 'examCapacity', width: 18 },
    { header: 'Fiziksel Kapasite', key: 'physicalCapacity', width: 18 },
    { header: 'Sınav Doluluğu', key: 'examUtilization', width: 16 },
    { header: 'Fiziksel Doluluk', key: 'physicalUtilization', width: 18 },
    { header: 'Uyarı Kodları', key: 'warningCodes', width: 24 },
  ];
  for (const row of model.slotRows) {
    usage.addRow({
      date: row.date,
      time: row.time,
      classroom: row.classroom,
      courses: row.courses,
      assigned: row.assignedCount,
      examCapacity: row.examCapacity,
      physicalCapacity: row.physicalCapacity,
      examUtilization: Number(row.examUtilization.toFixed(2)),
      physicalUtilization: Number(row.physicalUtilization.toFixed(2)),
      warningCodes: row.warningCodes || '-',
    });
  }
}

function addInvigilatorsWorksheet(workbook, model) {
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
  for (const row of model.invigilatorRows) {
    invigilators.addRow(row);
  }
}

function addWarningsWorksheet(workbook, model) {
  const sheet = workbook.addWorksheet('Uyarılar');
  sheet.columns = [
    { header: 'Seviye', key: 'severity', width: 12 },
    { header: 'Kod', key: 'code', width: 28 },
    { header: 'Sınav', key: 'exam', width: 22 },
    { header: 'Mesaj', key: 'message', width: 90 },
  ];
  if (model.warnings.length === 0) {
    sheet.addRow({ severity: 'info', code: 'NO_WARNINGS', exam: '-', message: 'Bu senaryo için uyarı bulunmuyor.' });
    return;
  }
  for (const warning of model.warnings) {
    sheet.addRow({
      severity: warning.severity || 'info',
      code: warning.code || warning.type || '-',
      exam: warning.examId || '-',
      message: warning.message || '-',
    });
  }
}

function finalizeWorkbook(workbook) {
  for (const sheet of workbook.worksheets) {
    sheet.getRow(1).font = { bold: true };
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    sheet.autoFilter = { from: 'A1', to: sheet.getRow(1).getCell(sheet.columnCount).address };
    sheet.eachRow((row) => {
      row.alignment = { vertical: 'top', wrapText: true };
    });
  }
}

function buildScenarioWorkbookData(scenario, type = 'calendar') {
  const model = buildPdfReportModel(scenario);
  const workbook = new ExcelJS.Workbook();

  if (type === 'full') {
    addSummaryWorksheet(workbook, model);
    addCalendarWorksheet(workbook, model);
    addClassroomsWorksheet(workbook, model);
    addSeatsWorksheet(workbook, model);
    addInvigilatorsWorksheet(workbook, model);
    addWarningsWorksheet(workbook, model);
  } else if (type === 'students') {
    addSeatsWorksheet(workbook, model);
    addWarningsWorksheet(workbook, model);
  } else if (type === 'classrooms') {
    addClassroomsWorksheet(workbook, model);
    addWarningsWorksheet(workbook, model);
  } else if (type === 'invigilators') {
    addInvigilatorsWorksheet(workbook, model);
    addWarningsWorksheet(workbook, model);
  } else {
    addSummaryWorksheet(workbook, model);
    addCalendarWorksheet(workbook, model);
    addWarningsWorksheet(workbook, model);
  }

  finalizeWorkbook(workbook);
  return workbook;
}

async function buildScenarioWorkbook(scenarioId, type = 'calendar', user = null) {
  const scenario = await getScenarioReportData(scenarioId, user);
  return buildScenarioWorkbookData(scenario, type);
}

async function buildCalendarWorkbook(scenarioId) {
  return buildScenarioWorkbook(scenarioId, 'calendar');
}

const COURSE_PALETTE = [
  { fill: '#dbeafe', text: '#1e3a8a', border: '#93c5fd' },
  { fill: '#dcfce7', text: '#14532d', border: '#86efac' },
  { fill: '#fef3c7', text: '#78350f', border: '#fcd34d' },
  { fill: '#fce7f3', text: '#831843', border: '#f9a8d4' },
  { fill: '#ede9fe', text: '#4c1d95', border: '#c4b5fd' },
  { fill: '#cffafe', text: '#155e75', border: '#67e8f9' },
  { fill: '#ffe4e6', text: '#881337', border: '#fda4af' },
  { fill: '#e0e7ff', text: '#312e81', border: '#a5b4fc' },
  { fill: '#ecfccb', text: '#365314', border: '#bef264' },
  { fill: '#fed7aa', text: '#7c2d12', border: '#fdba74' },
];

const NEUTRAL_COURSE_COLOR = { fill: '#ffffff', text: '#0f172a', border: '#cbd5e1' };

function hashCourseCode(code) {
  let h = 0;
  const str = String(code);
  for (let i = 0; i < str.length; i += 1) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function courseColor(code) {
  if (!code) return NEUTRAL_COURSE_COLOR;
  return COURSE_PALETTE[hashCourseCode(code) % COURSE_PALETTE.length];
}

function pageBounds(doc) {
  return {
    left: doc.page.margins.left,
    right: doc.page.width - doc.page.margins.right,
    top: doc.page.margins.top,
    bottom: doc.page.height - doc.page.margins.bottom,
  };
}

function addPageChrome(doc, model, sectionTitle) {
  const bounds = pageBounds(doc);
  doc.font('Font').fontSize(8).fillColor('#64748b');
  doc.text(model.summary.scenarioName, bounds.left, 18, { width: bounds.right - bounds.left, continued: false });
  doc.text(sectionTitle, bounds.left, 30, { width: bounds.right - bounds.left, align: 'right' });
  doc.moveTo(bounds.left, 42).lineTo(bounds.right, 42).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
  doc.fillColor('#0f172a');
  doc.y = 54;
}

function createPdfDocument(res, model, sectionTitle, options = {}) {
  const doc = new PDFDocument({
    margin: 42,
    size: 'A4',
    layout: options.layout || 'portrait',
    bufferPages: true,
  });
  doc.registerFont('Font', FONT_PATH);
  doc.font('Font');
  doc.pipe(res);
  addPageChrome(doc, model, sectionTitle);
  doc.on('pageAdded', () => addPageChrome(doc, model, sectionTitle));
  return doc;
}

function finalizePageNumbers(doc, model) {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i += 1) {
    doc.switchToPage(i);
    const bounds = pageBounds(doc);
    const footerY = bounds.bottom - 22;
    doc.font('Font').fontSize(8).fillColor('#64748b');
    doc.text(`Üretim: ${formatDate(model.generatedAt)} ${String(model.generatedAt.getHours()).padStart(2, '0')}:${String(model.generatedAt.getMinutes()).padStart(2, '0')}`, bounds.left, footerY, {
      width: bounds.right - bounds.left,
      lineBreak: false,
    });
    doc.text(`Sayfa ${i - range.start + 1}/${range.count}`, bounds.left, footerY, {
      width: bounds.right - bounds.left,
      align: 'right',
      lineBreak: false,
    });
  }
}

function ensureSpace(doc, height) {
  const bounds = pageBounds(doc);
  if (doc.y + height > bounds.bottom - 18) {
    doc.addPage();
  }
}

function sectionHeading(doc, title, subtitle) {
  ensureSpace(doc, subtitle ? 46 : 30);
  doc.moveDown(0.4);
  doc.font('Font').fontSize(14).fillColor('#0f172a').text(title);
  if (subtitle) {
    doc.fontSize(9).fillColor('#64748b').text(subtitle);
  }
  doc.moveDown(0.35);
  doc.fillColor('#0f172a');
}

function drawKeyValueGrid(doc, entries, columns = 3) {
  const bounds = pageBounds(doc);
  const gap = 8;
  const width = (bounds.right - bounds.left - gap * (columns - 1)) / columns;
  const startX = bounds.left;
  let x = startX;
  let y = doc.y;
  const cardHeight = 42;
  entries.forEach((entry, index) => {
    ensureSpace(doc, cardHeight + 8);
    if (index > 0 && index % columns === 0) {
      x = startX;
      y += cardHeight + gap;
      doc.y = y;
    }
    doc.roundedRect(x, y, width, cardHeight, 4).fillAndStroke('#f8fafc', '#e2e8f0');
    doc.fontSize(7).fillColor('#64748b').text(entry.label, x + 8, y + 8, { width: width - 16 });
    doc.fontSize(12).fillColor('#0f172a').text(String(entry.value ?? '-'), x + 8, y + 21, { width: width - 16 });
    x += width + gap;
  });
  doc.y = y + cardHeight + 12;
}

function drawTable(doc, columns, rows, options = {}) {
  const bounds = pageBounds(doc);
  const availableWidth = bounds.right - bounds.left;
  const requestedWidth = columns.reduce((sum, column) => sum + column.width, 0);
  const scale = requestedWidth > availableWidth ? availableWidth / requestedWidth : 1;
  const scaledColumns = columns.map((column) => ({
    ...column,
    width: Math.floor(column.width * scale),
  }));
  const tableWidth = scaledColumns.reduce((sum, column) => sum + column.width, 0);
  const rowGap = 5;
  const padding = 4;
  const headerHeight = options.headerHeight || 20;
  const minRowHeight = options.minRowHeight || 18;
  const fontSize = options.fontSize || 7.5;

  function drawHeader() {
    ensureSpace(doc, headerHeight + minRowHeight);
    const y = doc.y;
    let x = bounds.left;
    doc.rect(bounds.left, y, tableWidth, headerHeight).fill('#e2e8f0');
    for (const column of scaledColumns) {
      doc.fontSize(7).fillColor('#334155').text(column.label, x + padding, y + 6, { width: column.width - padding * 2, align: column.align || 'left' });
      x += column.width;
    }
    doc.fillColor('#0f172a');
    doc.y = y + headerHeight;
  }

  drawHeader();
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    const cellHeights = scaledColumns.map((column) => {
      const text = String(row[column.key] ?? '-');
      return doc.fontSize(fontSize).heightOfString(text, { width: column.width - padding * 2 }) + rowGap * 2;
    });
    const height = Math.max(minRowHeight, ...cellHeights);
    if (doc.y + height > bounds.bottom - 18) {
      doc.addPage();
      drawHeader();
    }
    const y = doc.y;
    let x = bounds.left;
    doc.rect(bounds.left, y, tableWidth, height).fill(options.striped && rowIndex % 2 ? '#f8fafc' : '#ffffff');
    for (const column of scaledColumns) {
      doc.rect(x, y, column.width, height).strokeColor('#e2e8f0').lineWidth(0.35).stroke();
      doc.fontSize(fontSize).fillColor('#0f172a').text(String(row[column.key] ?? '-'), x + padding, y + rowGap, {
        width: column.width - padding * 2,
        height: height - rowGap * 2,
        align: column.align || 'left',
      });
      x += column.width;
    }
    doc.y = y + height;
  }
  doc.moveDown(0.8);
}

function renderSummarySection(doc, model) {
  doc.fontSize(20).fillColor('#0f172a').text(model.examLabel ? 'Examus Tekil Sınav Raporu' : 'Examus Operasyon Raporu', { align: 'left' });
  doc.moveDown(0.2);
  doc.fontSize(10).fillColor('#64748b').text(`${model.summary.periodName} | ${model.summary.status} | ${model.summary.strategy}`);
  if (model.examLabel) {
    doc.fontSize(12).fillColor('#0f172a').text(model.examLabel);
  }
  doc.moveDown(0.8);
  drawKeyValueGrid(doc, [
    { label: 'Skor', value: model.summary.score },
    { label: 'Sınav', value: model.summary.examCount },
    { label: 'Atanan öğrenci', value: model.summary.assignedStudents },
    { label: 'Kullanılan salon-slot', value: model.summary.roomSlotCount },
    { label: 'Gözetmen', value: model.summary.invigilatorCount },
    { label: 'Kullanılan gün', value: model.summary.usedDayCount },
    { label: 'Kapsam', value: model.summary.examCoveragePercent != null ? `%${model.summary.examCoveragePercent}` : '-' },
    { label: 'Ortalama fiziksel doluluk', value: formatPercent(model.summary.averagePhysicalUtilization) },
    { label: 'Boş fiziksel kapasite', value: model.summary.totalPhysicalUnusedCapacity ?? '-' },
  ]);

  sectionHeading(doc, 'Uyarı Özeti');
  drawTable(doc, [
    { key: 'severity', label: 'Seviye', width: 90 },
    { key: 'count', label: 'Adet', width: 50, align: 'right' },
    { key: 'description', label: 'Açıklama', width: 360 },
  ], [
    { severity: 'hard', count: model.warningSummary.hard || 0, description: 'Export öncesi durdurucu kalite/validasyon riski.' },
    { severity: 'soft', count: model.warningSummary.soft || 0, description: 'Plan uygulanabilir, ancak operasyon ekibinin görmesi gereken uyarılar.' },
    { severity: 'info', count: model.warningSummary.info || 0, description: 'Bilgilendirme amaçlı notlar.' },
  ], { striped: true });
}

function renderCalendarSection(doc, model) {
  sectionHeading(doc, 'Genel Takvim', 'Salon verimliliği sınav kapasitesi ve fiziksel kapasite olarak ayrı gösterilir.');
  drawTable(doc, [
    { key: 'date', label: 'Tarih', width: 58 },
    { key: 'time', label: 'Saat', width: 58 },
    { key: 'classroom', label: 'Derslik', width: 92 },
    { key: 'courses', label: 'Dersler', width: 142 },
    { key: 'count', label: 'Öğr.', width: 36, align: 'right' },
    { key: 'examUtil', label: 'Sınav kap.', width: 62 },
    { key: 'physicalUtil', label: 'Fiziksel', width: 62 },
    { key: 'invigilators', label: 'Gözetmen', width: 120 },
    { key: 'mixed', label: 'Karma', width: 42 },
  ], model.slotRows.map((row) => ({
    date: row.date,
    time: row.time,
    classroom: row.classroom,
    courses: row.courseCodes,
    count: row.assignedCount,
    examUtil: `${row.assignedCount}/${row.examCapacity} ${formatPercent(row.examUtilization)}`,
    physicalUtil: `${row.assignedCount}/${row.physicalCapacity} ${formatPercent(row.physicalUtilization)}`,
    invigilators: row.invigilatorNames || '-',
    mixed: row.mixed,
  })), { striped: true, fontSize: 7, minRowHeight: 22 });
}

function renderWarningsSection(doc, model) {
  if (model.warnings.length === 0) return;
  sectionHeading(doc, 'Uyarılar ve Kalite Notları');
  drawTable(doc, [
    { key: 'severity', label: 'Seviye', width: 60 },
    { key: 'code', label: 'Kod', width: 125 },
    { key: 'exam', label: 'Sınav', width: 80 },
    { key: 'message', label: 'Mesaj', width: 355 },
  ], model.warnings.map((warning) => ({
    severity: warning.severity || 'info',
    code: warning.code || warning.type || '-',
    exam: warning.examId || '-',
    message: warning.message || '-',
  })), { striped: true, fontSize: 7.5, minRowHeight: 22 });
}

function seatBookletLabel(assignment) {
  return assignment.bookletType ? ` (${assignment.bookletType})` : '';
}

function drawSeatGrid(doc, slotRow) {
  const { slot, seats } = slotRow;
  const classroom = slot.classroom;
  const bounds = pageBounds(doc);
  const rows = Number(classroom.rowCount || 0) || Math.max(1, ...classroom.seats.map((seat) => seat.row || 1));
  const columns = Number(classroom.columnCount || 0) || Math.max(1, ...classroom.seats.map((seat) => seat.column || 1));
  const maxWidth = bounds.right - bounds.left;
  const cellGap = 2;
  const cellWidth = Math.max(28, Math.min(54, (maxWidth - cellGap * (columns - 1)) / columns));
  const cellHeight = 24;
  const gridWidth = columns * cellWidth + (columns - 1) * cellGap;
  const gridHeight = rows * cellHeight + (rows - 1) * cellGap;
  ensureSpace(doc, gridHeight + 20);
  const startX = bounds.left;
  const startY = doc.y;
  const seatsByPosition = new Map(classroom.seats.map((seat) => [`${seat.row}:${seat.column}`, seat]));
  const assignmentsBySeat = new Map(seats.map((assignment) => [assignment.seatId, assignment]));

  for (let row = 1; row <= rows; row += 1) {
    for (let column = 1; column <= columns; column += 1) {
      const x = startX + (column - 1) * (cellWidth + cellGap);
      const y = startY + (row - 1) * (cellHeight + cellGap);
      const seat = seatsByPosition.get(`${row}:${column}`);
      const assignment = seat ? assignmentsBySeat.get(seat.id) : null;
      const disabled = !seat || seat.status !== 'AKTIF';
      const assignmentColor = assignment ? courseColor(assignment.exam.course.code) : null;
      const cellFill = disabled ? '#f1f5f9' : assignmentColor ? assignmentColor.fill : '#ffffff';
      const cellStroke = assignmentColor ? assignmentColor.border : '#cbd5e1';
      doc.roundedRect(x, y, cellWidth, cellHeight, 2).fillAndStroke(cellFill, cellStroke);
      const label = disabled ? 'X' : assignment ? `${assignment.seat.label} ${assignment.exam.course.code}${seatBookletLabel(assignment)}` : seat.label;
      const labelColor = disabled ? '#94a3b8' : assignmentColor ? assignmentColor.text : '#0f172a';
      doc.fontSize(5.6).fillColor(labelColor).text(label, x + 2, y + 5, {
        width: cellWidth - 4,
        height: cellHeight - 6,
        align: 'center',
      });
    }
  }
  doc.y = startY + gridHeight + 10;
  doc.fillColor('#0f172a');
}

function renderClassroomSection(doc, model, includeStudentLists = true) {
  sectionHeading(doc, 'Salon Kullanımı ve Kapı Listeleri', 'Her salon-slot için öğrenci listesi, kapasite metrikleri ve koltuk grid’i.');
  for (const row of model.slotRows) {
    if (doc.y > 90) doc.addPage({ layout: 'portrait' });
    ensureSpace(doc, 120);
    doc.fontSize(12).fillColor('#0f172a').text(`${row.classroom} ${row.mixed === 'Evet' ? '(Karma Salon)' : ''}`);
    doc.fontSize(8).fillColor('#64748b').text(`${row.date} ${row.time} | ${row.courses}`);
    doc.fontSize(8).fillColor('#0f172a').text(`Atanan: ${row.assignedCount} | Sınav kapasitesi: ${row.assignedCount}/${row.examCapacity} ${formatPercent(row.examUtilization)} | Fiziksel salon: ${row.assignedCount}/${row.physicalCapacity} ${formatPercent(row.physicalUtilization)} | Gözetmen: ${row.invigilatorNames || '-'}`);
    if (row.specialNeeds !== '-') {
      doc.fontSize(8).fillColor('#b45309').text(`Özel ihtiyaç özeti: ${row.specialNeeds}`);
    }
    if (row.warnings) {
      doc.fontSize(8).fillColor('#b91c1c').text(`Uyarı kodları: ${row.warningCodes || 'Detaylar uyarılar bölümünde'}`);
    }
    doc.moveDown(0.3);
    drawSeatGrid(doc, row);
    if (includeStudentLists) {
      drawTable(doc, [
        { key: 'seat', label: 'Koltuk', width: 48 },
        { key: 'studentNo', label: 'Öğrenci No', width: 76 },
        { key: 'student', label: 'Ad Soyad', width: 128 },
        { key: 'course', label: 'Ders', width: 68 },
        { key: 'booklet', label: 'Kitapçık', width: 46 },
        { key: 'note', label: 'Özel İhtiyaç / Not', width: 174 },
      ], sortedSeatAssignments(row.seats).map((assignment) => ({
        seat: assignment.seat.label,
        studentNo: assignment.student.studentNo,
        student: assignment.student.fullName,
        course: assignment.exam.course.code,
        booklet: assignment.bookletType || '-',
        note: specialNeedNote(assignment.student) || '-',
      })), { striped: true, fontSize: 7, minRowHeight: 18 });
    }
    doc.moveDown(0.4);
  }
}

function renderStudentSection(doc, model) {
  sectionHeading(doc, 'Öğrenci Oturma Planı', 'Öğrenci no + ad, salon, koltuk, ders ve özel ihtiyaç bilgileri.');
  const rows = [];
  for (const slotRow of model.slotRows) {
    for (const assignment of sortedSeatAssignments(slotRow.seats)) {
      rows.push({
        date: slotRow.date,
        time: slotRow.time,
        classroom: slotRow.classroom,
        seat: assignment.seat.label,
        studentNo: assignment.student.studentNo,
        student: assignment.student.fullName,
        course: assignment.exam.course.code,
        booklet: assignment.bookletType || '-',
        note: specialNeedNote(assignment.student) || '-',
      });
    }
  }
  drawTable(doc, [
    { key: 'date', label: 'Tarih', width: 58 },
    { key: 'time', label: 'Saat', width: 56 },
    { key: 'classroom', label: 'Derslik', width: 96 },
    { key: 'seat', label: 'Koltuk', width: 42 },
    { key: 'studentNo', label: 'Öğrenci No', width: 70 },
    { key: 'student', label: 'Ad Soyad', width: 112 },
    { key: 'course', label: 'Ders', width: 54 },
    { key: 'booklet', label: 'Kit.', width: 32 },
    { key: 'note', label: 'Not', width: 84 },
  ], rows, { striped: true, fontSize: 6.8, minRowHeight: 18 });
}

function renderInvigilatorSection(doc, model) {
  sectionHeading(doc, 'Gözetmen Görev Listesi', 'Görev yükü günlük ve toplam sayaçlarla birlikte gösterilir.');
  drawTable(doc, [
    { key: 'name', label: 'Gözetmen', width: 112 },
    { key: 'staffNo', label: 'Sicil', width: 48 },
    { key: 'date', label: 'Tarih', width: 56 },
    { key: 'time', label: 'Saat', width: 54 },
    { key: 'classroom', label: 'Derslik', width: 92 },
    { key: 'courses', label: 'Dersler', width: 112 },
    { key: 'role', label: 'Rol', width: 40 },
    { key: 'dailyCount', label: 'Gün', width: 32, align: 'right' },
    { key: 'totalCount', label: 'Top.', width: 32, align: 'right' },
    { key: 'note', label: 'Not', width: 74 },
  ], model.invigilatorRows, { striped: true, fontSize: 6.8, minRowHeight: 18 });
}

function renderPdfByType(doc, model, type) {
  if (type === 'full' && model.userRole === 'INVIGILATOR') {
    renderSummarySection(doc, model);
    doc.addPage({ layout: 'portrait' });
    renderClassroomSection(doc, model, true);
    doc.addPage({ layout: 'landscape' });
    renderInvigilatorSection(doc, model);
    renderWarningsSection(doc, model);
    return;
  }
  if (type === 'full' && model.userRole === 'INSTRUCTOR') {
    renderSummarySection(doc, model);
    doc.addPage({ layout: 'landscape' });
    renderCalendarSection(doc, model);
    doc.addPage({ layout: 'portrait' });
    renderClassroomSection(doc, model, true);
    renderWarningsSection(doc, model);
    return;
  }
  if (type === 'full' && model.userRole === 'STUDENT') {
    renderStudentSection(doc, model);
    return;
  }
  if (type === 'exam') {
    renderSummarySection(doc, model);
    doc.addPage({ layout: 'portrait' });
    renderClassroomSection(doc, model, true);
    doc.addPage({ layout: 'landscape' });
    renderInvigilatorSection(doc, model);
    doc.addPage({ layout: 'landscape' });
    renderStudentSection(doc, model);
    renderWarningsSection(doc, model);
    return;
  }
  if (type === 'full') {
    renderSummarySection(doc, model);
    doc.addPage({ layout: 'landscape' });
    renderCalendarSection(doc, model);
    doc.addPage({ layout: 'portrait' });
    renderClassroomSection(doc, model, true);
    doc.addPage({ layout: 'landscape' });
    renderInvigilatorSection(doc, model);
    doc.addPage({ layout: 'landscape' });
    renderStudentSection(doc, model);
    renderWarningsSection(doc, model);
    return;
  }
  if (type === 'classrooms') {
    renderClassroomSection(doc, model, true);
    return;
  }
  if (type === 'students') {
    renderStudentSection(doc, model);
    return;
  }
  if (type === 'invigilators') {
    renderInvigilatorSection(doc, model);
    return;
  }
  renderSummarySection(doc, model);
  doc.addPage({ layout: 'landscape' });
  renderCalendarSection(doc, model);
  renderWarningsSection(doc, model);
}

function streamScenarioPdfData(scenario, res, type = 'calendar', options = {}) {
  assertScenarioExportable(scenario);
  const model = buildPdfReportModel(scenario, options);
  if (options.examId && model.slotRows.length === 0) {
    const error = new Error('Bu senaryoda seçilen sınav için export verisi bulunamadı.');
    error.status = 404;
    throw error;
  }
  const sectionTitles = {
    full: 'Kapsamlı Operasyon PDF',
    calendar: 'Takvim PDF',
    classrooms: 'Salon PDF',
    students: 'Öğrenci/Oturma PDF',
    invigilators: 'Gözetmen PDF',
    exam: 'Tekil Sınav PDF',
  };
  const doc = createPdfDocument(res, model, sectionTitles[type] || sectionTitles.calendar, {
    layout: type === 'calendar' || type === 'students' || type === 'invigilators' ? 'landscape' : 'portrait',
  });
  renderPdfByType(doc, model, type);
  finalizePageNumbers(doc, model);
  doc.end();
}

async function streamScenarioPdf(scenarioId, res, type = 'calendar', user = null) {
  const scenario = await getScenarioReportData(scenarioId, user);
  streamScenarioPdfData(scenario, res, type, { userRole: user?.role || 'ADMIN' });
}

async function streamScenarioExamPdf(scenarioId, examId, res, user = null) {
  const scenario = await getScenarioReportData(scenarioId, user);
  streamScenarioPdfData(scenario, res, 'exam', { examId, userRole: user?.role || 'ADMIN' });
}

async function streamPdf(scenarioId, res) {
  return streamScenarioPdf(scenarioId, res, 'calendar');
}

module.exports = {
  assertScenarioExportable,
  buildCalendarWorkbook,
  buildPdfReportModel,
  buildScenarioWorkbookData,
  buildScenarioWorkbook,
  getScenarioReportData,
  streamPdf,
  streamScenarioPdfData,
  streamScenarioExamPdf,
  streamScenarioPdf,
};
