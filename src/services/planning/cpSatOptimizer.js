const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { addMinutes, overlaps, sameDate } = require('../../utils/time');
const { parseConstraints } = require('./availabilityChecker');
const { requiredInvigilatorCount } = require('./config');
const { scoreInvigilator } = require('./invigilatorAllocator');
const { buildRoomCandidates } = require('./roomAllocator');

const DEFAULT_SOLVER_TIMEOUT_SECONDS = 20;
const DEFAULT_WORKER_TIMEOUT_MS = 45_000;
const MAX_INVIGILATOR_COMBINATIONS_PER_OPTION = 4;
const REPO_ROOT = path.resolve(__dirname, '../../..');

function dateKey(date) {
  return new Date(date).toISOString().slice(0, 10);
}

function scheduleKey(schedule) {
  return `${dateKey(schedule.date)}:${schedule.startTime}:${schedule.endTime}`;
}

function slotStart(slot) {
  return slot.startTime || slot.start;
}

function slotEnd(slot) {
  return slot.endTime || slot.end;
}

function slotDate(slot, fallbackDate) {
  return slot.date ? new Date(slot.date) : fallbackDate;
}

function defaultSlots(period) {
  if (Array.isArray(period.slots) && period.slots.length > 0) return period.slots;
  return [
    { startTime: '09:00', endTime: '11:00' },
    { startTime: '12:00', endTime: '14:00' },
    { startTime: '15:00', endTime: '17:00' },
  ];
}

function buildScheduleCandidates(group, period, dates) {
  const candidates = [];
  for (const fallbackDate of dates) {
    for (const slot of defaultSlots(period)) {
      const date = slotDate(slot, fallbackDate);
      if (slot.date && !sameDate(date, fallbackDate)) continue;
      const startTime = slotStart(slot);
      const slotEndTime = slotEnd(slot);
      const endTime = addMinutes(startTime, group.durationMinutes);
      if (!startTime || !slotEndTime || endTime > slotEndTime) continue;
      candidates.push({ date, startTime, endTime, durationMinutes: group.durationMinutes });
    }
  }
  return candidates;
}

function pinnedScheduleForGroup(group) {
  const pinned = group.exams.filter((exam) => exam.pinned);
  if (pinned.length === 0) return null;
  const first = pinned[0];
  if (!first.date || !first.startTime || !first.endTime) {
    return { invalid: true, reason: `${first.course?.code || first.id} sabitlenmiş ancak tarih/saat bilgisi eksik.` };
  }
  const target = { date: first.date, startTime: first.startTime, endTime: first.endTime };
  const mismatch = pinned.find(
    (exam) =>
      !exam.date ||
      !sameDate(exam.date, target.date) ||
      exam.startTime !== target.startTime ||
      exam.endTime !== target.endTime,
  );
  if (mismatch) {
    return { invalid: true, reason: `${group.exams.map((exam) => exam.course?.code || exam.id).join(', ')} karma grubunda uyumsuz sabit saatler var.` };
  }
  return target;
}

function scheduleMatchesPinned(schedule, pinned) {
  if (!pinned) return true;
  return sameDate(schedule.date, pinned.date) && schedule.startTime === pinned.startTime && schedule.endTime === pinned.endTime;
}

function lockedClassroomsByExam(lockedAssignments = []) {
  const map = new Map();
  for (const assignment of lockedAssignments) {
    if (!assignment.examId || !assignment.classroomId) continue;
    if (!map.has(assignment.examId)) map.set(assignment.examId, new Set());
    map.get(assignment.examId).add(assignment.classroomId);
  }
  return map;
}

function roomCandidateHonorsLockedSeats(group, roomCandidate, lockedByExam) {
  const roomIds = new Set(roomCandidate.rooms.map((room) => room.id));
  return group.exams.every((exam) => [...(lockedByExam.get(exam.id) || [])].every((classroomId) => roomIds.has(classroomId)));
}

