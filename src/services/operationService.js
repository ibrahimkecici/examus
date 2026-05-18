const prisma = require('../config/prisma');
const { filterScenarioForUser, scenarioWhereForUser } = require('../utils/scenarioAccess');
const { groupSpecialNeedSummary, specialNeedNote } = require('./planning/specialNeeds');

function examTime(exam) {
  return {
    date: exam.date,
    startTime: exam.startTime,
    endTime: exam.endTime,
  };
}

function sortByDateTime(a, b) {
  const dateA = a.date ? new Date(a.date).getTime() : Number.MAX_SAFE_INTEGER;
  const dateB = b.date ? new Date(b.date).getTime() : Number.MAX_SAFE_INTEGER;
  if (dateA !== dateB) return dateA - dateB;
  return String(a.startTime || '').localeCompare(String(b.startTime || ''));
}

function invigilatorName(invigilator) {
  return `${invigilator?.title || ''} ${invigilator?.firstName || ''} ${invigilator?.lastName || ''}`.replace(/\s+/g, ' ').trim();
}

function serializeSeatAssignment(assignment) {
  return {
    id: assignment.id,
    classroomId: assignment.classroomId,
    classroom: assignment.classroom?.name || '-',
    classroomCode: assignment.classroom?.code || '-',
    rowCount: assignment.classroom?.rowCount || 0,
    columnCount: assignment.classroom?.columnCount || 0,
    seatId: assignment.seatId,
    seat: assignment.seat?.label || '-',
    row: assignment.seat?.row || 0,
    column: assignment.seat?.column || 0,
    studentId: assignment.studentId,
    studentNo: assignment.student?.studentNo || '-',
    studentName: assignment.student?.fullName || '-',
    specialNeeds: specialNeedNote(assignment.student) || null,
    bookletType: assignment.bookletType || '-',
    locked: Boolean(assignment.locked),
    examId: assignment.examId,
    courseCode: assignment.exam?.course?.code || '-',
    courseName: assignment.exam?.course?.name || '-',
  };
}

function sortSeatAssignments(seats) {
  return [...seats].sort((a, b) => {
    const classroomCompare = String(a.classroom?.code || a.classroom?.name || '').localeCompare(String(b.classroom?.code || b.classroom?.name || ''), 'tr');
    if (classroomCompare !== 0) return classroomCompare;
    const rowDiff = (a.seat?.row || 0) - (b.seat?.row || 0);
    if (rowDiff !== 0) return rowDiff;
    const columnDiff = (a.seat?.column || 0) - (b.seat?.column || 0);
    if (columnDiff !== 0) return columnDiff;
    return String(a.student?.studentNo || '').localeCompare(String(b.student?.studentNo || ''), 'tr');
  });
}

function buildRoomSummaries(scenario, examId) {
  const rooms = (scenario.rooms || []).filter((room) => room.examId === examId);
  const seats = (scenario.seats || []).filter((seat) => seat.examId === examId);
  return rooms.map((room) => {
    const roomSeats = seats.filter((seat) => seat.classroomId === room.classroomId);
    return {
      assignmentId: room.id,
      classroomId: room.classroomId,
      classroomCode: room.classroom?.code || '-',
      classroom: room.classroom?.name || '-',
      capacity: room.classroom?.capacity || 0,
      examCapacity: room.classroom?.examCapacity || room.classroom?.capacity || 0,
      rowCount: room.classroom?.rowCount || 0,
      columnCount: room.classroom?.columnCount || 0,
      assignedCount: roomSeats.length || room.assignedCount || 0,
      physicalUtilization: room.classroom?.capacity ? (roomSeats.length || room.assignedCount || 0) / room.classroom.capacity : 0,
      examUtilization: (room.classroom?.examCapacity || room.classroom?.capacity) ? (roomSeats.length || room.assignedCount || 0) / (room.classroom.examCapacity || room.classroom.capacity) : 0,
      seats: sortSeatAssignments(roomSeats).map(serializeSeatAssignment),
      specialNeedsSummary: groupSpecialNeedSummary(roomSeats.map((seat) => seat.student)) || '-',
    };
  });
}

function serializeInvigilatorAssignment(assignment) {
  return {
    id: assignment.id,
    invigilatorId: assignment.invigilatorId,
    name: invigilatorName(assignment.invigilator),
    staffNo: assignment.invigilator?.staffNo || '-',
    role: assignment.role,
  };
}

