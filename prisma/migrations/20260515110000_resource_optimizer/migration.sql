-- Resource optimizer support: mixed room slots, room requirements, and seat/classroom consistency.
ALTER TABLE "Classroom" ADD COLUMN "examCapacity" INTEGER;
ALTER TABLE "Classroom" ADD COLUMN "roomType" TEXT;
ALTER TABLE "Classroom" ADD COLUMN "features" JSONB;

ALTER TABLE "Course" ADD COLUMN "requiredRoomType" TEXT;
ALTER TABLE "Course" ADD COLUMN "requiredFeatures" JSONB;

ALTER TABLE "Exam" ADD COLUMN "requiredRoomType" TEXT;
ALTER TABLE "Exam" ADD COLUMN "requiredFeatures" JSONB;

CREATE TABLE "ExamRoomSlot" (
    "id" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "classroomId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "mixed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ExamRoomSlot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ExamRoomSlot_scenarioId_classroomId_date_startTime_endTime_key" ON "ExamRoomSlot"("scenarioId", "classroomId", "date", "startTime", "endTime");

ALTER TABLE "ExamRoomSlot" ADD CONSTRAINT "ExamRoomSlot_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "PlanningScenario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExamRoomSlot" ADD CONSTRAINT "ExamRoomSlot_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ExamRoomAssignment" ADD COLUMN "roomSlotId" TEXT;
DROP INDEX IF EXISTS "ExamRoomAssignment_scenarioId_examId_classroomId_key";
CREATE UNIQUE INDEX "ExamRoomAssignment_scenarioId_examId_classroomId_roomSlotId_key" ON "ExamRoomAssignment"("scenarioId", "examId", "classroomId", "roomSlotId");
ALTER TABLE "ExamRoomAssignment" ADD CONSTRAINT "ExamRoomAssignment_roomSlotId_fkey" FOREIGN KEY ("roomSlotId") REFERENCES "ExamRoomSlot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SeatAssignment" ADD CONSTRAINT "SeatAssignment_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
