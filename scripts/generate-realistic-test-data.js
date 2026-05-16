#!/usr/bin/env node
require('dotenv').config();

const prisma = require('../src/config/prisma');

const RESET = process.argv.includes('--reset');
const RUN = process.argv.includes('--run');
const PREFIX = 'TST';
const PERIOD_NAME = '2026 Guz Final Gercekci Test';
const SCENARIO_NAME = 'Gercekci Test - Kesin Optimizasyon';

function rng(seed = 42) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

const random = rng(20260517);

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function sample(items, count) {
  return shuffle(items).slice(0, Math.min(count, items.length));
}

function date(value) {
  return new Date(`${value}T00:00:00.000Z`);
}

function seatRows(room) {
  const seats = [];
  for (let row = 1; row <= room.rowCount; row += 1) {
    for (let column = 1; column <= room.columnCount; column += 1) {
      seats.push({
        label: `${row}-${column}`,
        row,
        column,
        status: 'AKTIF',
        capacity: 1,
      });
    }
  }
  return seats.slice(0, room.capacity);
}

const classrooms = [
  { code: 'TST-LAB-1', name: 'Elektronik Laboratuvari 1', building: 'L', floor: '1', capacity: 32, rowCount: 4, columnCount: 8, roomType: 'LAB', features: { computer: true, accessible: true } },
  { code: 'TST-BZ-05', name: 'Bilisim Laboratuvari Z05', building: 'B', floor: 'Z', capacity: 36, rowCount: 6, columnCount: 6, roomType: 'LAB', features: { computer: true } },
  { code: 'TST-BZ-04', name: 'Bilisim Laboratuvari Z04', building: 'B', floor: 'Z', capacity: 40, rowCount: 5, columnCount: 8, roomType: 'LAB', features: { computer: true } },
  { code: 'TST-C301', name: 'Derslik C301', building: 'C', floor: '3', capacity: 45, rowCount: 5, columnCount: 9, features: { accessible: true } },
  { code: 'TST-C302', name: 'Derslik C302', building: 'C', floor: '3', capacity: 48, rowCount: 6, columnCount: 8, features: {} },
  { code: 'TST-B202', name: 'Derslik B202', building: 'B', floor: '2', capacity: 54, rowCount: 6, columnCount: 9, features: {} },
  { code: 'TST-B201', name: 'Derslik B201', building: 'B', floor: '2', capacity: 60, rowCount: 6, columnCount: 10, features: { accessible: true } },
  { code: 'TST-A102', name: 'Amfi A102', building: 'A', floor: '1', capacity: 100, rowCount: 10, columnCount: 10, features: {} },
  { code: 'TST-A101', name: 'Amfi A101', building: 'A', floor: '1', capacity: 120, rowCount: 10, columnCount: 12, features: { accessible: true } },
  { code: 'TST-D110', name: 'Konferans Salonu D110', building: 'D', floor: '1', capacity: 150, rowCount: 10, columnCount: 15, features: {} },
];

