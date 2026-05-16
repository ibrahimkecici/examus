const prisma = require('../config/prisma');
const { addMinutes, dateRange, overlaps, sameDate } = require('../utils/time');
const { syncCourseStudentCounts } = require('./courseStatsService');
const { buildCourseConflictMatrix, getExamStudents } = require('./planning/courseConflictMatrixBuilder');
const { DEFAULT_PLANNING_CONFIG, normalizeStrategy, strategyWeights } = require('./planning/config');
const { buildExplanations } = require('./planning/explanationBuilder');
const { invigilatorDisplayName } = require('./planning/invigilatorAllocator');
const { buildScenarioMetrics } = require('./planning/metricsBuilder');
const { buildPlanningGroups } = require('./planning/mixedRoomPlanner');
const { activeSeatCapacity, buildRoomCandidates, getEffectiveCapacity } = require('./planning/roomAllocator');
const { evaluatePlacementCandidate } = require('./planning/scenarioScorer');
const { solveWithCpSat } = require('./planning/cpSatOptimizer');
const { allocateSeatsForRoom, examHasMultipleBooklets } = require('./planning/seatAllocator');
const { groupSpecialNeedSummary, requiresExtraTime, studentSpecialNeeds } = require('./planning/specialNeeds');
const { validatePlacementConflicts, validateSameCourseHorizontalAdjacency, validateSameCourseDiagonalAdjacency, validateSingleCourseColumnSpacing, validateBooklets, validateExamCoverage, warning } = require('./planning/validationService');

