const { groupSpecialNeedSummary } = require('./specialNeeds');

function placementExplanation(placement) {
  const roomLabels = placement.rooms.map((r) => r.code).join(' + ');
  const codes = placement.group.examGroups.map((group) => group.course.code);
  const prefix = placement.group.mixed ? `${codes.join(', ')} karma salon` : codes[0];
  const examCapacity = placement.roomCandidate?.effectiveExamCapacity || placement.roomCandidate?.totalCapacity || placement.group.students.length;
  const physicalCapacity = placement.roomCandidate?.physicalCapacity || placement.rooms.reduce((sum, room) => sum + Number(room.capacity || 0), 0) || examCapacity;
  const examUtilization = examCapacity > 0 ? Math.round((placement.group.students.length / examCapacity) * 100) : 0;
  const physicalUtilization = physicalCapacity > 0 ? Math.round((placement.group.students.length / physicalCapacity) * 100) : 0;
  const examCapLabel = placement.roomCandidate?.usedSafeCapacity ? `${examCapacity} emniyetli` : examCapacity;
  return `${prefix}, ${roomLabels} dersliğine yerleştirildi; sınav kapasitesi ${placement.group.students.length}/${examCapLabel} (%${examUtilization}), fiziksel salon doluluğu ${placement.group.students.length}/${physicalCapacity} (%${physicalUtilization}) ve uygun gözetmen yükü sağlandı.`;
}

function specialNeedExplanations(placement) {
  const summary = groupSpecialNeedSummary(placement.group.students);
  return summary ? [`${placement.group.examGroups.map((group) => group.course.code).join(', ')} özel ihtiyaç özeti: ${summary}.`] : [];
}

function buildExplanations(placements) {
  return placements.flatMap((placement) => [placementExplanation(placement), ...specialNeedExplanations(placement)]);
}

module.exports = { buildExplanations, placementExplanation, specialNeedExplanations };
