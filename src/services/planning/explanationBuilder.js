const { groupSpecialNeedSummary } = require('./specialNeeds');

function placementExplanation(placement) {
  const roomLabels = placement.rooms.map((r) => r.code).join(' + ');
  const codes = placement.group.examGroups.map((group) => group.course.code);
  const prefix = placement.group.mixed ? `${codes.join(', ')} karma salon` : codes[0];
  const totalCapacity = placement.roomCandidate?.totalCapacity || placement.group.students.length;
  const utilization = totalCapacity > 0 ? Math.round((placement.group.students.length / totalCapacity) * 100) : 0;
  const capLabel = placement.roomCandidate?.usedSafeCapacity ? `${totalCapacity} emniyetli` : totalCapacity;
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
