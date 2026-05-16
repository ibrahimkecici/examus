const test = require('node:test');
const assert = require('node:assert/strict');
const { Writable } = require('node:stream');
const {
  assertScenarioExportable,
  buildPdfReportModel,
  buildScenarioWorkbookData,
  streamScenarioPdfData,
} = require('../src/services/reportService');

class BufferSink extends Writable {
  constructor() {
    super();
    this.chunks = [];
  }

  _write(chunk, encoding, callback) {
    this.chunks.push(Buffer.from(chunk));
    callback();
  }

  buffer() {
    return Buffer.concat(this.chunks);
  }
}

class MockResponse extends BufferSink {
  constructor() {
    super();
    this.headers = new Map();
  }

  setHeader(name, value) {
    this.headers.set(String(name).toLowerCase(), value);
  }

  getHeader(name) {
    return this.headers.get(String(name).toLowerCase());
  }
}

function classroom() {
  const seats = [];
  for (let row = 1; row <= 2; row += 1) {
    for (let column = 1; column <= 4; column += 1) {
      seats.push({
        id: `SEAT-${row}-${column}`,
        classroomId: 'ROOM-1',
        label: `${row}-${column}`,
        row,
        column,
        status: row === 2 && column === 4 ? 'PASIF' : 'AKTIF',
        capacity: 1,
      });
    }
  }
  return {
    id: 'ROOM-1',
    code: 'A102',
    name: 'Amfi 102',
    capacity: 8,
    rowCount: 2,
    columnCount: 4,
    seats,
  };
}

function baseScenario(overrides = {}) {
  const room = classroom();
  const course = { id: 'COURSE-1', code: 'MAT101', name: 'Matematik I', bookletTypes: ['A', 'B'] };
  const exam = {
    id: 'EXAM-1',
    course,
    durationMinutes: 90,
    bookletTypes: ['A', 'B'],
  };
  const students = [
    { id: 'STUDENT-1', studentNo: '2026001', fullName: 'Ayşe Demir', specialNeeds: 'Ön sıra' },
    { id: 'STUDENT-2', studentNo: '2026002', fullName: 'Mehmet Kaya', specialNeeds: '' },
  ];
  const slot = {
    id: 'SLOT-1',
    classroomId: room.id,
    classroom: room,
    date: new Date('2026-12-07T00:00:00.000Z'),
    startTime: '09:00',
    endTime: '10:30',
    mixed: false,
    assignments: [{ id: 'ROOM-ASSIGNMENT-1', examId: exam.id, exam, assignedCount: 2 }],
  };
  return {
    id: 'SCENARIO-1',
    name: 'PDF Test Senaryosu',
    status: 'COMPLETED',
    strategy: 'optimal_cp_sat',
    score: 91,
    period: { id: 'PERIOD-1', name: '2026 Final' },
    metrics: {
      examCoveragePercent: 100,
      usedDayCount: 1,
      averagePhysicalRoomUtilization: 0.25,
      totalPhysicalUnusedCapacity: 6,
    },
    warnings: [{ severity: 'soft', code: 'LOW_UTILIZATION', message: 'Fiziksel salon doluluğu düşük.' }],
    schedules: [{
      id: 'SCHEDULE-1',
      examId: exam.id,
      exam,
      date: slot.date,
      startTime: slot.startTime,
      endTime: slot.endTime,
      durationMinutes: 90,
    }],
    roomSlots: [slot],
    rooms: [{ id: 'ROOM-ASSIGNMENT-1', scenarioId: 'SCENARIO-1', examId: exam.id, classroomId: room.id, roomSlotId: slot.id, exam, classroom: room, assignedCount: 2 }],
    seats: students.map((student, index) => ({
      id: `ASSIGNMENT-${student.id}`,
      scenarioId: 'SCENARIO-1',
      examId: exam.id,
      studentId: student.id,
      classroomId: room.id,
      seatId: room.seats[index].id,
      student,
      seat: room.seats[index],
      classroom: room,
      exam,
      bookletType: index === 0 ? 'A' : 'B',
    })),
    invigilators: [{
      id: 'INV-ASSIGNMENT-1',
      examId: exam.id,
      invigilatorId: 'INV-1',
      role: 'SALON',
      invigilator: { id: 'INV-1', staffNo: 'G001', title: 'Dr.', firstName: 'Selin', lastName: 'Aydın' },
      exam,
    }],
    ...overrides,
  };
}

