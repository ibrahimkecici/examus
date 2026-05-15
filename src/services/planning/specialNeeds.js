const SPECIAL_NEED_LABELS = {
  EXTRA_TIME: 'Ek süre',
  FRONT_ROW: 'Ön sıra',
  ACCESSIBLE_ROOM: 'Erişilebilir derslik',
  SEPARATE_ROOM: 'Ayrı salon',
  LOW_DISTRACTION: 'Düşük dikkat dağıtıcı ortam',
  ELEVATOR_REQUIRED: 'Asansör gerekli',
};

const SPECIAL_NEED_PATTERNS = [
  ['EXTRA_TIME', ['ek süre', 'ek sure', 'extra time', 'fazla süre']],
  ['FRONT_ROW', ['ön sıra', 'on sira', 'front row', 'ilk sıra']],
  ['ACCESSIBLE_ROOM', ['erişilebilir', 'erisilebilir', 'accessible', 'engelli', 'tekerlekli']],
  ['SEPARATE_ROOM', ['ayrı salon', 'ayri salon', 'separate room', 'tek salon']],
  ['LOW_DISTRACTION', ['düşük dikkat', 'dusuk dikkat', 'sessiz', 'low distraction']],
  ['ELEVATOR_REQUIRED', ['asansör', 'asansor', 'elevator']],
];

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeSpecialNeeds(value) {
  const raw = normalizeText(value);
  if (!raw || raw === '-' || raw === '49') return { types: [], labels: [], unknown: [], display: '-' };
  const lower = raw.toLocaleLowerCase('tr-TR');
  const types = [];

  for (const [type, needles] of SPECIAL_NEED_PATTERNS) {
    if (needles.some((needle) => lower.includes(needle))) types.push(type);
  }

  const unknown = types.length ? [] : [raw];
  const labels = types.map((type) => SPECIAL_NEED_LABELS[type]);
  return {
    types,
    labels,
    unknown,
    display: [...labels, ...unknown].join(', ') || '-',
  };
}

function studentSpecialNeeds(student) {
  return normalizeSpecialNeeds(student?.specialNeeds);
}

function hasSpecialNeed(student, type) {
  return studentSpecialNeeds(student).types.includes(type);
}

function requiresFrontRow(student) {
  return hasSpecialNeed(student, 'FRONT_ROW');
}

function requiresExtraTime(student) {
  return hasSpecialNeed(student, 'EXTRA_TIME');
}

function requiresAccessibleRoom(student) {
  return hasSpecialNeed(student, 'ACCESSIBLE_ROOM') || hasSpecialNeed(student, 'ELEVATOR_REQUIRED');
}

function requiresSeparateRoom(student) {
  return hasSpecialNeed(student, 'SEPARATE_ROOM');
}

function requiresLowDistraction(student) {
  return hasSpecialNeed(student, 'LOW_DISTRACTION');
}

function specialNeedNote(student) {
  return studentSpecialNeeds(student).display;
}

function groupSpecialNeedSummary(students) {
  const byType = new Map();
  for (const student of students) {
    const normalized = studentSpecialNeeds(student);
    for (const type of normalized.types) {
      const label = SPECIAL_NEED_LABELS[type];
      byType.set(label, [...(byType.get(label) || []), student.fullName]);
    }
    for (const unknown of normalized.unknown) {
      byType.set(unknown, [...(byType.get(unknown) || []), student.fullName]);
    }
  }
  return [...byType.entries()].map(([label, names]) => `${label}: ${names.join(', ')}`).join(' | ');
}

function sortStudentsForSeating(students) {
  return [...students].sort((a, b) => {
    if (requiresFrontRow(a) !== requiresFrontRow(b)) return requiresFrontRow(a) ? -1 : 1;
    if (requiresSeparateRoom(a) !== requiresSeparateRoom(b)) return requiresSeparateRoom(a) ? -1 : 1;
    return String(a.studentNo || '').localeCompare(String(b.studentNo || ''), 'tr');
  });
}

module.exports = {
  SPECIAL_NEED_LABELS,
  groupSpecialNeedSummary,
  hasSpecialNeed,
  normalizeSpecialNeeds,
  requiresAccessibleRoom,
  requiresExtraTime,
  requiresFrontRow,
  requiresLowDistraction,
  requiresSeparateRoom,
  sortStudentsForSeating,
  specialNeedNote,
  studentSpecialNeeds,
};
