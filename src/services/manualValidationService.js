const prisma = require('../config/prisma');

function overlaps(aStart, aEnd, bStart, bEnd) {
  return String(aStart) < String(bEnd) && String(bStart) < String(aEnd);
}

function validationResult(hard = [], soft = [], summary = {}) {
  return { ok: hard.length === 0, hard, soft, summary };
}

async function validateExamScheduleChange(examId, patch) {
  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    include: { course: { include: { enrollments: true } } },
  });
  if (!exam) return validationResult([{ code: 'EXAM_NOT_FOUND', message: 'Sınav bulunamadı.' }]);
  const nextDate = patch.date ? new Date(patch.date) : exam.date;
  const nextStart = patch.startTime ?? exam.startTime;
  const nextEnd = patch.endTime ?? exam.endTime;
  if (!nextDate || !nextStart || !nextEnd) return validationResult([], [{ code: 'INCOMPLETE_TIME', message: 'Tarih/saat eksik olduğu için çakışma kontrolü sınırlı yapıldı.' }]);

  const studentIds = exam.course.enrollments.map((item) => item.studentId);
  if (studentIds.length === 0) return validationResult([], [], { affectedStudents: 0 });

  const conflictingEnrollments = await prisma.courseEnrollment.findMany({
    where: {
      studentId: { in: studentIds },
      course: {
        exams: {
          some: {
            id: { not: examId },
            date: nextDate,
          },
        },
      },
    },
    include: {
      student: true,
      course: { include: { exams: { where: { id: { not: examId }, date: nextDate } } } },
    },
  });

  const hard = [];
  for (const enrollment of conflictingEnrollments) {
    for (const otherExam of enrollment.course.exams) {
      if (otherExam.startTime && otherExam.endTime && overlaps(nextStart, nextEnd, otherExam.startTime, otherExam.endTime)) {
        hard.push({
          code: 'STUDENT_EXAM_CONFLICT',
          message: `${enrollment.student.studentNo} öğrencisinin ${enrollment.course.code} sınavıyla saat çakışması var.`,
          studentId: enrollment.studentId,
          examId: otherExam.id,
        });
      }
    }
  }

  return validationResult(hard, [], { affectedStudents: studentIds.length });
}

async function validateSeatAssignmentChange(assignmentId, patch) {
  const existing = await prisma.seatAssignment.findUnique({
    where: { id: assignmentId },
    include: { seat: true, classroom: true, exam: { include: { course: true } }, student: true },
  });
  if (!existing) return validationResult([{ code: 'SEAT_ASSIGNMENT_NOT_FOUND', message: 'Oturma ataması bulunamadı.' }]);
  const hard = [];
  if (existing.locked && patch.seatId && patch.seatId !== existing.seatId) {
    hard.push({ code: 'LOCKED_SEAT_MOVE', message: 'Kilitli koltuk ataması taşınamaz.' });
  }
  if (patch.seatId) {
    const targetSeat = await prisma.seat.findUnique({ where: { id: patch.seatId }, include: { classroom: true } });
    if (!targetSeat) hard.push({ code: 'TARGET_SEAT_NOT_FOUND', message: 'Hedef koltuk bulunamadı.' });
    else {
      if (targetSeat.status !== 'AKTIF') hard.push({ code: 'TARGET_SEAT_INACTIVE', message: 'Hedef koltuk aktif değil.' });
      if (targetSeat.classroomId !== existing.classroomId) hard.push({ code: 'TARGET_SEAT_WRONG_ROOM', message: 'Hedef koltuk mevcut sınav salonunda değil.' });
      const occupied = await prisma.seatAssignment.findFirst({
        where: {
          id: { not: assignmentId },
          scenarioId: existing.scenarioId,
          examId: existing.examId,
          seatId: patch.seatId,
        },
        include: { student: true },
      });
      if (occupied) hard.push({ code: 'TARGET_SEAT_OCCUPIED', message: `Hedef koltuk ${occupied.student.studentNo} tarafından kullanılıyor.` });
    }
  }
  return validationResult(hard, [], {
    examId: existing.examId,
    studentNo: existing.student.studentNo,
    currentSeat: existing.seat.label,
  });
}

async function validateRoomAssignmentChange(assignmentId, patch) {
  const existing = await prisma.examRoomAssignment.findUnique({
    where: { id: assignmentId },
    include: { exam: true, classroom: true, roomSlot: true },
  });
  if (!existing) return validationResult([{ code: 'ROOM_ASSIGNMENT_NOT_FOUND', message: 'Salon ataması bulunamadı.' }]);
  const classroomId = patch.classroomId || existing.classroomId;
  const slot = existing.roomSlot;
  const hard = [];
  if (slot) {
    const conflict = await prisma.examRoomSlot.findFirst({
      where: {
        scenarioId: existing.scenarioId,
        classroomId,
        id: { not: existing.roomSlotId || undefined },
        date: slot.date,
        OR: [
          { startTime: { lt: slot.endTime }, endTime: { gt: slot.startTime } },
        ],
      },
    });
    if (conflict) hard.push({ code: 'ROOM_TIME_CONFLICT', message: 'Seçilen salon aynı zaman aralığında başka sınavda kullanılıyor.' });
  }
  const capacity = await prisma.classroom.findUnique({ where: { id: classroomId } });
  if (!capacity) hard.push({ code: 'CLASSROOM_NOT_FOUND', message: 'Salon bulunamadı.' });
  else if ((capacity.examCapacity || capacity.capacity) < existing.assignedCount) {
    hard.push({ code: 'ROOM_CAPACITY_EXCEEDED', message: 'Seçilen salonun sınav kapasitesi atanmış öğrenci sayısını karşılamıyor.' });
  }
  return validationResult(hard, [], { assignedCount: existing.assignedCount });
}

async function validateInvigilatorAssignmentChange(assignmentId, patch) {
  const existing = await prisma.invigilatorAssignment.findUnique({
    where: { id: assignmentId },
    include: { exam: true, invigilator: true },
  });
  if (!existing) return validationResult([{ code: 'INVIGILATOR_ASSIGNMENT_NOT_FOUND', message: 'Gözetmen ataması bulunamadı.' }]);
  const invigilatorId = patch.invigilatorId || existing.invigilatorId;
  const schedule = await prisma.scenarioExamSchedule.findUnique({
    where: { scenarioId_examId: { scenarioId: existing.scenarioId, examId: existing.examId } },
  });
  const hard = [];
  if (schedule) {
    const otherAssignments = await prisma.invigilatorAssignment.findMany({
      where: {
        id: { not: assignmentId },
        scenarioId: existing.scenarioId,
        invigilatorId,
      },
      include: { exam: true },
    });
    for (const assignment of otherAssignments) {
      const otherSchedule = await prisma.scenarioExamSchedule.findUnique({
        where: { scenarioId_examId: { scenarioId: assignment.scenarioId, examId: assignment.examId } },
      });
      if (otherSchedule && otherSchedule.date.getTime() === schedule.date.getTime() && overlaps(schedule.startTime, schedule.endTime, otherSchedule.startTime, otherSchedule.endTime)) {
        hard.push({ code: 'INVIGILATOR_TIME_CONFLICT', message: 'Seçilen gözetmenin aynı zaman aralığında başka görevi var.' });
      }
    }
  }
  return validationResult(hard, [], { role: patch.role || existing.role });
}

module.exports = {
  validateExamScheduleChange,
  validateInvigilatorAssignmentChange,
  validateRoomAssignmentChange,
  validateSeatAssignmentChange,
};