function collectPdf(scenario, type) {
  return new Promise((resolve, reject) => {
    const sink = new BufferSink();
    sink.on('finish', () => resolve(sink.buffer()));
    sink.on('error', reject);
    streamScenarioPdfData(scenario, sink, type);
  });
}

function collectExamPdf(scenario, examId) {
  return new Promise((resolve, reject) => {
    const sink = new BufferSink();
    sink.on('finish', () => resolve(sink.buffer()));
    sink.on('error', reject);
    streamScenarioPdfData(scenario, sink, 'exam', { examId });
  });
}

test('failed scenario with hard warnings is not exportable', () => {
  const scenario = baseScenario({
    status: 'FAILED',
    warnings: [{ severity: 'hard', code: 'HARD_CONFLICT', message: 'Çakışma var.' }],
  });
  assert.throws(() => assertScenarioExportable(scenario), {
    status: 409,
    message: 'Hard validasyon hatası olan senaryo export edilemez.',
  });
});

test('pdf report model keeps exam and physical capacity metrics separate', () => {
  const model = buildPdfReportModel(baseScenario());
  const row = model.slotRows[0];
  assert.equal(row.assignedCount, 2);
  assert.equal(row.physicalCapacity, 8);
  assert.ok(row.examCapacity > 0);
  assert.equal(row.physicalUtilization, 0.25);
  assert.equal(model.summary.examCoveragePercent, 100);
});

test('pdf report model includes seat, student, course, booklet, invigilator, and load data', () => {
  const model = buildPdfReportModel(baseScenario());
  assert.equal(model.slotRows[0].seats[0].student.studentNo, '2026001');
  assert.equal(model.slotRows[0].seats[0].student.fullName, 'Ayşe Demir');
  assert.equal(model.slotRows[0].seats[0].seat.label, '1-1');
  assert.equal(model.slotRows[0].seats[0].bookletType, 'A');
  assert.equal(model.slotRows[0].courseCodes, 'MAT101');
  assert.equal(model.invigilatorRows[0].name, 'Dr. Selin Aydın');
  assert.equal(model.invigilatorRows[0].dailyCount, 1);
  assert.equal(model.invigilatorRows[0].totalCount, 1);
});

test('pdf report model can be filtered to a single exam', () => {
  const scenario = baseScenario();
  const model = buildPdfReportModel(scenario, { examId: 'EXAM-1' });
  assert.equal(model.examLabel, 'MAT101 - Matematik I');
  assert.equal(model.summary.examCount, 1);
  assert.equal(model.summary.assignedStudents, 2);
  assert.equal(model.slotRows.length, 1);
  assert.equal(model.slotRows[0].assignments.length, 1);
});

