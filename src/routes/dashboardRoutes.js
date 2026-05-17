const express = require('express');
const prisma = require('../config/prisma');
const asyncHandler = require('../utils/asyncHandler');
const { scenarioWhereForUser } = require('../utils/scenarioAccess');

const router = express.Router();

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

async function buildOperationalItems(user) {
  if (user.role === 'STUDENT') {
    const seats = await prisma.seatAssignment.findMany({
      where: { student: { userId: user.id } },
      include: {
        scenario: true,
        exam: { include: { course: true } },
        classroom: true,
        seat: true,
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
    const rooms = await prisma.examRoomAssignment.findMany({
      where: { OR: assignments.map((assignment) => ({ scenarioId: assignment.scenarioId, examId: assignment.examId })) },
      include: { classroom: true },
    });
    const seats = await prisma.seatAssignment.findMany({
      where: { OR: assignments.map((assignment) => ({ scenarioId: assignment.scenarioId, examId: assignment.examId })) },
      include: {
        student: true,
        seat: true,
        classroom: true,
      },
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
        const examSeats = seatsByExam.get(key) || [];
        const sortedSeats = [...examSeats].sort((a, b) => {
          const classroomCompare = String(a.classroom?.code || a.classroom?.name || '').localeCompare(String(b.classroom?.code || b.classroom?.name || ''), 'tr');
          if (classroomCompare !== 0) return classroomCompare;
          return String(a.seat?.label || '').localeCompare(String(b.seat?.label || ''), 'tr', { numeric: true });
        });
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
          seatingPreview: sortedSeats.slice(0, 8).map((seat) => ({
            classroom: seat.classroom?.code || seat.classroom?.name || '-',
            seat: seat.seat?.label || '-',
            studentNo: seat.student?.studentNo || '-',
            studentName: seat.student?.fullName || '-',
            bookletType: seat.bookletType || '-',
          })),
          seatingAssignments: sortedSeats.map((seat) => ({
            classroomId: seat.classroomId,
            classroom: seat.classroom?.name || '-',
            classroomCode: seat.classroom?.code || '-',
            rowCount: seat.classroom?.rowCount || 0,
            columnCount: seat.classroom?.columnCount || 0,
            seat: seat.seat?.label || '-',
            row: seat.seat?.row || 0,
            column: seat.seat?.column || 0,
            studentNo: seat.student?.studentNo || '-',
            studentName: seat.student?.fullName || '-',
            bookletType: seat.bookletType || '-',
          })),
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
        seatAssignments: true,
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
      invigilators: exam.invigilators.map((assignment) => `${assignment.invigilator.firstName} ${assignment.invigilator.lastName}`),
    }));
  }

  return [];
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const departmentWhere = req.user.role === 'DEPARTMENT_MANAGER' ? { departmentId: req.user.departmentId || '__forbidden__' } : {};
    const studentWhere = req.user.role === 'STUDENT' ? { userId: req.user.id } : departmentWhere;
    const courseWhere = req.user.role === 'INSTRUCTOR' ? { instructorId: req.user.id } : req.user.role === 'STUDENT' ? { enrollments: { some: { student: { userId: req.user.id } } } } : departmentWhere;
    const invigilatorWhere = req.user.role === 'INVIGILATOR' ? { userId: req.user.id } : departmentWhere;
    const examWhere = req.user.role === 'INSTRUCTOR'
      ? { course: { instructorId: req.user.id } }
      : req.user.role === 'STUDENT'
        ? { course: { enrollments: { some: { student: { userId: req.user.id } } } } }
        : req.user.role === 'INVIGILATOR'
          ? { invigilators: { some: { invigilator: { userId: req.user.id } } } }
          : req.user.role === 'DEPARTMENT_MANAGER'
            ? { course: { departmentId: req.user.departmentId || '__forbidden__' } }
            : {};
    const [students, courses, classrooms, invigilators, exams, scenarios, operationalItems] = await Promise.all([
      prisma.student.count({ where: studentWhere }),
      prisma.course.count({ where: courseWhere }),
      prisma.classroom.count(),
      prisma.invigilator.count({ where: invigilatorWhere }),
      prisma.exam.count({ where: examWhere }),
      ['ADMIN', 'DEPARTMENT_MANAGER', 'INSTRUCTOR', 'INVIGILATOR', 'STUDENT'].includes(req.user.role)
        ? prisma.planningScenario.findMany({ where: scenarioWhereForUser(req.user), orderBy: { createdAt: 'desc' }, take: 5, include: { period: true } })
        : [],
      buildOperationalItems(req.user),
    ]);

    const warningCount = scenarios.reduce((sum, scenario) => sum + (Array.isArray(scenario.warnings) ? scenario.warnings.length : 0), 0);

    res.json({
      success: true,
      data: {
        counts: { students, courses, classrooms, invigilators, exams },
        warningCount,
        scenarios,
        operationalItems,
      },
    });
  }),
);

module.exports = router;