function combinations(items, size, start = 0, prefix = [], output = []) {
  if (prefix.length === size) {
    output.push(prefix);
    return output;
  }
  for (let i = start; i <= items.length - (size - prefix.length); i += 1) {
    combinations(items, size, i + 1, [...prefix, items[i]], output);
  }
  return output;
}

function buildInvigilatorCombinations(invigilators, group, schedule, requiredCount, weights, config, classroom) {
  const loadMap = new Map();
  const scored = invigilators
    .map((invigilator) => ({
      invigilator,
      ...scoreInvigilator(invigilator, group.examGroups, schedule, loadMap, weights, config, classroom),
    }))
    .filter((candidate) => candidate.valid)
    .sort((a, b) => a.score - b.score || String(a.invigilator.id).localeCompare(String(b.invigilator.id), 'tr'));

  if (scored.length < requiredCount) return [];
  return combinations(scored.slice(0, Math.max(requiredCount, 10)), requiredCount)
    .map((combo) => ({
      invigilators: combo.map((item) => item.invigilator),
      score: Math.round(combo.reduce((sum, item) => sum + item.score, 0)),
    }))
    .sort((a, b) => a.score - b.score)
    .slice(0, MAX_INVIGILATOR_COMBINATIONS_PER_OPTION);
}

function physicalCapacityForRooms(rooms) {
  const physical = rooms.reduce((sum, room) => sum + Number(room.capacity || 0), 0);
  return physical || rooms.reduce((sum, room) => sum + Number(room.examCapacity || 0), 0);
}

function buildCpSatInput({ groups, period, dates, classrooms, invigilators, weights, config, strategy, lockedAssignments = [] }) {
  const lockedByExam = lockedClassroomsByExam(lockedAssignments);
  const options = [];
  const diagnostics = [];

  for (const group of groups) {
    const pinned = pinnedScheduleForGroup(group);
    if (pinned?.invalid) {
      diagnostics.push({ type: 'PINNED_SCHEDULE_INVALID', message: pinned.reason, groupId: group.id });
      continue;
    }

    const schedules = buildScheduleCandidates(group, period, dates).filter((schedule) => scheduleMatchesPinned(schedule, pinned));
    const roomCandidates = buildRoomCandidates(classrooms, group.examGroups, weights, strategy, { includeMultiRoomAlternatives: true })
      .filter((candidate) => roomCandidateHonorsLockedSeats(group, candidate, lockedByExam));
    const requiredInvigilators = requiredInvigilatorCount(group.students.length, config);
    const separateInvigilatorCount = group.examGroups.reduce((sum, examGroup) => sum + requiredInvigilatorCount(examGroup.students.length, config), 0);

    for (const schedule of schedules) {
      for (const roomCandidate of roomCandidates) {
        const physicalCapacity = physicalCapacityForRooms(roomCandidate.rooms) || roomCandidate.physicalCapacity || roomCandidate.totalCapacity;
        const roomSavings = group.mixed ? Math.max(0, group.examGroups.length - roomCandidate.rooms.length) : 0;
        const invigilatorSavings = group.mixed ? Math.max(0, separateInvigilatorCount - requiredInvigilators) : 0;
        const invigilatorCombos = buildInvigilatorCombinations(
          invigilators,
          group,
          schedule,
          requiredInvigilators,
          weights,
          config,
          roomCandidate.rooms[0],
        );
        for (const combo of invigilatorCombos) {
          const dateIndex = dates.findIndex((date) => sameDate(date, schedule.date));
          options.push({
            id: `o${options.length}`,
            groupId: group.id,
            examIds: group.exams.map((exam) => exam.id),
            courseCodes: group.exams.map((exam) => exam.course?.code || exam.id),
            studentIds: group.studentIds,
            roomIds: roomCandidate.rooms.map((room) => room.id),
            invigilatorIds: combo.invigilators.map((invigilator) => invigilator.id),
            date: dateKey(schedule.date),
            startTime: schedule.startTime,
            endTime: schedule.endTime,
            dateIndex,
            slotIndex: dates.length * 10 + options.length,
            scheduleKey: scheduleKey(schedule),
            roomWaste: Math.max(0, roomCandidate.totalCapacity - group.students.length),
            physicalRoomWaste: Math.max(0, physicalCapacity - group.students.length),
            utilizationPercent: roomCandidate.totalCapacity > 0 ? Math.round((group.students.length / roomCandidate.totalCapacity) * 100) : 0,
            physicalUtilizationPercent: physicalCapacity > 0 ? Math.round((group.students.length / physicalCapacity) * 100) : 0,
            effectiveExamCapacity: roomCandidate.totalCapacity,
            physicalCapacity,
            capacity: roomCandidate.totalCapacity,
            studentCount: group.students.length,
            roomCount: roomCandidate.rooms.length,
            roomScore: Math.round(roomCandidate.score),
            invigilatorScore: combo.score,
            mixed: group.mixed,
            mixedRoomSavings: roomSavings,
            mixedInvigilatorSavings: invigilatorSavings,
          });
        }
      }
    }

    if (!options.some((option) => option.groupId === group.id)) {
      diagnostics.push({
        type: 'NO_OPTIONS_FOR_GROUP',
        message: `${group.examGroups.map((item) => item.course.code).join(', ')} için CP-SAT adayı üretilemedi.`,
        groupId: group.id,
      });
    }
  }

  const slots = [...new Set(options.map((option) => option.scheduleKey))]
    .sort()
    .map((key, index) => [key, index]);
  const slotIndexByKey = new Map(slots);
  for (const option of options) option.slotIndex = slotIndexByKey.get(option.scheduleKey);

  return {
    solver: { timeoutSeconds: Number(process.env.CP_SAT_TIMEOUT_SECONDS || DEFAULT_SOLVER_TIMEOUT_SECONDS) },
    exams: groups.flatMap((group) => group.exams.map((exam) => ({ id: exam.id, courseCode: exam.course?.code || exam.id }))),
    invigilators: invigilators.map((invigilator) => ({
      id: invigilator.id,
      maxAssignments: invigilator.maxAssignments ?? 9999,
      maxPerDay: parseConstraints(invigilator).maxPerDay,
    })),
    options,
    diagnostics,
  };
}