function defaultSlots(period) {
  if (Array.isArray(period.slots) && period.slots.length > 0) return period.slots;
  return [
    { startTime: '09:00', endTime: '11:00' },
    { startTime: '12:00', endTime: '14:00' },
    { startTime: '15:00', endTime: '17:00' },
  ];
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

function sortDatesForStrategy(period, strategy) {
  const dates = dateRange(period.startDate, period.endDate);
  if (strategy === 'balanced' || strategy === 'fair_invigilator' || strategy === 'student_friendly') {
    const result = [];
    let left = 0;
    let right = dates.length - 1;
    while (left <= right) {
      result.push(dates[left]);
      if (left !== right) result.push(dates[right]);
      left += 1;
      right -= 1;
    }
    return result;
  }
  return dates;
}

async function ensurePeriodExams(periodId) {
  const period = await prisma.examPeriod.findUnique({ where: { id: periodId } });
  if (!period) {
    const error = new Error('Sınav dönemi bulunamadı.');
    error.status = 404;
    throw error;
  }

  const courses = await prisma.course.findMany({ include: { exams: { where: { periodId } } } });
  for (const course of courses) {
    if (course.exams.length === 0) {
      await prisma.exam.create({
        data: {
          periodId,
          courseId: course.id,
          durationMinutes: course.durationMinutes,
          type: course.examType,
          specialRules: course.specialRules,
          requiredRoomType: course.requiredRoomType,
          requiredFeatures: course.requiredFeatures,
        },
      });
    }
  }

  return period;
}

function invigilatorLoadFromPlacements(placements) {
  const load = new Map();
  for (const placement of placements) {
    for (const invigilator of placement.invigilators) {
      load.set(invigilator.id, [
        ...(load.get(invigilator.id) || []),
        {
          date: placement.date,
          startTime: placement.startTime,
          endTime: placement.endTime,
          building: placement.rooms[0]?.building,
        },
      ]);
    }
  }
  return load;
}

function findBestPlacement({ group, classrooms, invigilators, placements, dates, period, strategy, weights, config }) {
  let best = null;
  const schedules = buildScheduleCandidates(group, period, dates);
  const roomCandidates = buildRoomCandidates(classrooms, group.examGroups, weights, strategy);
  const invigilatorLoad = invigilatorLoadFromPlacements(placements);

  for (const schedule of schedules) {
    for (const roomCandidate of roomCandidates) {
      const candidate = evaluatePlacementCandidate({
        group,
        schedule,
        roomCandidate,
        invigilators,
        placements,
        invigilatorLoad,
        dates,
        strategy,
        weights,
        config,
      });
      if (candidate.valid && (!best || candidate.score < best.score)) best = candidate;
    }
  }
  return best;
}

function improvePlacements({ placements, classrooms, invigilators, dates, period, strategy, weights, config }) {
  let improved = [...placements];
  for (let iteration = 0; iteration < config.maxLocalSearchIterations; iteration += 1) {
    let changed = false;
    for (const current of [...improved]) {
      const others = improved.filter((item) => item !== current);
      const candidate = findBestPlacement({ group: current.group, classrooms, invigilators, placements: others, dates, period, strategy, weights, config });
      if (candidate && candidate.score + 1 < current.score) {
        improved = [...others, toPlacement(candidate)];
        changed = true;
      }
    }
    if (!changed) break;
  }
  return improved;
}

function shouldUseCpSat(strategy) {
  return strategy !== 'heuristic' && strategy !== 'legacy_heuristic';
}

function scenarioInclude() {
  return {
    period: true,
    schedules: true,
    roomSlots: { include: { classroom: true, assignments: { include: { exam: { include: { course: true } } } } } },
    rooms: { include: { exam: { include: { course: true } }, classroom: true, roomSlot: true } },
    seats: { include: { student: true, seat: true, classroom: true, exam: { include: { course: true } } } },
    invigilators: { include: { invigilator: true, exam: { include: { course: true } } } },
  };
}

async function markScenarioFailed(scenarioId, exams, invigilators, warnings, optimizerStatus = 'ERROR') {
  const metrics = buildScenarioMetrics({
    exams,
    placements: [],
    roomStats: [],
    invigilatorLoad: new Map(),
    invigilators,
    warnings,
    scoreParts: [],
    specialNeeds: { handledCount: 0, warningCount: 0 },
    seatRisks: { sameCourseAdjacentSeatCount: 0, sameCourseSameBookletFrontBackAvoidableCount: 0, sameCourseSameBookletFrontBackUnavoidableCount: 0 },
    explanations: [`CP-SAT durumu: ${optimizerStatus}`],
    seatAssignments: [],
  });
  return prisma.planningScenario.update({
    where: { id: scenarioId },
    data: { status: 'FAILED', metrics: { ...metrics, optimizer: 'cp_sat', optimizerStatus }, warnings, score: metrics.score },
    include: scenarioInclude(),
  });
}

function toPlacement(candidate) {
  return {
    ...candidate,
    date: candidate.schedule.date,
    startTime: candidate.schedule.startTime,
    endTime: candidate.schedule.endTime,
    roomIds: candidate.rooms.map((room) => room.id),
    invigilatorIds: candidate.invigilators.map((invigilator) => invigilator.id),
    studentIds: candidate.group.studentIds,
  };
}

function specialWarningsForPlacement(placement) {
  const warnings = [];
  const summary = groupSpecialNeedSummary(placement.group.students);
  if (summary) {
    warnings.push(warning('SPECIAL_NEEDS_SUMMARY', `${placement.group.examGroups.map((group) => group.course.code).join(', ')}: ${summary}`, 'soft', { examId: placement.group.exams[0].id }));
  }
  for (const student of placement.group.students) {
    if (requiresExtraTime(student)) {
      warnings.push(warning('SPECIAL_NEEDS_EXTRA_TIME', `Ek süre: ${student.fullName}`, 'soft', { studentId: student.id, examId: placement.group.exams[0].id }));
    }
  }
  return warnings;
}

function seatWarnings(placement, seatResult) {
  const warnings = [];
  for (const msg of seatResult.strategyWarnings || []) {
    warnings.push(warning('SEATING_STRATEGY', msg, 'soft'));
  }
  if (seatResult.sameCourseAdjacentSeatCount > 0) {
    warnings.push(warning('SAME_COURSE_ADJACENT_SEAT', `${placement.group.examGroups.map((group) => group.course.code).join(', ')} için aynı ders ve aynı kitapçık yan yana görünüyor; plan kontrol edilmeli.`, 'soft'));
  }
  if (seatResult.sameCourseSameBookletFrontBackAvoidableCount > 0) {
    warnings.push(warning('SAME_COURSE_FRONT_BACK_AVOIDABLE', `${placement.group.examGroups.map((group) => group.course.code).join(', ')} için aynı kitapçıklı bazı öğrenciler ön-arka oturuyor; kitapçık dağılımı yeniden değerlendirilebilir.`, 'soft'));
  }
  if (seatResult.sameCourseSameBookletFrontBackUnavoidableCount > 0) {
    warnings.push(warning('SAME_COURSE_FRONT_BACK_UNAVOIDABLE', `${placement.group.examGroups.map((group) => group.course.code).join(', ')} için tek kitapçık kullanıldığı için bazı ön-arka yerleşimler kaçınılmaz olabilir.`, 'info'));
  }
  if (seatResult.missingCount > 0) {
    warnings.push(warning('SEAT_CAPACITY_OVERFLOW', `${seatResult.missingCount} öğrenci yerleşemedi; uygun derslik kapasitesi bulunamadı.`, 'hard'));
  }
  return warnings;
}

async function persistPlacement(scenarioId, placement) {
  const roomStats = [];
  const allSeatAssignments = [];
  const strategyWarnings = [];
  let totalSameCourseAdjacentSeatCount = 0;
  let totalSameCourseSameBookletFrontBackAvoidableCount = 0;
  let totalSameCourseSameBookletFrontBackUnavoidableCount = 0;
  const assignedStudentIds = new Set();
  const createdSeatKeys = new Set();
  const schedulesCreated = new Map();
  const invigilatorsCreated = new Map();

  for (const room of placement.rooms) {
    const roomSlot = await prisma.examRoomSlot.create({
      data: {
        scenarioId,
        classroomId: room.id,
        date: placement.date,
        startTime: placement.startTime,
        endTime: placement.endTime,
        mixed: placement.group.mixed,
      },
    });

    const remainingGroups = placement.group.examGroups.map((group) => ({
      ...group,
      students: group.students.filter((s) => !assignedStudentIds.has(s.id)),
    }));
    const totalRemaining = remainingGroups.reduce((sum, g) => sum + g.students.length, 0);
    if (totalRemaining === 0) break;

    const seatResult = allocateSeatsForRoom(room, remainingGroups);
    strategyWarnings.push(...(seatResult.strategyWarnings || []));
    totalSameCourseAdjacentSeatCount += seatResult.sameCourseAdjacentSeatCount || 0;
    totalSameCourseSameBookletFrontBackAvoidableCount += seatResult.sameCourseSameBookletFrontBackAvoidableCount || 0;
    totalSameCourseSameBookletFrontBackUnavoidableCount += seatResult.sameCourseSameBookletFrontBackUnavoidableCount || 0;

    const assignedByExam = new Map();
    for (const assignment of seatResult.assignments) {
      const seatKey = `${assignment.exam.id}:${assignment.student.id}`;
      if (createdSeatKeys.has(seatKey)) continue;
      createdSeatKeys.add(seatKey);
      assignedStudentIds.add(assignment.student.id);
      assignedByExam.set(assignment.exam.id, (assignedByExam.get(assignment.exam.id) || 0) + 1);
      allSeatAssignments.push({ ...assignment, examId: assignment.exam.id });
      await prisma.seatAssignment.upsert({
        where: {
          scenarioId_examId_studentId: {
            scenarioId,
            examId: assignment.exam.id,
            studentId: assignment.student.id,
          },
        },
        update: {
          classroomId: room.id,
          seatId: assignment.seat.id,
          bookletType: assignment.bookletType || null,
        },
        create: {
          scenarioId,
          examId: assignment.exam.id,
          studentId: assignment.student.id,
          classroomId: room.id,
          seatId: assignment.seat.id,
          bookletType: assignment.bookletType || null,
        },
      });
    }

    for (const group of placement.group.examGroups) {
      const scheduleKey = `${scenarioId}:${group.exam.id}`;
      if (!schedulesCreated.has(scheduleKey)) {
        schedulesCreated.set(scheduleKey, true);
        await prisma.scenarioExamSchedule.create({
          data: {
            scenarioId,
            examId: group.exam.id,
            date: placement.date,
            startTime: placement.startTime,
            endTime: placement.endTime,
            durationMinutes: group.exam.durationMinutes,
          },
        });
      }
      await prisma.exam.update({ where: { id: group.exam.id }, data: { status: 'PLANNED' } });
      const perRoomCount = assignedByExam.get(group.exam.id) || 0;
      if (perRoomCount > 0) {
        await prisma.examRoomAssignment.create({
          data: {
            scenarioId,
            examId: group.exam.id,
            classroomId: room.id,
            roomSlotId: roomSlot.id,
            assignedCount: perRoomCount,
          },
        });
      }
      const invigKey = (invigilator) => `${scenarioId}:${group.exam.id}:${invigilator.id}`;
      for (const invigilator of placement.invigilators) {
        if (!invigilatorsCreated.has(invigKey(invigilator))) {
          invigilatorsCreated.set(invigKey(invigilator), true);
          await prisma.invigilatorAssignment.create({
            data: { scenarioId, examId: group.exam.id, invigilatorId: invigilator.id },
          });
        }
      }
    }

    const isSingleCourse = remainingGroups.length === 1;
    const multiBooklet = isSingleCourse && examHasMultipleBooklets(remainingGroups[0].exam);
    roomStats.push({
      roomId: room.id,
      roomSlotId: roomSlot.id,
      mixed: placement.group.mixed,
      capacity: Number(room.capacity || 0) || activeSeatCapacity(room),
      effectiveCapacity: getEffectiveCapacity(room, isSingleCourse, multiBooklet),
      assignedCount: seatResult.assignments.length,
    });
  }

  const missingCount = placement.group.students.length - allSeatAssignments.length;
  const filteredStrategyWarnings = missingCount === 0 && placement.rooms.length > 1
    ? strategyWarnings.filter((message) => !message.includes('kapasite yetersiz'))
    : strategyWarnings;

  return {
    roomStats,
    seatResult: {
      assignments: allSeatAssignments,
      strategyWarnings: filteredStrategyWarnings,
      sameCourseAdjacentSeatCount: totalSameCourseAdjacentSeatCount,
      sameCourseSameBookletFrontBackAvoidableCount: totalSameCourseSameBookletFrontBackAvoidableCount,
      sameCourseSameBookletFrontBackUnavoidableCount: totalSameCourseSameBookletFrontBackUnavoidableCount,
      missingCount,
    },
  };
}

async function runScenario(scenarioId) {
  const scenario = await prisma.planningScenario.findUnique({ where: { id: scenarioId }, include: { period: true } });
  if (!scenario) {
    const error = new Error('Planlama senaryosu bulunamadı.');
    error.status = 404;
    throw error;
  }

  await ensurePeriodExams(scenario.periodId);
  await syncCourseStudentCounts();
  const strategy = normalizeStrategy(scenario.strategy);
  const weights = strategyWeights(strategy);
  const config = DEFAULT_PLANNING_CONFIG;

  const [period, classrooms, invigilators, exams, lockedAssignments] = await Promise.all([
    prisma.examPeriod.findUnique({ where: { id: scenario.periodId } }),
    prisma.classroom.findMany({ include: { seats: true }, orderBy: [{ capacity: 'asc' }, { code: 'asc' }] }),
    prisma.invigilator.findMany({ include: { availability: true }, orderBy: [{ priority: 'desc' }, { lastName: 'asc' }] }),
    prisma.exam.findMany({
      where: { periodId: scenario.periodId },
      include: { course: { include: { enrollments: { include: { student: true } } } } },
    }),
    prisma.seatAssignment.findMany({ where: { scenarioId, locked: true }, include: { seat: true } }),
  ]);
  const activeExams = exams.filter((exam) => getExamStudents(exam).length > 0);
  const skippedExams = exams.filter((exam) => getExamStudents(exam).length === 0);

  await prisma.$transaction([
    prisma.seatAssignment.deleteMany({ where: { scenarioId } }),
    prisma.invigilatorAssignment.deleteMany({ where: { scenarioId } }),
    prisma.examRoomAssignment.deleteMany({ where: { scenarioId } }),
    prisma.examRoomSlot.deleteMany({ where: { scenarioId } }),
    prisma.scenarioExamSchedule.deleteMany({ where: { scenarioId } }),
    prisma.planningScenario.update({ where: { id: scenarioId }, data: { status: 'RUNNING', warnings: [] } }),
  ]);

  const dates = sortDatesForStrategy(period, strategy);
  const courseConflictMatrix = buildCourseConflictMatrix(activeExams);
  const groups = buildPlanningGroups(activeExams, courseConflictMatrix, classrooms, config, strategy);
  const warnings = skippedExams.map((exam) =>
    warning('ZERO_ENROLLMENT_EXAM_SKIPPED', `${exam.course?.code || exam.id} sınavı kayıtlı öğrencisi olmadığı için planlama dışında bırakıldı.`, 'info', { examId: exam.id }),
  );
  let improvedPlacements = [];
  let optimizerStatus = 'HEURISTIC';

  if (shouldUseCpSat(scenario.strategy)) {
    let solved;
    try {
      solved = await solveWithCpSat({ groups, period, dates, classrooms, invigilators, weights, config, strategy, lockedAssignments });
    } catch (error) {
      const failureWarnings = [
        warning(
          'CP_SAT_WORKER_ERROR',
          `CP-SAT worker çalıştırılamadı: ${error.message}. OR-Tools kurulu değilse \`npm run python:setup\` çalıştırın; model süre limitine takılıyorsa \`CP_SAT_WORKER_TIMEOUT_MS\` değerini artırabilir veya geçici olarak heuristic stratejisini seçebilirsiniz.`,
          'hard',
        ),
      ];
      return markScenarioFailed(scenarioId, activeExams, invigilators, failureWarnings, 'ERROR');
    }
    optimizerStatus = solved.status;
    if (solved.selectedPlacements.length > 0) {
      improvedPlacements = solved.selectedPlacements;
      if (solved.status === 'FEASIBLE') {
        warnings.push(warning('CP_SAT_BEST_FEASIBLE', 'CP-SAT süre limiti içinde optimal kanıt üretmedi; bulunan en iyi geçerli plan kullanıldı.', 'soft'));
      }
    } else {
      warnings.push(...(solved.diagnostics || []).map((item) => warning(item.type || 'CP_SAT_FAILED', item.message || 'CP-SAT plan üretemedi.', 'hard', item)));
      return markScenarioFailed(scenarioId, activeExams, invigilators, warnings, optimizerStatus);
    }
  } else {
    const placements = [];
    for (const group of groups) {
      const candidate = findBestPlacement({ group, classrooms, invigilators, placements, dates, period, strategy, weights, config });
      if (!candidate) {
        warnings.push(warning('UNPLACED', `${group.examGroups.map((item) => item.course.code).join(', ')} için geçerli kaynak kombinasyonu bulunamadı.`, 'hard'));
        continue;
      }
      placements.push(toPlacement(candidate));
    }
    improvedPlacements = improvePlacements({ placements, classrooms, invigilators, dates, period, strategy, weights, config });
  }
  const conflictWarnings = validatePlacementConflicts(improvedPlacements);
  warnings.push(...conflictWarnings);

  const roomStats = [];
  const scoreParts = [];
  const seatRisks = { sameCourseAdjacentSeatCount: 0, sameCourseSameBookletFrontBackAvoidableCount: 0, sameCourseSameBookletFrontBackUnavoidableCount: 0 };
  const specialNeeds = { handledCount: 0, warningCount: 0 };
  const allPersistedAssignments = [];

  for (const placement of improvedPlacements) {
    const persisted = await persistPlacement(scenarioId, placement);
    roomStats.push(...(Array.isArray(persisted.roomStats) ? persisted.roomStats : [persisted.roomStats]));
    scoreParts.push(placement.scoreParts);
    seatRisks.sameCourseAdjacentSeatCount += persisted.seatResult.sameCourseAdjacentSeatCount;
    seatRisks.sameCourseSameBookletFrontBackAvoidableCount += persisted.seatResult.sameCourseSameBookletFrontBackAvoidableCount;
    seatRisks.sameCourseSameBookletFrontBackUnavoidableCount += persisted.seatResult.sameCourseSameBookletFrontBackUnavoidableCount;
    specialNeeds.handledCount += persisted.seatResult.assignments.filter((item) => studentSpecialNeeds(item.student).types.length > 0 || studentSpecialNeeds(item.student).unknown.length > 0).length;
    specialNeeds.warningCount += persisted.seatResult.missingCount;
    warnings.push(...specialWarningsForPlacement(placement), ...seatWarnings(placement, persisted.seatResult));
    if (placement.rooms.length > 1) {
      warnings.push(warning('MULTI_ROOM_SPLIT', `${placement.group.examGroups.map((g) => g.course.code).join(', ')} ${placement.rooms.length} dersliğe bölündü (emniyetli kapasite yetersiz).`, 'soft'));
    }
    allPersistedAssignments.push(...persisted.seatResult.assignments);
  }

  if (allPersistedAssignments.length > 0) {
    warnings.push(...validateSameCourseHorizontalAdjacency(allPersistedAssignments, 'hard'));
    warnings.push(...validateSameCourseDiagonalAdjacency(allPersistedAssignments, 'hard'));
    warnings.push(...validateSingleCourseColumnSpacing(allPersistedAssignments));
    warnings.push(...validateBooklets(allPersistedAssignments));
  }

  // Coverage validation: every enrolled student must have exactly one seat assignment
  warnings.push(...validateExamCoverage(activeExams, allPersistedAssignments));

  // Fix assignedCount on ExamRoomAssignment: recompute from actual SeatAssignment rows
  // (in-memory allPersistedAssignments already reflects DB reality)
  const assignedPerExamRoom = new Map(); // `${examId}:${classroomId}` -> Set<studentId>
  for (const a of allPersistedAssignments) {
    const key = `${a.examId}:${a.seat.classroomId || a.classroomId}`;
    if (!assignedPerExamRoom.has(key)) assignedPerExamRoom.set(key, new Set());
    assignedPerExamRoom.get(key).add(a.student.id);
  }
  for (const [key, studentIds] of assignedPerExamRoom) {
    const [examId, classroomId] = key.split(':');
    await prisma.examRoomAssignment.updateMany({
      where: { scenarioId, examId, classroomId },
      data: { assignedCount: studentIds.size },
    });
  }

  const invigilatorLoad = invigilatorLoadFromPlacements(improvedPlacements);
  const explanations = buildExplanations(improvedPlacements);
  const metrics = buildScenarioMetrics({
    exams: activeExams,
    placements: improvedPlacements,
    roomStats,
    invigilatorLoad,
    invigilators,
    warnings,
    scoreParts,
    specialNeeds,
    seatRisks,
    explanations,
    seatAssignments: allPersistedAssignments,
  });

  return prisma.planningScenario.update({
    where: { id: scenarioId },
    data: { status: warnings.some((item) => item.severity === 'hard') ? 'FAILED' : 'COMPLETED', metrics: { ...metrics, optimizer: shouldUseCpSat(scenario.strategy) ? 'cp_sat' : 'heuristic', optimizerStatus }, warnings, score: metrics.score },
    include: scenarioInclude(),
  });
}

async function recheckScenario(scenarioId) {
  const scenario = await prisma.planningScenario.findUnique({
    where: { id: scenarioId },
    include: {
      schedules: true,
      roomSlots: true,
      seats: { include: { student: true, seat: true, classroom: true, exam: { include: { course: true } } } },
      rooms: { include: { classroom: true, roomSlot: true, exam: true } },
      invigilators: { include: { invigilator: true, exam: true } },
    },
  });
  if (!scenario) {
    const error = new Error('Planlama senaryosu bulunamadı.');
    error.status = 404;
    throw error;
  }

  const warnings = [];
  const roomSlots = new Map();
  for (const slot of scenario.roomSlots) {
    const key = `${slot.classroomId}:${new Date(slot.date).toISOString().slice(0, 10)}:${slot.startTime}:${slot.endTime}`;
    if (roomSlots.has(key)) warnings.push(warning('ROOM_CONFLICT', 'Aynı derslik aynı zaman slotunda tekrar edilmiş.', 'hard'));
    roomSlots.set(key, true);
  }

  const studentSlots = [];
  for (const seat of scenario.seats) {
    const schedule = scenario.schedules.find((item) => item.examId === seat.examId) || seat.exam;
    if (seat.seat.classroomId !== seat.classroomId) warnings.push(warning('SEAT_CLASSROOM_MISMATCH', `${seat.student.fullName} için seat/classroom tutarsız.`, 'hard'));
    if (studentSlots.some((item) => item.studentId === seat.studentId && sameDate(item.date, schedule.date) && overlaps(item.startTime, item.endTime, schedule.startTime, schedule.endTime))) {
      warnings.push(warning('STUDENT_CONFLICT', `${seat.student.fullName} için sınav çakışması var.`, 'hard'));
    }
    studentSlots.push({ studentId: seat.studentId, date: schedule.date, startTime: schedule.startTime, endTime: schedule.endTime });
  }

  const invigilatorSlots = [];
  const roomSlotByExamId = new Map(scenario.rooms.map((room) => [room.examId, room.roomSlotId]));
  for (const assignment of scenario.invigilators) {
    const schedule = scenario.schedules.find((item) => item.examId === assignment.examId) || assignment.exam;
    const roomSlotId = roomSlotByExamId.get(assignment.examId);
    if (
      invigilatorSlots.some(
        (item) =>
          item.invigilatorId === assignment.invigilatorId &&
          item.roomSlotId !== roomSlotId &&
          sameDate(item.date, schedule.date) &&
          overlaps(item.startTime, item.endTime, schedule.startTime, schedule.endTime),
      )
    ) {
      warnings.push(warning('INVIGILATOR_CONFLICT', `${invigilatorDisplayName(assignment.invigilator)} için gözetmen çakışması var.`, 'hard'));
    }
    invigilatorSlots.push({ invigilatorId: assignment.invigilatorId, roomSlotId, date: schedule.date, startTime: schedule.startTime, endTime: schedule.endTime });
  }

  return prisma.planningScenario.update({
    where: { id: scenarioId },
    data: { status: warnings.some((item) => item.severity === 'hard') ? 'FAILED' : scenario.status, warnings, metrics: { ...(scenario.metrics || {}), warningCount: warnings.length, warnings } },
  });
}

module.exports = { buildScheduleCandidates, defaultSlots, getExamStudents, recheckScenario, runScenario, sortDatesForStrategy };
