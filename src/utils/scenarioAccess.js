function scenarioWhereForUser(user) {
  if (user.role === 'ADMIN') return {};
  if (user.role !== 'DEPARTMENT_MANAGER' || !user.departmentId) return { id: '__forbidden__' };
  const departmentId = user.departmentId;
  return {
    OR: [
      { schedules: { some: { exam: { course: { departmentId } } } } },
      { rooms: { some: { exam: { course: { departmentId } } } } },
      { seats: { some: { student: { departmentId } } } },
      { invigilators: { some: { invigilator: { departmentId } } } },
    ],
  };
}

function isDepartmentExam(exam, departmentId) {
  return exam?.course?.departmentId === departmentId;
}

function filterScenarioForUser(scenario, user) {
  if (!scenario || user.role === 'ADMIN') return scenario;
  if (user.role !== 'DEPARTMENT_MANAGER' || !user.departmentId) return null;
  const departmentId = user.departmentId;
  const allowedExamIds = new Set();

  for (const schedule of scenario.schedules || []) {
    if (isDepartmentExam(schedule.exam, departmentId)) allowedExamIds.add(schedule.examId);
  }
  for (const room of scenario.rooms || []) {
    if (isDepartmentExam(room.exam, departmentId)) allowedExamIds.add(room.examId);
  }
  for (const seat of scenario.seats || []) {
    if (seat.student?.departmentId === departmentId || isDepartmentExam(seat.exam, departmentId)) allowedExamIds.add(seat.examId);
  }
  for (const assignment of scenario.invigilators || []) {
    if (assignment.invigilator?.departmentId === departmentId || isDepartmentExam(assignment.exam, departmentId)) allowedExamIds.add(assignment.examId);
  }
  for (const slot of scenario.roomSlots || []) {
    for (const assignment of slot.assignments || []) {
      if (isDepartmentExam(assignment.exam, departmentId)) allowedExamIds.add(assignment.examId);
    }
  }

  if (allowedExamIds.size === 0) return null;

  return {
    ...scenario,
    schedules: (scenario.schedules || []).filter((schedule) => allowedExamIds.has(schedule.examId)),
    rooms: (scenario.rooms || []).filter((room) => allowedExamIds.has(room.examId)),
    seats: (scenario.seats || []).filter((seat) => allowedExamIds.has(seat.examId) || seat.student?.departmentId === departmentId),
    invigilators: (scenario.invigilators || []).filter((assignment) => allowedExamIds.has(assignment.examId) || assignment.invigilator?.departmentId === departmentId),
    roomSlots: (scenario.roomSlots || [])
      .map((slot) => ({
        ...slot,
        assignments: (slot.assignments || []).filter((assignment) => allowedExamIds.has(assignment.examId)),
      }))
      .filter((slot) => slot.assignments.length > 0),
    warnings: (scenario.warnings || []).filter((warning) => !warning.examId || allowedExamIds.has(warning.examId)),
    insights: [],
  };
}

module.exports = { filterScenarioForUser, scenarioWhereForUser };
