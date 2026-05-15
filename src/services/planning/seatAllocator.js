const { requiresFrontRow, sortStudentsForSeating, specialNeedNote } = require('./specialNeeds');

function activeSeatsForRoom(room) {
  return (room.seats || [])
    .filter((seat) => seat.status === 'AKTIF')
    .map((seat) => ({ ...seat, classroomId: room.id }))
    .sort((a, b) => a.row - b.row || a.column - b.column || String(a.label).localeCompare(String(b.label), 'tr'));
}

function seatDistancePenalty(seat, assignment, assigned, mixed) {
  if (!mixed) return 0;
  let penalty = 0;
  for (const existing of assigned) {
    if (existing.courseCode !== assignment.courseCode) continue;
    const sameRow = existing.seat.row === seat.row;
    const sameColumn = existing.seat.column === seat.column;
    if (sameRow && Math.abs(existing.seat.column - seat.column) === 1) penalty += 100;
    if (sameColumn && Math.abs(existing.seat.row - seat.row) === 1) penalty += 45;
  }
  return penalty;
}

function popNextStudent(queues, lastCourseCode) {
  const ordered = [...queues.entries()]
    .filter(([, queue]) => queue.length > 0)
    .sort((a, b) => {
      if (a[0] === lastCourseCode && b[0] !== lastCourseCode) return 1;
      if (b[0] === lastCourseCode && a[0] !== lastCourseCode) return -1;
      return b[1].length - a[1].length || a[0].localeCompare(b[0], 'tr');
    });
  if (!ordered.length) return null;
  const [courseCode, queue] = ordered[0];
  return { courseCode, student: queue.shift() };
}

function chooseSeat(assignment, availableSeats, assigned, mixed) {
  const needsFrontRow = requiresFrontRow(assignment.student);
  const minRow = Math.min(...availableSeats.map((seat) => seat.row));
  const candidates = availableSeats
    .map((seat) => ({
      seat,
      score: seatDistancePenalty(seat, assignment, assigned, mixed) + (needsFrontRow && seat.row !== minRow ? 1000 : 0) + seat.row * 0.01 + seat.column * 0.001,
    }))
    .sort((a, b) => a.score - b.score || a.seat.row - b.seat.row || a.seat.column - b.seat.column);
  return candidates[0]?.seat || null;
}

function countSeatRisks(assignments) {
  let sameCourseAdjacentSeatCount = 0;
  let sameCourseFrontBackSeatCount = 0;
  for (let left = 0; left < assignments.length; left += 1) {
    for (let right = left + 1; right < assignments.length; right += 1) {
      const a = assignments[left];
      const b = assignments[right];
      if (a.courseCode !== b.courseCode) continue;
      if (a.seat.row === b.seat.row && Math.abs(a.seat.column - b.seat.column) === 1) sameCourseAdjacentSeatCount += 1;
      if (a.seat.column === b.seat.column && Math.abs(a.seat.row - b.seat.row) === 1) sameCourseFrontBackSeatCount += 1;
    }
  }
  return { sameCourseAdjacentSeatCount, sameCourseFrontBackSeatCount };
}

function allocateSeatsForRoom(room, examGroups) {
  const availableSeats = activeSeatsForRoom(room);
  const mixed = examGroups.length > 1;
  const queues = new Map(
    examGroups.map((group) => [
      group.course.code,
      sortStudentsForSeating(group.students).map((student) => ({
        student,
        exam: group.exam,
        courseCode: group.course.code,
      })),
    ]),
  );

  const assignments = [];
  let lastCourseCode = null;
  while (assignments.length < availableSeats.length) {
    const next = popNextStudent(queues, lastCourseCode);
    if (!next) break;
    const seat = chooseSeat(next.student, availableSeats.filter((seat) => !assignments.some((item) => item.seat.id === seat.id)), assignments, mixed);
    if (!seat) break;
    assignments.push({ ...next.student, seat, note: specialNeedNote(next.student.student) });
    lastCourseCode = next.courseCode;
  }

  const missingCount = examGroups.reduce((sum, group) => sum + group.students.length, 0) - assignments.length;
  return {
    assignments,
    missingCount,
    ...countSeatRisks(assignments),
  };
}

module.exports = { activeSeatsForRoom, allocateSeatsForRoom, countSeatRisks };
