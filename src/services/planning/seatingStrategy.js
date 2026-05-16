const SeatingStrategy = Object.freeze({
  SINGLE_COURSE_ALTERNATING_COLUMNS: 'SINGLE_COURSE_ALTERNATING_COLUMNS',
  MULTI_COURSE_INTERLEAVED_COLUMNS: 'MULTI_COURSE_INTERLEAVED_COLUMNS',
  FALLBACK_COMPACT_WITH_WARNINGS: 'FALLBACK_COMPACT_WITH_WARNINGS',
});

function seatsGroupedByColumn(seats) {
  const map = new Map();
  for (const seat of seats) {
    if (!map.has(seat.column)) map.set(seat.column, []);
    map.get(seat.column).push(seat);
  }
  for (const [, colSeats] of map) {
    colSeats.sort((a, b) => a.row - b.row);
  }
  return map;
}

function sortedColumns(columnMap) {
  return [...columnMap.keys()].sort((a, b) => a - b);
}

function seatCountInColumns(columnMap, columnIndexes) {
  return columnIndexes.reduce((sum, col) => sum + (columnMap.get(col) || []).length, 0);
}

function usableAlternatingColumns(columnMap) {
  return sortedColumns(columnMap).filter((_, index) => index % 2 === 0);
}

function bestAlternatingColumns(columnMap) {
  const columns = sortedColumns(columnMap);
  const evenPattern = columns.filter((_, i) => i % 2 === 0);
  const oddPattern = columns.filter((_, i) => i % 2 === 1);
  const evenCapacity = seatCountInColumns(columnMap, evenPattern);
  const oddCapacity = seatCountInColumns(columnMap, oddPattern);
  return evenCapacity >= oddCapacity ? evenPattern : oddPattern;
}

function safeColumnCapacity(seats) {
  const columnMap = seatsGroupedByColumn(seats);
  const cols = bestAlternatingColumns(columnMap);
  return seatCountInColumns(columnMap, cols);
}

function seatsInColumns(columnMap, columnIndexes) {
  const colSet = new Set(columnIndexes);
  const result = [];
  for (const [col, colSeats] of columnMap) {
    if (colSet.has(col)) result.push(...colSeats);
  }
  return result;
}

function assignColumnsForInterleaving(columnMap, courseCount) {
  const columns = sortedColumns(columnMap);
  const assignments = Array.from({ length: courseCount }, () => []);
  for (let i = 0; i < columns.length; i++) {
    assignments[i % courseCount].push(columns[i]);
  }
  return assignments;
}

function determineStrategy(examGroups) {
  if (examGroups.length === 1) return SeatingStrategy.SINGLE_COURSE_ALTERNATING_COLUMNS;
  return SeatingStrategy.MULTI_COURSE_INTERLEAVED_COLUMNS;
}

function interleavedColumnCapacity(columnMap, examGroups) {
  const columns = sortedColumns(columnMap);
  const N = examGroups.length;
  const sorted = [...examGroups].sort((a, b) => b.students.length - a.students.length);
  let total = 0;
  for (let i = 0; i < N; i++) {
    const assignedCols = columns.filter((_, idx) => idx % N === i);
    const capacity = seatCountInColumns(columnMap, assignedCols);
    total += Math.min(sorted[i].students.length, capacity);
  }
  return total;
}

module.exports = {
  SeatingStrategy,
  seatsGroupedByColumn,
  sortedColumns,
  usableAlternatingColumns,
  bestAlternatingColumns,
  safeColumnCapacity,
  seatCountInColumns,
  seatsInColumns,
  assignColumnsForInterleaving,
  determineStrategy,
  interleavedColumnCapacity,
};