function optionConflict(a, b) {
  if (a.date !== b.date || !overlaps(a.startTime, a.endTime, b.startTime, b.endTime)) return false;
  const hasAny = (left, right) => left.some((item) => right.includes(item));
  return hasAny(a.roomIds, b.roomIds) || hasAny(a.studentIds, b.studentIds) || hasAny(a.invigilatorIds, b.invigilatorIds);
}

function runCpSatWorker(input) {
  const workerPath = path.join(__dirname, 'cp_sat_worker.py');
  const venvPython = path.join(REPO_ROOT, '.venv', 'bin', 'python');
  const pythonPath = process.env.CP_SAT_PYTHON || process.env.PYTHON || (fs.existsSync(venvPython) ? venvPython : 'python3');
  return new Promise((resolve, reject) => {
    const child = spawn(pythonPath, [workerPath], { stdio: ['pipe', 'pipe', 'pipe'] });
    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`CP-SAT worker ${Number(process.env.CP_SAT_WORKER_TIMEOUT_MS || DEFAULT_WORKER_TIMEOUT_MS)} ms içinde tamamlanmadı; aday modeli çok büyük olabilir.`));
    }, Number(process.env.CP_SAT_WORKER_TIMEOUT_MS || DEFAULT_WORKER_TIMEOUT_MS));
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timeout);
      if (code !== 0 && !stdout.trim()) {
        reject(new Error(stderr.trim() || `CP-SAT worker ${code} koduyla kapandı.`));
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch (error) {
        reject(new Error(`CP-SAT worker geçersiz çıktı üretti: ${stderr || error.message}`));
      }
    });
    child.stdin.end(JSON.stringify(input));
  });
}

