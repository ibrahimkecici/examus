const prisma = require('../config/prisma');
const { addMinutes, dateRange, overlaps, sameDate } = require('../utils/time');

function defaultSlots(period) {
  if (Array.isArray(period.slots) && period.slots.length > 0) return period.slots;
  return [
    { startTime: '09:00', endTime: '11:00' },
    { startTime: '12:00', endTime: '14:00' },
    { startTime: '15:00', endTime: '17:00' },
  ];
}

function getExamStudents(exam) {
  return exam.course.enrollments.map((enrollment) => enrollment.student);
}

function studentConflict(existing, exam, date, startTime, endTime) {
  const studentIds = new Set(getExamStudents(exam).map((student) => student.id));
  return existing.some((item) => {
    if (!sameDate(item.date, date) || !overlaps(item.startTime, item.endTime, startTime, endTime)) return false;
    return item.studentIds.some((studentId) => studentIds.has(studentId));
  });
}

function findRooms(classrooms, needed, maxRooms) {
  const selected = [];
  let capacity = 0;
  const ordered = [...classrooms].sort((a, b) => b.capacity - a.capacity);

  for (const classroom of ordered) {
    if (maxRooms && selected.length >= maxRooms) break;
    selected.push(classroom);
    capacity += classroom.seats.filter((seat) => seat.status === 'AKTIF').reduce((sum, seat) => sum + seat.capacity, 0);
    if (capacity >= needed) break;
  }

  return capacity >= needed ? selected : [];
}

async function ensurePeriodExams(periodId) {
  const period = await prisma.examPeriod.findUnique({ where: { id: periodId } });
  if (!period) {
    const error = new Error('Sınav dönemi bulunamadı.');
    error.status = 404;
    throw error;
  }

  const courses = await prisma.course.findMany({
    include: { exams: { where: { periodId } } },
  });

  for (const course of courses) {
    if (course.exams.length === 0) {
      await prisma.exam.create({
        data: {
          periodId,
          courseId: course.id,
          durationMinutes: course.durationMinutes,
          type: course.examType,
          specialRules: course.specialRules,
        },
      });
    }
  }

  return period;
}

