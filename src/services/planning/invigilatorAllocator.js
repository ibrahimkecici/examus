const { overlaps, sameDate, toMinutes } = require('../../utils/time');
const { availabilityResult, parseConstraints } = require('./availabilityChecker');
const { DEFAULT_PLANNING_CONFIG } = require('./config');

function invigilatorDisplayName(invigilator) {
  return `${invigilator.title || ''} ${invigilator.firstName || ''} ${invigilator.lastName || ''}`.replace(/\s+/g, ' ').trim();
}

function countDayAssignments(load, date) {
  return load.filter((item) => sameDate(item.date, date)).length;
}

function hasInvigilatorOverlap(load, schedule) {
  return load.some((item) => sameDate(item.date, schedule.date) && overlaps(item.startTime, item.endTime, schedule.startTime, schedule.endTime));
}

function buildingTransitionPenalty(load, schedule, classroom) {
  let penalty = 0;
  for (const item of load) {
    if (!sameDate(item.date, schedule.date)) continue;
    const gap = Math.min(Math.abs(toMinutes(schedule.startTime) - toMinutes(item.endTime)), Math.abs(toMinutes(item.startTime) - toMinutes(schedule.endTime)));
    if (gap >= 0 && gap < 30 && item.building && classroom?.building && item.building !== classroom.building) penalty += 40;
    if (gap >= 0 && gap < 30 && item.building && classroom?.building && item.building === classroom.building) penalty -= 8;
  }
  return penalty;
}

function scoreInvigilator(invigilator, examGroups, schedule, loadMap, strategyWeights, config = DEFAULT_PLANNING_CONFIG, classroom = null) {
  const load = loadMap.get(invigilator.id) || [];
  const constraints = parseConstraints(invigilator);
  const maxAssignments = invigilator.maxAssignments ?? Number.POSITIVE_INFINITY;
  if (load.length >= maxAssignments) return { valid: false, reason: 'MAX_ASSIGNMENTS' };
  if (hasInvigilatorOverlap(load, schedule)) return { valid: false, reason: 'INVIGILATOR_CONFLICT' };

  const dailyCount = countDayAssignments(load, schedule.date);
  if (constraints.maxPerDay !== undefined && dailyCount >= Number(constraints.maxPerDay)) return { valid: false, reason: 'MAX_PER_DAY' };

  const availability = availabilityResult(invigilator, schedule.date, schedule.startTime, schedule.endTime, config);
  if (!availability.valid) return { valid: false, reason: availability.reason };

  let score = availability.penalty;
  score += load.length * strategyWeights.invigilatorFairnessPenalty;
  score += dailyCount * strategyWeights.invigilatorFairnessPenalty * 0.7;
  if (constraints.avoidBackToBack) {
    score += load.some((item) => sameDate(item.date, schedule.date) && Math.abs(toMinutes(schedule.startTime) - toMinutes(item.endTime)) < 30) ? 35 : 0;
  }
  if (Array.isArray(constraints.preferredBuildings) && classroom?.building && !constraints.preferredBuildings.includes(classroom.building)) score += 18;
  score += buildingTransitionPenalty(load, schedule, classroom);

  const departments = new Set(examGroups.map((group) => group.course.department).filter(Boolean));
  if (invigilator.department && departments.has(invigilator.department)) score -= 8;
  score -= invigilator.priority || 0;

  return { valid: true, score };
}

function selectInvigilators(invigilators, examGroups, schedule, loadMap, requiredCount, strategyWeights, config = DEFAULT_PLANNING_CONFIG, classroom = null) {
  const scored = invigilators
    .map((invigilator) => ({ invigilator, ...scoreInvigilator(invigilator, examGroups, schedule, loadMap, strategyWeights, config, classroom) }))
    .filter((candidate) => candidate.valid)
    .sort((a, b) => a.score - b.score || invigilatorDisplayName(a.invigilator).localeCompare(invigilatorDisplayName(b.invigilator), 'tr'));

  if (scored.length < requiredCount) {
    return { valid: false, reason: 'NOT_ENOUGH_INVIGILATORS', invigilators: scored.map((item) => item.invigilator), score: Number.POSITIVE_INFINITY };
  }

  const selected = scored.slice(0, requiredCount);
  return {
    valid: true,
    invigilators: selected.map((item) => item.invigilator),
    score: selected.reduce((sum, item) => sum + item.score, 0),
  };
}

module.exports = { countDayAssignments, invigilatorDisplayName, scoreInvigilator, selectInvigilators };