function placementsFromCpSatResult({ result, input, groups, classrooms, invigilators, weights }) {
  const groupById = new Map(groups.map((group) => [group.id, group]));
  const classroomById = new Map(classrooms.map((room) => [room.id, room]));
  const invigilatorById = new Map(invigilators.map((invigilator) => [invigilator.id, invigilator]));
  const optionById = new Map(input.options.map((option) => [option.id, option]));

  return (result.selectedOptionIds || []).map((id) => {
    const option = optionById.get(id);
    const group = groupById.get(option.groupId);
    const rooms = option.roomIds.map((roomId) => classroomById.get(roomId)).filter(Boolean);
    const selectedInvigilators = option.invigilatorIds.map((invigilatorId) => invigilatorById.get(invigilatorId)).filter(Boolean);
    const totalCapacity = option.effectiveExamCapacity ?? group.students.length + option.roomWaste;
    const physicalCapacity = (option.physicalCapacity ?? rooms.reduce((sum, room) => sum + Number(room?.capacity || 0), 0)) || totalCapacity;
    const mixedBonus = group.mixed
      ? (option.mixedRoomSavings || 0) * weights.mixedRoomEfficiencyBonus + (option.mixedInvigilatorSavings || 0) * Math.round(weights.invigilatorFairnessPenalty * 0.6)
      : 0;
    const scoreParts = {
      roomEfficiency: option.roomScore + option.physicalRoomWaste + Math.max(0, option.roomCount - 1) * weights.roomCountPenalty * 3,
      invigilatorFairness: option.invigilatorScore,
      studentLoadBalance: 0,
      timeEfficiency: option.dateIndex * weights.compactSlotPenalty,
      mixedRoomEfficiency: -mixedBonus,
      specialNeedsCompliance: 0,
    };
    return {
      group,
      schedule: {
        date: new Date(`${option.date}T00:00:00.000Z`),
        startTime: option.startTime,
        endTime: option.endTime,
        durationMinutes: group.durationMinutes,
      },
      date: new Date(`${option.date}T00:00:00.000Z`),
      startTime: option.startTime,
      endTime: option.endTime,
      rooms,
      roomCandidate: {
        rooms,
        totalCapacity,
        effectiveExamCapacity: totalCapacity,
        physicalCapacity,
        usedSafeCapacity: false,
        score: option.roomScore,
      },
      roomIds: option.roomIds,
      invigilators: selectedInvigilators,
      invigilatorIds: option.invigilatorIds,
      studentIds: group.studentIds,
      score: option.roomScore + option.invigilatorScore - mixedBonus,
      scoreParts,
      explanation: group.mixed
        ? `${option.courseCodes.join(', ')} CP-SAT tarafından aynı slot ve derslikte karma planlandı.`
        : `${option.courseCodes[0]} CP-SAT tarafından ${rooms.map((room) => room.code).join(' + ')} dersliğine yerleştirildi.`,
    };
  });
}

async function solveWithCpSat(args) {
  const input = buildCpSatInput(args);
  if (input.diagnostics.length > 0) {
    return { status: 'INFEASIBLE', input, diagnostics: input.diagnostics, selectedPlacements: [] };
  }
  const result = await runCpSatWorker(input);
  if (result.status !== 'OPTIMAL' && result.status !== 'FEASIBLE') {
    return { status: result.status || 'ERROR', input, diagnostics: result.diagnostics || [{ type: result.errorCode || 'CP_SAT_ERROR', message: result.message || 'CP-SAT çözümü üretilemedi.' }], selectedPlacements: [] };
  }
  return {
    status: result.status,
    input,
    diagnostics: result.diagnostics || [],
    selectedPlacements: placementsFromCpSatResult({ result, input, ...args }),
    objectiveValue: result.objectiveValue,
  };
}

module.exports = {
  buildCpSatInput,
  optionConflict,
  placementsFromCpSatResult,
  runCpSatWorker,
  solveWithCpSat,
};