const courses = [
  { code: 'TST-BIL101', name: 'Programlamaya Giris', department: 'Bilgisayar Muhendisligi', target: 72, durationMinutes: 120, bookletTypes: ['A', 'B'], specialRules: { allowMixedRoom: false }, pinned: { date: '2026-12-07', startTime: '09:00', endTime: '11:00' } },
  { code: 'TST-MAT101', name: 'Matematik I', department: 'Bilgisayar Muhendisligi', target: 64, durationMinutes: 120, specialRules: { allowMixedRoom: false }, pinned: { date: '2026-12-07', startTime: '12:00', endTime: '14:00' } },
  { code: 'TST-FIZ102', name: 'Fizik II', department: 'Muhendislik', target: 48, durationMinutes: 90, specialRules: { allowMixedRoom: false }, pinned: { date: '2026-12-08', startTime: '09:00', endTime: '10:30' } },
  { code: 'TST-ING101', name: 'Akademik Ingilizce', department: 'Ortak Dersler', target: 34, durationMinutes: 60, bookletTypes: ['A', 'B', 'C', 'D'], specialRules: { allowMixedRoom: false } },
  { code: 'TST-BIL201', name: 'Veri Yapilari', department: 'Bilgisayar Muhendisligi', target: 32, durationMinutes: 90, specialRules: { allowMixedRoom: false } },
  { code: 'TST-BIL203', name: 'Ayrik Matematik', department: 'Bilgisayar Muhendisligi', target: 30, durationMinutes: 90, specialRules: { allowMixedRoom: false } },
  { code: 'TST-YAZ210', name: 'Yazilim Gereksinimleri', department: 'Yazilim Muhendisligi', target: 24, durationMinutes: 90 },
  { code: 'TST-BIL305', name: 'Veritabani Sistemleri', department: 'Bilgisayar Muhendisligi', target: 58, durationMinutes: 90, bookletTypes: ['A', 'B'], specialRules: { allowMixedRoom: false }, pinned: { date: '2026-12-09', startTime: '12:00', endTime: '13:30' } },
  { code: 'TST-YAZ310', name: 'Yazilim Mimarisi', department: 'Yazilim Muhendisligi', target: 56, durationMinutes: 75, specialRules: { allowMixedRoom: false }, pinned: { date: '2026-12-10', startTime: '09:00', endTime: '10:15' } },
  { code: 'TST-EEM303', name: 'Sinyaller ve Sistemler', department: 'Elektrik Elektronik Muhendisligi', target: 27, durationMinutes: 90, specialRules: { allowMixedRoom: false } },
  { code: 'TST-END220', name: 'Yoneylem Arastirmasi', department: 'Endustri Muhendisligi', target: 8, durationMinutes: 90 },
  { code: 'TST-END315', name: 'Uretim Planlama', department: 'Endustri Muhendisligi', target: 29, durationMinutes: 75, specialRules: { allowMixedRoom: false } },
  { code: 'TST-LAB240', name: 'Sayisal Tasarim Laboratuvari', department: 'Bilgisayar Muhendisligi', target: 28, durationMinutes: 120, requiredRoomType: 'LAB', requiredFeatures: { computer: true }, bookletTypes: ['A', 'B', 'C', 'D'], specialRules: { allowMixedRoom: false }, pinned: { date: '2026-12-08', startTime: '12:00', endTime: '14:00' } },
  { code: 'TST-EEM201', name: 'Devre Teorisi', department: 'Elektrik Elektronik Muhendisligi', target: 0, durationMinutes: 90 },
];

const invigilators = [
  ['TST-G001', 'Prof. Dr.', 'Murat', 'Kaya', 'Bilgisayar Muhendisligi', 4, 8, { maxPerDay: 2, preferredBuildings: ['A', 'B'] }],
  ['TST-G002', 'Doc. Dr.', 'Cem', 'Celik', 'Bilgisayar Muhendisligi', 4, 6, { maxPerDay: 2 }],
  ['TST-G003', 'Dr. Ogr. Uyesi', 'Elif', 'Karaca', 'Yazilim Muhendisligi', 4, 5, { maxPerDay: 2 }],
  ['TST-G004', 'Dr. Ogr. Uyesi', 'Mehmet', 'Kaya', 'Elektrik Elektronik Muhendisligi', 4, 5, { maxPerDay: 2 }],
  ['TST-G005', 'Ogr. Gor.', 'Ayse', 'Demir', 'Ortak Dersler', 5, 4, { maxPerDay: 3 }],
  ['TST-G006', 'Ogr. Gor.', 'Deniz', 'Acar', 'Endustri Muhendisligi', 4, 4, { maxPerDay: 2 }],
  ['TST-G007', 'Ars. Gor.', 'Ahmet', 'Yilmaz', 'Bilgisayar Muhendisligi', 5, 3, { maxPerDay: 3, avoidBackToBack: true }],
  ['TST-G008', 'Ars. Gor.', 'Selin', 'Ak', 'Bilgisayar Muhendisligi', 5, 3, { maxPerDay: 3 }],
  ['TST-G009', 'Ars. Gor.', 'Zeynep', 'Sahin', 'Yazilim Muhendisligi', 5, 3, { maxPerDay: 3 }],
  ['TST-G010', 'Ars. Gor.', 'Ece', 'Korkmaz', 'Elektrik Elektronik Muhendisligi', 5, 3, { maxPerDay: 3 }],
  ['TST-G011', 'Ars. Gor.', 'Burak', 'Aydin', 'Endustri Muhendisligi', 5, 2, { maxPerDay: 3 }],
  ['TST-G012', 'Ars. Gor.', 'Irem', 'Yildiz', 'Ortak Dersler', 5, 2, { maxPerDay: 3 }],
];