test('excel workbook exports are scoped by report type and keep warnings separate', () => {
  const scenario = baseScenario();
  const calendarWorkbook = buildScenarioWorkbookData(scenario, 'calendar');
  assert.deepEqual(calendarWorkbook.worksheets.map((sheet) => sheet.name), ['Özet', 'Genel Takvim', 'Uyarılar']);
  assert.equal(calendarWorkbook.getWorksheet('Genel Takvim').getRow(1).values.includes('Uyarı Kodları'), true);
  assert.equal(calendarWorkbook.getWorksheet('Genel Takvim').getRow(1).values.includes('Uyarılar'), false);

  const studentsWorkbook = buildScenarioWorkbookData(scenario, 'students');
  assert.deepEqual(studentsWorkbook.worksheets.map((sheet) => sheet.name), ['Oturma Planı', 'Uyarılar']);
  assert.ok(studentsWorkbook.getWorksheet('Oturma Planı').rowCount > 1);

  const classroomsWorkbook = buildScenarioWorkbookData(scenario, 'classrooms');
  assert.deepEqual(classroomsWorkbook.worksheets.map((sheet) => sheet.name), ['Salon Kapı Listesi', 'Salon Kullanım Özeti', 'Uyarılar']);

  const invigilatorsWorkbook = buildScenarioWorkbookData(scenario, 'invigilators');
  assert.deepEqual(invigilatorsWorkbook.worksheets.map((sheet) => sheet.name), ['Gözetmenler', 'Uyarılar']);
});

test('pdf streams generate non-empty pdf documents for all report types', async () => {
  for (const type of ['full', 'calendar', 'classrooms', 'students', 'invigilators']) {
    const buffer = await collectPdf(baseScenario(), type);
    assert.ok(buffer.length > 1000, `${type} pdf should not be empty`);
    assert.equal(buffer.subarray(0, 4).toString(), '%PDF');
  }
  const examBuffer = await collectExamPdf(baseScenario(), 'EXAM-1');
  assert.ok(examBuffer.length > 1000, 'exam pdf should not be empty');
  assert.equal(examBuffer.subarray(0, 4).toString(), '%PDF');
});

test('pdf routes return application/pdf and non-empty responses', async () => {
  const reportService = require('../src/services/reportService');
  const originalStreamPdf = reportService.streamPdf;
  const originalStreamScenarioPdf = reportService.streamScenarioPdf;
  const originalStreamScenarioExamPdf = reportService.streamScenarioExamPdf;
  reportService.streamPdf = async (scenarioId, res) => streamScenarioPdfData(baseScenario({ id: scenarioId }), res, 'calendar');
  reportService.streamScenarioPdf = async (scenarioId, res, type) => streamScenarioPdfData(baseScenario({ id: scenarioId }), res, type);
  reportService.streamScenarioExamPdf = async (scenarioId, examId, res) => streamScenarioPdfData(baseScenario({ id: scenarioId }), res, 'exam', { examId });

  delete require.cache[require.resolve('../src/routes/reportRoutes')];
  const reportRoutes = require('../src/routes/reportRoutes');

  try {
    for (const path of ['/scenarios/:id/calendar.pdf', '/scenarios/:id/full.pdf', '/scenarios/:id/classrooms.pdf', '/scenarios/:id/students.pdf', '/scenarios/:id/invigilators.pdf', '/scenarios/:id/exams/:examId.pdf']) {
      const layer = reportRoutes.stack.find((item) => item.route?.path === path);
      assert.ok(layer, `${path} route should exist`);
      const handler = layer.route.stack[0].handle;
      const response = new MockResponse();
      const finished = new Promise((resolve, reject) => {
        response.on('finish', resolve);
        response.on('error', reject);
      });
      await new Promise((resolve, reject) => {
        handler({ params: { id: 'SCENARIO-1', examId: 'EXAM-1' } }, response, (error) => (error ? reject(error) : resolve()));
        resolve();
      });
      await finished;
      const buffer = response.buffer();
      assert.equal(response.getHeader('content-type'), 'application/pdf');
      assert.ok(buffer.length > 1000, `${path} response should not be empty`);
      assert.equal(buffer.subarray(0, 4).toString(), '%PDF');
    }
  } finally {
    reportService.streamPdf = originalStreamPdf;
    reportService.streamScenarioPdf = originalStreamScenarioPdf;
    reportService.streamScenarioExamPdf = originalStreamScenarioExamPdf;
    delete require.cache[require.resolve('../src/routes/reportRoutes')];
  }
});