async function runScenario(scenarioId) {
  const scenario = await prisma.planningScenario.findUnique({
    where: { id: scenarioId },
    include: { period: true },
  });

  if (!scenario) {
    const error = new Error('Planlama senaryosu bulunamadı.');
    error.status = 404;
    throw error;
  }

  await ensurePeriodExams(scenario.periodId);

  const [period, classrooms, invigilators, exams] = await Promise.all([
    prisma.examPeriod.findUnique({ where: { id: scenario.periodId } }),
    prisma.classroom.findMany({ include: { seats: true }, orderBy: { capacity: 'desc' } }),
    prisma.invigilator.findMany({ orderBy: [{ priority: 'desc' }, { lastName: 'asc' }] }),
    prisma.exam.findMany({
      where: { periodId: scenario.periodId },
      include: {
        course: {
          include: {
            enrollments: { include: { student: true } },
          },
        },
      },
    }),
  ]);

  await prisma.$transaction([
    prisma.seatAssignment.deleteMany({ where: { scenarioId } }),
    prisma.invigilatorAssignment.deleteMany({ where: { scenarioId } }),
    prisma.examRoomAssignment.deleteMany({ where: { scenarioId } }),
    prisma.planningScenario.update({ where: { id: scenarioId }, data: { status: 'RUNNING', warnings: [] } }),
  ]);

  const warnings = [];
  const placed = [];
  const invigilatorLoad = new Map();
  let capacityWaste = 0;

  const orderedExams = [...exams].sort((a, b) => getExamStudents(b).length - getExamStudents(a).length);
  const dates = scenario.strategy === 'spread' ? dateRange(period.startDate, period.endDate).reverse() : dateRange(period.startDate, period.endDate);
  const slots = defaultSlots(period);

  for (const exam of orderedExams) {
    const students = getExamStudents(exam);
    const needed = students.length || exam.course.studentCount || 1;
    const rooms = findRooms(classrooms, needed, exam.maxRooms);

    if (rooms.length === 0) {
      warnings.push({ type: 'CAPACITY', examId: exam.id, message: `${exam.course.code} için yeterli salon kapasitesi bulunamadı.` });
      continue;
    }

    let assignmentTime = null;
    if (exam.pinned && exam.date && exam.startTime) {
      assignmentTime = {
        date: exam.date,
        startTime: exam.startTime,
        endTime: exam.endTime || addMinutes(exam.startTime, exam.durationMinutes),
      };
    } else {
      for (const date of dates) {
        for (const slot of slots) {
          const endTime = addMinutes(slot.startTime, exam.durationMinutes);
          if (endTime > slot.endTime) continue;
          if (!studentConflict(placed, exam, date, slot.startTime, endTime)) {
            assignmentTime = { date, startTime: slot.startTime, endTime };
            break;
          }
        }
        if (assignmentTime) break;
      }
    }

    if (!assignmentTime) {
      warnings.push({ type: 'TIME', examId: exam.id, message: `${exam.course.code} için çakışmasız zaman bulunamadı.` });
      continue;
    }

    await prisma.exam.update({
      where: { id: exam.id },
      data: {
        date: assignmentTime.date,
        startTime: assignmentTime.startTime,
        endTime: assignmentTime.endTime,
        status: 'PLANNED',
      },
    });

    const roomCapacity = rooms.reduce(
      (sum, room) => sum + room.seats.filter((seat) => seat.status === 'AKTIF').reduce((seatSum, seat) => seatSum + seat.capacity, 0),
      0,
    );
    capacityWaste += Math.max(0, roomCapacity - needed);

    let studentIndex = 0;
    for (const room of rooms) {
      const activeSeats = room.seats.filter((seat) => seat.status === 'AKTIF').sort((a, b) => a.row - b.row || a.column - b.column);
      let assignedCount = 0;

      await prisma.examRoomAssignment.create({
        data: { scenarioId, examId: exam.id, classroomId: room.id, assignedCount: Math.min(activeSeats.length, students.length - studentIndex) },
      });

      for (const seat of activeSeats) {
        if (studentIndex >= students.length) break;
        await prisma.seatAssignment.create({
          data: {
            scenarioId,
            examId: exam.id,
            studentId: students[studentIndex].id,
            classroomId: room.id,
            seatId: seat.id,
          },
        });
        studentIndex += 1;
        assignedCount += 1;
      }
    }

    const requiredInvigilators = Math.max(1, rooms.length);
    const assignedInvigilators = [];
    for (const invigilator of invigilators) {
      if (assignedInvigilators.length >= requiredInvigilators) break;
      const load = invigilatorLoad.get(invigilator.id) || [];
      const busy = load.some((item) => sameDate(item.date, assignmentTime.date) && overlaps(item.startTime, item.endTime, assignmentTime.startTime, assignmentTime.endTime));
      if (busy || load.length >= invigilator.maxAssignments) continue;

      assignedInvigilators.push(invigilator);
      invigilatorLoad.set(invigilator.id, [...load, assignmentTime]);
      await prisma.invigilatorAssignment.create({
        data: { scenarioId, examId: exam.id, invigilatorId: invigilator.id },
      });
    }

    if (assignedInvigilators.length < requiredInvigilators) {
      warnings.push({ type: 'INVIGILATOR', examId: exam.id, message: `${exam.course.code} için yeterli gözetmen atanamadı.` });
    }

    placed.push({
      examId: exam.id,
      date: assignmentTime.date,
      startTime: assignmentTime.startTime,
      endTime: assignmentTime.endTime,
      studentIds: students.map((student) => student.id),
    });
  }

  const scheduledDays = new Set(placed.map((item) => new Date(item.date).toISOString().slice(0, 10))).size;
  const metrics = {
    plannedExamCount: placed.length,
    totalExamCount: exams.length,
    scheduledDays,
    capacityWaste,
    warningCount: warnings.length,
  };
  const score = Math.max(0, 100 - scheduledDays * 4 - capacityWaste * 0.1 - warnings.length * 10);

  return prisma.planningScenario.update({
    where: { id: scenarioId },
    data: { status: warnings.length ? 'COMPLETED' : 'COMPLETED', metrics, warnings, score },
    include: {
      period: true,
      rooms: { include: { exam: { include: { course: true } }, classroom: true } },
      seats: { include: { student: true, seat: true, exam: { include: { course: true } } } },
      invigilators: { include: { invigilator: true, exam: { include: { course: true } } } },
    },
  });
}

async function recheckScenario(scenarioId) {
  const scenario = await prisma.planningScenario.findUnique({
    where: { id: scenarioId },
    include: {
      seats: { include: { student: true, exam: { include: { course: true } }, seat: true } },
      rooms: { include: { classroom: true, exam: true } },
      invigilators: { include: { invigilator: true, exam: true } },
    },
  });
  if (!scenario) {
    const error = new Error('Planlama senaryosu bulunamadı.');
    error.status = 404;
    throw error;
  }

  const warnings = [];
  const roomSlots = new Map();
  for (const room of scenario.rooms) {
    const key = `${room.classroomId}:${new Date(room.exam.date).toISOString().slice(0, 10)}:${room.exam.startTime}:${room.exam.endTime}`;
    if (roomSlots.has(key)) warnings.push({ type: 'ROOM_CONFLICT', message: `${room.classroom.name} aynı zaman diliminde birden fazla sınava atanmış.` });
    roomSlots.set(key, true);
  }

  const studentSlots = new Map();
  for (const seat of scenario.seats) {
    const key = `${seat.studentId}:${new Date(seat.exam.date).toISOString().slice(0, 10)}:${seat.exam.startTime}:${seat.exam.endTime}`;
    if (studentSlots.has(key)) warnings.push({ type: 'STUDENT_CONFLICT', message: `${seat.student.fullName} için sınav çakışması var.` });
    studentSlots.set(key, true);
  }

  return prisma.planningScenario.update({
    where: { id: scenarioId },
    data: { warnings, metrics: { ...(scenario.metrics || {}), warningCount: warnings.length } },
  });
}

module.exports = { recheckScenario, runScenario };