function buildStudents() {
  const firstNames = ['Ali', 'Ayse', 'Mehmet', 'Elif', 'Emir', 'Zeynep', 'Deniz', 'Selin', 'Ece', 'Mert', 'Derya', 'Onur', 'Kerem', 'Yagmur', 'Can', 'Seda'];
  const lastNames = ['Yilmaz', 'Kaya', 'Demir', 'Celik', 'Sahin', 'Aydin', 'Korkmaz', 'Arslan', 'Yildiz', 'Bulut', 'Ozturk', 'Kara'];
  const cohorts = [
    ['BIL1', 'Bilgisayar Muhendisligi', 1, 76],
    ['BIL2', 'Bilgisayar Muhendisligi', 2, 48],
    ['BIL3', 'Bilgisayar Muhendisligi', 3, 62],
    ['YAZ2', 'Yazilim Muhendisligi', 2, 34],
    ['YAZ3', 'Yazilim Muhendisligi', 3, 48],
    ['EEM3', 'Elektrik Elektronik Muhendisligi', 3, 34],
    ['END3', 'Endustri Muhendisligi', 3, 36],
  ];
  const output = [];
  let index = 1;
  for (const [cohort, department, classLevel, count] of cohorts) {
    for (let i = 0; i < count; i += 1) {
      const first = firstNames[(index + i) % firstNames.length];
      const last = lastNames[(index * 3 + i) % lastNames.length];
      const specialNeeds = index % 37 === 0 ? 'Ek süre'
        : index % 53 === 0 ? 'Ön sıra'
          : index % 71 === 0 ? 'Düşük dikkat dağıtımı'
            : null;
      output.push({
        cohort,
        studentNo: `TST${String(index).padStart(5, '0')}`,
        fullName: `${first} ${last}`,
        department,
        classLevel,
        specialNeeds,
      });
      index += 1;
    }
  }
  return output;
}

function coursePools(students) {
  const byCohort = new Map();
  for (const student of students) {
    if (!byCohort.has(student.cohort)) byCohort.set(student.cohort, []);
    byCohort.get(student.cohort).push(student.studentNo);
  }
  const get = (...keys) => keys.flatMap((key) => byCohort.get(key) || []);
  return {
    'TST-BIL101': get('BIL1'),
    'TST-MAT101': get('BIL1', 'YAZ2'),
    'TST-FIZ102': get('BIL1', 'EEM3'),
    'TST-ING101': get('BIL1', 'YAZ2', 'END3'),
    'TST-BIL201': get('BIL2'),
    'TST-BIL203': get('BIL2', 'YAZ2'),
    'TST-YAZ210': get('YAZ2', 'BIL2'),
    'TST-BIL305': get('BIL3', 'YAZ3'),
    'TST-YAZ310': get('YAZ3', 'BIL3'),
    'TST-EEM303': get('EEM3', 'BIL3'),
    'TST-END220': get('END3', 'YAZ3'),
    'TST-END315': get('END3'),
    'TST-LAB240': get('BIL2', 'EEM3'),
    'TST-EEM201': [],
  };
}

async function clearGeneratedData() {
  const period = await prisma.examPeriod.findFirst({ where: { name: PERIOD_NAME }, select: { id: true } });
  if (period) {
    await prisma.planningScenario.deleteMany({ where: { periodId: period.id } });
    await prisma.exam.deleteMany({ where: { periodId: period.id } });
    await prisma.examPeriod.delete({ where: { id: period.id } });
  }

  const generatedCourses = await prisma.course.findMany({ where: { code: { startsWith: `${PREFIX}-` } }, select: { id: true } });
  const generatedStudents = await prisma.student.findMany({ where: { studentNo: { startsWith: PREFIX } }, select: { id: true } });
  const generatedInvigilators = await prisma.invigilator.findMany({ where: { staffNo: { startsWith: `${PREFIX}-` } }, select: { id: true } });

  await prisma.courseEnrollment.deleteMany({ where: { OR: [{ courseId: { in: generatedCourses.map((item) => item.id) } }, { studentId: { in: generatedStudents.map((item) => item.id) } }] } });
  await prisma.availability.deleteMany({ where: { invigilatorId: { in: generatedInvigilators.map((item) => item.id) } } });
  await prisma.invigilator.deleteMany({ where: { staffNo: { startsWith: `${PREFIX}-` } } });
  await prisma.student.deleteMany({ where: { studentNo: { startsWith: PREFIX } } });
  await prisma.course.deleteMany({ where: { code: { startsWith: `${PREFIX}-` } } });
  await prisma.classroom.deleteMany({ where: { code: { startsWith: `${PREFIX}-` } } });
}

