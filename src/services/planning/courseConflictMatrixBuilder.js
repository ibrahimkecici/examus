function getExamStudents(exam) {
  return exam.course.enrollments.map((enrollment) => enrollment.student);
}

function pairKey(a, b) {
  return [a, b].sort().join('|');
}

function buildCourseConflictMatrix(exams) {
  const matrix = {};
  for (let left = 0; left < exams.length; left += 1) {
    for (let right = left + 1; right < exams.length; right += 1) {
      const a = exams[left];
      const b = exams[right];
      const aStudents = new Set(getExamStudents(a).map((student) => student.id));
      const bStudents = new Set(getExamStudents(b).map((student) => student.id));
      const sharedStudentIds = [...aStudents].filter((id) => bStudents.has(id));
      const smaller = Math.max(1, Math.min(aStudents.size || a.course.studentCount || 1, bStudents.size || b.course.studentCount || 1));
      matrix[pairKey(a.id, b.id)] = {
        leftExamId: a.id,
        rightExamId: b.id,
        leftCourseCode: a.course.code,
        rightCourseCode: b.course.code,
        sharedStudentCount: sharedStudentIds.length,
        sharedStudentRatio: Number((sharedStudentIds.length / smaller).toFixed(3)),
        sharedStudentIds,
      };
    }
  }
  return matrix;
}

function getCourseConflict(matrix, examIdA, examIdB) {
  return matrix[pairKey(examIdA, examIdB)] || { sharedStudentCount: 0, sharedStudentRatio: 0, sharedStudentIds: [] };
}

function haveSharedStudents(matrix, examIdA, examIdB) {
  return getCourseConflict(matrix, examIdA, examIdB).sharedStudentCount > 0;
}

module.exports = { buildCourseConflictMatrix, getCourseConflict, getExamStudents, haveSharedStudents, pairKey };
