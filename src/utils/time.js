function toMinutes(time) {
  if (!time) return null;
  const [hour, minute] = String(time).split(':').map(Number);
  return hour * 60 + minute;
}

function addMinutes(time, minutes) {
  const total = toMinutes(time) + minutes;
  const hour = Math.floor(total / 60);
  const minute = total % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function overlaps(aStart, aEnd, bStart, bEnd) {
  return toMinutes(aStart) < toMinutes(bEnd) && toMinutes(bStart) < toMinutes(aEnd);
}

function sameDate(a, b) {
  return new Date(a).toISOString().slice(0, 10) === new Date(b).toISOString().slice(0, 10);
}

function dateRange(start, end) {
  const dates = [];
  const current = new Date(start);
  const last = new Date(end);

  while (current <= last) {
    dates.push(new Date(current));
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return dates;
}

module.exports = { addMinutes, dateRange, overlaps, sameDate, toMinutes };
