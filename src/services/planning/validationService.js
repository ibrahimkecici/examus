const { overlaps, sameDate } = require('../../utils/time');
const { requiresFrontRow } = require('./specialNeeds');

function warning(type, message, severity = 'soft', extra = {}) {
  return { type, message, severity, ...extra };
}

function validateSeatClassroomConsistency(seatAssignments) {
  return seatAssignments
    .filter((assignment) => assignment.seat.classroomId && assignment.classroomId && assignment.seat.classroomId !== assignment.classroomId)
    .map((assignment) => warning('SEAT_CLASSROOM_MISMATCH', `${assignment.student.fullName} için seatId ile classroomId tutarsız.`, 'hard', { examId: assignment.examId }));
}

function validateFrontRow(seatAssignments) {
  return seatAssignments
    .filter((assignment) => requiresFrontRow(assignment.student) && assignment.seat.row !== 1)
    .map((assignment) => warning('SPECIAL_NEEDS_FRONT_ROW', `${assignment.student.fullName} ön sıra ihtiyacı olduğu halde ${assignment.seat.label} koltuğuna atandı.`, 'soft', { examId: assignment.examId }));
}

function validatePlacementConflicts(placements) {
  const warnings = [];
  for (let left = 0; left < placements.length; left += 1) {
    for (let right = left + 1; right < placements.length; right += 1) {
      const a = placements[left];
      const b = placements[right];
      const sameSlot = sameDate(a.date, b.date) && overlaps(a.startTime, a.endTime, b.startTime, b.endTime);
      if (!sameSlot) continue;
      if (a.roomIds.some((roomId) => b.roomIds.includes(roomId))) warnings.push(warning('ROOM_CONFLICT', 'Aynı derslik aynı zaman aralığında birden fazla slotta kullanılmış.', 'hard'));
      if (a.studentIds.some((studentId) => b.studentIds.includes(studentId))) warnings.push(warning('STUDENT_CONFLICT', 'Ortak öğrencisi olan sınavlar aynı zaman aralığına konmuş.', 'hard'));
      if (a.invigilatorIds.some((id) => b.invigilatorIds.includes(id))) warnings.push(warning('INVIGILATOR_CONFLICT', 'Aynı gözetmen aynı zaman aralığında iki görevde görünüyor.', 'hard'));
    }
  }
  return warnings;
}

module.exports = { validateFrontRow, validatePlacementConflicts, validateSeatClassroomConsistency, warning };
