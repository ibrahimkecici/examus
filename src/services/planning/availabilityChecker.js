const { overlaps, sameDate, toMinutes } = require('../../utils/time');
const { DEFAULT_PLANNING_CONFIG } = require('./config');

const AVAILABLE_STATUSES = new Set(['MUSAIT', 'AVAILABLE', 'UYGUN']);
const UNAVAILABLE_STATUSES = new Set(['MUSAIT_DEGIL', 'MUSAIT DEGIL', 'MÜSAİT DEĞİL', 'UNAVAILABLE', 'BUSY', 'DOLU']);

function normalizeStatus(status) {
  return String(status || 'MUSAIT').trim().toLocaleUpperCase('tr-TR').replace(/İ/g, 'I');
}

function dayName(date) {
  return new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'UTC' }).format(new Date(date)).toUpperCase();
}

function parseConstraints(invigilator) {
  const constraints = invigilator.constraints || {};
  if (typeof constraints === 'string') {
    try {
      return JSON.parse(constraints);
    } catch {
      return {};
    }
  }
  return constraints;
}

function violatesConstraintDates(invigilator, date) {
  const constraints = parseConstraints(invigilator);
  const dateKey = new Date(date).toISOString().slice(0, 10);
  if ((constraints.unavailableDates || []).includes(dateKey)) return true;
  if (Array.isArray(constraints.preferredDays) && constraints.preferredDays.length > 0 && !constraints.preferredDays.includes(dayName(date))) return false;
  return false;
}

function availabilityResult(invigilator, date, startTime, endTime, config = DEFAULT_PLANNING_CONFIG) {
  if (violatesConstraintDates(invigilator, date)) return { valid: false, reason: 'CONSTRAINT_UNAVAILABLE_DATE', penalty: 0 };

  const records = Array.isArray(invigilator.availability) ? invigilator.availability.filter((item) => sameDate(item.date, date)) : [];
  const unavailableOverlap = records.some((item) => UNAVAILABLE_STATUSES.has(normalizeStatus(item.status)) && overlaps(item.startTime, item.endTime, startTime, endTime));
  if (unavailableOverlap) return { valid: false, reason: 'AVAILABILITY_BLOCKED', penalty: 0 };

  const positiveRecords = records.filter((item) => AVAILABLE_STATUSES.has(normalizeStatus(item.status)));
  if (positiveRecords.length > 0) {
    const contains = positiveRecords.some((item) => toMinutes(item.startTime) <= toMinutes(startTime) && toMinutes(item.endTime) >= toMinutes(endTime));
    return contains ? { valid: true, reason: 'AVAILABLE', penalty: 0 } : { valid: false, reason: 'AVAILABILITY_OUT_OF_RANGE', penalty: 0 };
  }

  if (config.strictAvailability) return { valid: false, reason: 'NO_AVAILABILITY_RECORD', penalty: 0 };
  return { valid: true, reason: 'DEFAULT_AVAILABLE', penalty: 18 };
}

function availabilityAllows(invigilator, date, startTime, endTime, config = DEFAULT_PLANNING_CONFIG) {
  return availabilityResult(invigilator, date, startTime, endTime, config).valid;
}

module.exports = { availabilityAllows, availabilityResult, dayName, parseConstraints };
