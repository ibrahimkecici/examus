const { groupSpecialNeedSummary } = require('./specialNeeds');

function placementExplanation(placement) {
  const roomLabels = placement.rooms.map((r) => r.code).join(' + ');
  const codes = placement.group.examGroups.map((group) => group.course.code);
  const prefix = placement.group.mixed ? `${codes.join(', ')} karma salon` : codes[0];
  const utilization = placement.roomCandidate.totalCapacity > 0 ? Math.round((placement.group.students.length / placement.roomCandidate.totalCapacity) * 100) : 0;
  const capLabel = placement.roomCandidate.usedSafeCapacity ? `${placement.roomCandidate.totalCapacity} emniyetli` : placement.roomCandidate.totalCapacity;
  return `${prefix}, ${roomLabels} dersliğine yerleştirildi; ${placement.group.students.length}/${capLabel} doluluk (%${utilization}) ve uygun gözetmen yükü sağlandı.`;
}

function specialNeedExplanations(placement) {
  const summary = groupSpecialNeedSummary(placement.group.students);
  return summary ? [`${placement.group.examGroups.map((group) => group.course.code).join(', ')} özel ihtiyaç özeti: ${summary}.`] : [];
}

function buildExplanations(placements) {
  return placements.flatMap((placement) => [placementExplanation(placement), ...specialNeedExplanations(placement)]);
}

module.exports = { buildExplanations, placementExplanation, specialNeedExplanations };