function buildExamOperationFromScenario(scenario, examId, user) {
  const schedule = (scenario.schedules || []).find((item) => item.examId === examId);
  const roomExam = (scenario.rooms || []).find((item) => item.examId === examId)?.exam;
  const seatExam = (scenario.seats || []).find((item) => item.examId === examId)?.exam;
  const invigilatorExam = (scenario.invigilators || []).find((item) => item.examId === examId)?.exam;
  const exam = schedule?.exam || roomExam || seatExam || invigilatorExam;
  if (!exam) return null;
  const seats = sortSeatAssignments((scenario.seats || []).filter((seat) => seat.examId === examId));
  const invigilators = (scenario.invigilators || []).filter((assignment) => assignment.examId === examId);
  const rooms = buildRoomSummaries(scenario, examId);

  return {
    scenario: {
      id: scenario.id,
      name: scenario.name,
      status: scenario.status,
      strategy: scenario.strategy,
      score: scenario.score,
      period: scenario.period ? { id: scenario.period.id, name: scenario.period.name } : null,
    },
    role: user.role,
    exam: {
      id: exam.id,
      courseCode: exam.course?.code || '-',
      courseName: exam.course?.name || '-',
      instructorName: exam.course?.instructorName || exam.course?.instructor?.name || '-',
      expectedCount: exam.course?.studentCount || 0,
      durationMinutes: exam.durationMinutes,
      ...examTime(schedule || exam),
    },
    rooms,
    seats: seats.map(serializeSeatAssignment),
    invigilators: invigilators.map(serializeInvigilatorAssignment),
    summary: {
      assignedCount: seats.length,
      roomCount: rooms.length,
      invigilatorCount: invigilators.length,
      specialNeedsSummary: groupSpecialNeedSummary(seats.map((seat) => seat.student)) || '-',
    },
  };
}

async function getScenarioForOperation(scenarioId, user) {
  const scenario = await prisma.planningScenario.findUnique({
    where: { id: scenarioId },
    include: {
      period: true,
      schedules: { include: { exam: { include: { course: { include: { instructor: true } } } } } },
      rooms: { include: { classroom: true, exam: { include: { course: { include: { instructor: true } } } } } },
      seats: { include: { student: true, seat: true, classroom: true, exam: { include: { course: { include: { instructor: true } } } } } },
      invigilators: { include: { invigilator: true, exam: { include: { course: { include: { instructor: true } } } } } },
      roomSlots: { include: { classroom: true, assignments: { include: { exam: { include: { course: { include: { instructor: true } } } } } } } },
    },
  });
  if (!scenario) return null;
  return filterScenarioForUser(scenario, user);
}

async function findLatestScenarioForExam(examId, user) {
  const scenario = await prisma.planningScenario.findFirst({
    where: {
      AND: [
        scenarioWhereForUser(user),
        {
          OR: [
            { schedules: { some: { examId } } },
            { rooms: { some: { examId } } },
            { seats: { some: { examId } } },
            { invigilators: { some: { examId } } },
          ],
        },
      ],
    },
    orderBy: { updatedAt: 'desc' },
    select: { id: true },
  });
  if (!scenario) return null;
  return getScenarioForOperation(scenario.id, user);
}

async function getExamOperation(examId, user, scenarioId = null) {
  const scenario = scenarioId ? await getScenarioForOperation(scenarioId, user) : await findLatestScenarioForExam(examId, user);
  if (!scenario) {
    const error = new Error('Bu sınav için görüntülenebilir operasyon verisi bulunamadı.');
    error.status = 404;
    throw error;
  }
  const operation = buildExamOperationFromScenario(scenario, examId, user);
  if (!operation) {
    const error = new Error('Bu sınav için görüntülenebilir operasyon verisi bulunamadı.');
    error.status = 404;
    throw error;
  }
  return operation;
}

