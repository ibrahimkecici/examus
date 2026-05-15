const { activeSeatCapacity, parseJson } = require('./roomAllocator');
const { getExamStudents, haveSharedStudents } = require('./courseConflictMatrixBuilder');
const { requiresSeparateRoom } = require('./specialNeeds');

function examRules(exam) {
  return { ...parseJson(exam.course.specialRules), ...parseJson(exam.specialRules) };
}

function examAllowsMixed(exam, students) {
  const rules = examRules(exam);
  if (rules.allowMixedRoom === false) return false;
  if (rules.requiresDedicatedRoom === true) return false;
  if (students.some(requiresSeparateRoom)) return false;
  return true;
}

function makeSingleGroup(exam) {
  const students = getExamStudents(exam);
  return {
    id: exam.id,
    mixed: false,
    exams: [exam],
    examGroups: [{ exam, course: exam.course, students }],
    students,
    studentIds: students.map((student) => student.id),
    durationMinutes: exam.durationMinutes,
  };
}

function canMergeGroups(a, b, matrix, config) {
  if (!config.allowMixedRooms) return false;
  if (Math.abs(a.durationMinutes - b.durationMinutes) > config.mixedRoomDurationToleranceMinutes) return false;
  for (const left of a.exams) {
    for (const right of b.exams) {
      if (haveSharedStudents(matrix, left.id, right.id)) return false;
    }
  }
  if (![...a.examGroups, ...b.examGroups].every((group) => examAllowsMixed(group.exam, group.students))) return false;
  return true;
}

function mergeGroups(a, b) {
  const examGroups = [...a.examGroups, ...b.examGroups];
  const students = examGroups.flatMap((group) => group.students);
  return {
    id: examGroups.map((group) => group.exam.id).sort().join('+'),
    mixed: true,
    exams: examGroups.map((group) => group.exam),
    examGroups,
    students,
    studentIds: students.map((student) => student.id),
    durationMinutes: Math.max(a.durationMinutes, b.durationMinutes),
  };
}

function buildPlanningGroups(exams, matrix, classrooms, config, strategy) {
  const maxRoomCapacity = Math.max(...classrooms.map(activeSeatCapacity), 0);
  const singles = exams.map(makeSingleGroup);
  if (!config.allowMixedRooms) return singles;

  const ordered = [...singles].sort((a, b) => a.students.length - b.students.length || a.exams[0].course.code.localeCompare(b.exams[0].course.code, 'tr'));
  const used = new Set();
  const groups = [];

  for (let index = 0; index < ordered.length; index += 1) {
    if (used.has(ordered[index].id)) continue;
    let current = ordered[index];
    for (let otherIndex = index + 1; otherIndex < ordered.length; otherIndex += 1) {
      const other = ordered[otherIndex];
      if (used.has(other.id)) continue;
      const totalStudents = current.students.length + other.students.length;
      if (totalStudents > maxRoomCapacity) continue;
      if (!canMergeGroups(current, other, matrix, config)) continue;
      current = mergeGroups(current, other);
      used.add(other.id);
      if (strategy !== 'minimum_rooms') break;
    }
    used.add(ordered[index].id);
    groups.push(current);
  }

  return groups.sort((a, b) => b.students.length - a.students.length || Number(b.mixed) - Number(a.mixed));
}

function estimateSavings(groups) {
  const mixedGroups = groups.filter((group) => group.mixed);
  const roomsSavedByMixing = mixedGroups.reduce((sum, group) => sum + Math.max(0, group.exams.length - 1), 0);
  return { mixedRoomCount: mixedGroups.length, roomsSavedByMixing, invigilatorsSavedByMixing: roomsSavedByMixing };
}

module.exports = { buildPlanningGroups, canMergeGroups, estimateSavings, examAllowsMixed, makeSingleGroup };