async function upsertClassrooms() {
  const created = [];
  for (const room of classrooms) {
    const classroom = await prisma.classroom.upsert({
      where: { code: room.code },
      update: {
        name: room.name,
        building: room.building,
        floor: room.floor,
        capacity: room.capacity,
        rowCount: room.rowCount,
        columnCount: room.columnCount,
        roomType: room.roomType || null,
        features: room.features,
      },
      create: {
        code: room.code,
        name: room.name,
        building: room.building,
        floor: room.floor,
        capacity: room.capacity,
        rowCount: room.rowCount,
        columnCount: room.columnCount,
        roomType: room.roomType || null,
        features: room.features,
      },
    });
    for (const seat of seatRows(room)) {
      await prisma.seat.upsert({
        where: { classroomId_row_column: { classroomId: classroom.id, row: seat.row, column: seat.column } },
        update: { label: seat.label, status: seat.status, capacity: seat.capacity },
        create: { classroomId: classroom.id, ...seat },
      });
    }
    created.push(classroom);
  }
  return created;
}

async function upsertStudents() {
  const rows = buildStudents();
  const created = [];
  for (const student of rows) {
    const row = await prisma.student.upsert({
      where: { studentNo: student.studentNo },
      update: {
        fullName: student.fullName,
        department: student.department,
        classLevel: student.classLevel,
        specialNeeds: student.specialNeeds,
      },
      create: {
        studentNo: student.studentNo,
        fullName: student.fullName,
        department: student.department,
        classLevel: student.classLevel,
        specialNeeds: student.specialNeeds,
      },
    });
    created.push({ ...row, cohort: student.cohort });
  }
  return created;
}

async function upsertCoursesAndEnrollments(students) {
  const pools = coursePools(students);
  const studentsByNo = new Map(students.map((student) => [student.studentNo, student]));
  const created = [];
  for (const course of courses) {
    const selectedNos = sample(pools[course.code] || [], course.target);
    const row = await prisma.course.upsert({
      where: { code: course.code },
      update: {
        name: course.name,
        department: course.department,
        studentCount: selectedNos.length,
        durationMinutes: course.durationMinutes,
        examType: 'FINAL',
        specialRules: course.specialRules || null,
        requiredRoomType: course.requiredRoomType || null,
        requiredFeatures: course.requiredFeatures || null,
        bookletTypes: course.bookletTypes || null,
      },
      create: {
        code: course.code,
        name: course.name,
        department: course.department,
        studentCount: selectedNos.length,
        durationMinutes: course.durationMinutes,
        examType: 'FINAL',
        specialRules: course.specialRules || null,
        requiredRoomType: course.requiredRoomType || null,
        requiredFeatures: course.requiredFeatures || null,
        bookletTypes: course.bookletTypes || null,
      },
    });
    await prisma.courseEnrollment.deleteMany({ where: { courseId: row.id } });
    if (selectedNos.length > 0) {
      await prisma.courseEnrollment.createMany({
        data: selectedNos.map((studentNo) => ({ courseId: row.id, studentId: studentsByNo.get(studentNo).id })),
        skipDuplicates: true,
      });
    }
    created.push({
      ...row,
      selectedNos,
      pinned: course.pinned || null,
      specialRules: course.specialRules || null,
      requiredRoomType: course.requiredRoomType || null,
      requiredFeatures: course.requiredFeatures || null,
      bookletTypes: course.bookletTypes || null,
    });
  }
  return created;
}

async function upsertInvigilators() {
  const dates = ['2026-12-07', '2026-12-08', '2026-12-09', '2026-12-10', '2026-12-11', '2026-12-12'];
  const created = [];
  for (const [staffNo, title, firstName, lastName, department, maxAssignments, priority, constraints] of invigilators) {
    const row = await prisma.invigilator.upsert({
      where: { staffNo },
      update: { title, firstName, lastName, department, maxAssignments, priority, constraints },
      create: { staffNo, title, firstName, lastName, department, maxAssignments, priority, constraints, email: `${staffNo.toLowerCase()}@example.edu` },
    });
    await prisma.availability.deleteMany({ where: { invigilatorId: row.id } });
    await prisma.availability.createMany({
      data: dates.map((day) => ({
        invigilatorId: row.id,
        date: date(day),
        startTime: '08:30',
        endTime: '17:30',
        status: 'MUSAIT',
      })),
    });
    created.push(row);
  }

  const blocked = created.slice(0, 3);
  await prisma.availability.createMany({
    data: blocked.map((invigilator, index) => ({
      invigilatorId: invigilator.id,
      date: date(index === 0 ? '2026-12-08' : '2026-12-10'),
      startTime: '12:00',
      endTime: '14:30',
      status: 'MUSAIT_DEGIL',
    })),
  });
  return created;
}