async function buildOperationalItems(user) {
  if (user.role === 'STUDENT') {
    const seats = await prisma.seatAssignment.findMany({
      where: { student: { userId: user.id } },
      include: {
        scenario: true,
        exam: { include: { course: true } },
        classroom: true,
        seat: true,
        student: true,
      },
    });
    return seats
      .sort((a, b) => new Date(b.scenario.updatedAt).getTime() - new Date(a.scenario.updatedAt).getTime())
      .map((assignment) => ({
        kind: 'student_exam',
        scenarioId: assignment.scenarioId,
        scenarioName: assignment.scenario.name,
        examId: assignment.examId,
        courseCode: assignment.exam.course.code,
        courseName: assignment.exam.course.name,
        ...examTime(assignment.exam),
        classroom: assignment.classroom.name,
        classroomCode: assignment.classroom.code,
        seat: assignment.seat.label,
        bookletType: assignment.bookletType,
        specialNeeds: specialNeedNote(assignment.student) || null,
      }))
      .sort(sortByDateTime)
      .slice(0, 8);
  }

  if (user.role === 'INVIGILATOR') {
    const assignments = await prisma.invigilatorAssignment.findMany({
      where: { invigilator: { userId: user.id } },
      include: {
        scenario: true,
        exam: { include: { course: true } },
        invigilator: true,
      },
    });
    if (assignments.length === 0) return [];
    const pairs = assignments.map((assignment) => ({ scenarioId: assignment.scenarioId, examId: assignment.examId }));
    const rooms = await prisma.examRoomAssignment.findMany({
      where: { OR: pairs },
      include: { classroom: true },
    });
    const seats = await prisma.seatAssignment.findMany({
      where: { OR: pairs },
      include: { student: true, seat: true, classroom: true, exam: { include: { course: true } } },
    });
    const roomsByExam = new Map();
    for (const room of rooms) {
      const key = `${room.scenarioId}:${room.examId}`;
      roomsByExam.set(key, [...(roomsByExam.get(key) || []), room]);
    }
    const seatsByExam = new Map();
    for (const seat of seats) {
      const key = `${seat.scenarioId}:${seat.examId}`;
      seatsByExam.set(key, [...(seatsByExam.get(key) || []), seat]);
    }
    return assignments
      .map((assignment) => {
        const key = `${assignment.scenarioId}:${assignment.examId}`;
        const examRooms = roomsByExam.get(key) || [];
        const sortedSeats = sortSeatAssignments(seatsByExam.get(key) || []);
        return {
          kind: 'invigilator_task',
          scenarioId: assignment.scenarioId,
          scenarioName: assignment.scenario.name,
          examId: assignment.examId,
          courseCode: assignment.exam.course.code,
          courseName: assignment.exam.course.name,
          ...examTime(assignment.exam),
          classroom: examRooms.map((room) => room.classroom?.name).filter(Boolean).join(', ') || '-',
          classroomCode: examRooms.map((room) => room.classroom?.code).filter(Boolean).join(', ') || null,
          assignedCount: sortedSeats.length || examRooms.reduce((sum, room) => sum + (room.assignedCount || 0), 0),
          role: assignment.role,
          specialNeedsSummary: groupSpecialNeedSummary(sortedSeats.map((seat) => seat.student)) || '-',
          seatingPreview: sortedSeats.slice(0, 8).map(serializeSeatAssignment),
          seatingAssignments: sortedSeats.map(serializeSeatAssignment),
        };
      })
      .sort(sortByDateTime)
      .slice(0, 8);
  }

  if (user.role === 'INSTRUCTOR') {
    const exams = await prisma.exam.findMany({
      where: { course: { instructorId: user.id } },
      include: {
        course: true,
        roomAssignments: { include: { classroom: true } },
        seatAssignments: { include: { student: true } },
        invigilators: { include: { invigilator: true } },
      },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
      take: 8,
    });
    return exams.map((exam) => ({
      kind: 'instructor_exam',
      examId: exam.id,
      courseCode: exam.course.code,
      courseName: exam.course.name,
      ...examTime(exam),
      classrooms: exam.roomAssignments.map((assignment) => assignment.classroom.name),
      assignedCount: exam.seatAssignments.length,
      expectedCount: exam.course.studentCount,
      specialNeedsSummary: groupSpecialNeedSummary(exam.seatAssignments.map((assignment) => assignment.student)) || '-',
      invigilators: exam.invigilators.map((assignment) => invigilatorName(assignment.invigilator)),
    }));
  }

  if (user.role === 'DEPARTMENT_MANAGER' && user.departmentId) {
    const exams = await prisma.exam.findMany({
      where: { course: { departmentId: user.departmentId } },
      include: {
        course: true,
        roomAssignments: { include: { classroom: true } },
        seatAssignments: { include: { student: true } },
        invigilators: { include: { invigilator: true } },
      },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
      take: 10,
    });
    return exams.map((exam) => ({
      kind: 'department_exam',
      examId: exam.id,
      courseCode: exam.course.code,
      courseName: exam.course.name,
      ...examTime(exam),
      classrooms: exam.roomAssignments.map((assignment) => assignment.classroom.name),
      assignedCount: exam.seatAssignments.length,
      expectedCount: exam.course.studentCount,
      specialNeedsSummary: groupSpecialNeedSummary(exam.seatAssignments.map((assignment) => assignment.student)) || '-',
      invigilators: exam.invigilators.map((assignment) => invigilatorName(assignment.invigilator)),
    }));
  }

  return [];
}

module.exports = {
  buildExamOperationFromScenario,
  buildOperationalItems,
  getExamOperation,
  serializeSeatAssignment,
};