async function upsertPeriod() {
  const slots = [
    { startTime: '09:00', endTime: '11:00' },
    { startTime: '12:00', endTime: '14:00' },
    { startTime: '15:00', endTime: '17:00' },
  ];
  const existing = await prisma.examPeriod.findFirst({ where: { name: PERIOD_NAME } });
  if (existing) {
    return prisma.examPeriod.update({
      where: { id: existing.id },
      data: { startDate: date('2026-12-07'), endDate: date('2026-12-12'), slots, status: 'DRAFT' },
    });
  }
  return prisma.examPeriod.create({
    data: { name: PERIOD_NAME, startDate: date('2026-12-07'), endDate: date('2026-12-12'), slots, status: 'DRAFT' },
  });
}

async function upsertExams(period, createdCourses) {
  const exams = [];
  for (const course of createdCourses) {
    const pinned = Boolean(course.pinned);
    const existing = await prisma.exam.findFirst({ where: { courseId: course.id, periodId: period.id } });
    const data = {
      periodId: period.id,
      durationMinutes: course.durationMinutes,
      type: 'FINAL',
      status: 'DRAFT',
      pinned,
      date: pinned ? date(course.pinned.date) : null,
      startTime: pinned ? course.pinned.startTime : null,
      endTime: pinned ? course.pinned.endTime : null,
      requiredRoomType: course.requiredRoomType,
      requiredFeatures: course.requiredFeatures,
      bookletTypes: course.bookletTypes,
      specialRules: course.specialRules,
    };
    const exam = existing
      ? await prisma.exam.update({ where: { id: existing.id }, data })
      : await prisma.exam.create({ data: { ...data, courseId: course.id } });
    exams.push(exam);
  }
  return exams;
}

async function upsertScenario(period) {
  const existing = await prisma.planningScenario.findFirst({ where: { periodId: period.id, name: SCENARIO_NAME } });
  const data = { strategy: 'optimal_cp_sat', status: 'DRAFT', score: 0, metrics: null, warnings: [] };
  if (existing) return prisma.planningScenario.update({ where: { id: existing.id }, data });
  return prisma.planningScenario.create({ data: { periodId: period.id, name: SCENARIO_NAME, ...data } });
}

async function main() {
  if (RESET) await clearGeneratedData();

  const createdClassrooms = await upsertClassrooms();
  const createdStudents = await upsertStudents();
  const createdCourses = await upsertCoursesAndEnrollments(createdStudents);
  const createdInvigilators = await upsertInvigilators();
  const period = await upsertPeriod();
  const exams = await upsertExams(period, createdCourses);
  const scenario = await upsertScenario(period);

  let runResult = null;
  if (RUN) {
    const { runScenario } = require('../src/services/planningService');
    runResult = await runScenario(scenario.id);
  }

  const summary = {
    reset: RESET,
    period: { id: period.id, name: period.name, startDate: period.startDate, endDate: period.endDate },
    scenario: { id: scenario.id, name: scenario.name, strategy: scenario.strategy },
    counts: {
      classrooms: createdClassrooms.length,
      seats: classrooms.reduce((sum, room) => sum + room.capacity, 0),
      students: createdStudents.length,
      courses: createdCourses.length,
      exams: exams.length,
      zeroEnrollmentCourses: createdCourses.filter((course) => course.studentCount === 0).length,
      invigilators: createdInvigilators.length,
    },
    run: runResult ? {
      status: runResult.status,
      score: runResult.score,
      optimizerStatus: runResult.metrics?.optimizerStatus,
      examCoveragePercent: runResult.metrics?.examCoveragePercent,
      usedDayCount: runResult.metrics?.usedDayCount,
      averagePhysicalRoomUtilization: runResult.metrics?.averagePhysicalRoomUtilization,
      totalPhysicalUnusedCapacity: runResult.metrics?.totalPhysicalUnusedCapacity,
      conflicts: {
        student: runResult.metrics?.studentConflictCount,
        room: runResult.metrics?.roomConflictCount,
        invigilator: runResult.metrics?.invigilatorConflictCount,
      },
    } : null,
  };
  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
