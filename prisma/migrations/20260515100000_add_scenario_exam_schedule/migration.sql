-- Scenario-specific schedules allow each planning scenario to produce its own dates.
-- Exam.date/startTime/endTime remain available for the approved/final plan.
CREATE TABLE "ScenarioExamSchedule" (
    "id" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL,

    CONSTRAINT "ScenarioExamSchedule_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ScenarioExamSchedule_scenarioId_examId_key" ON "ScenarioExamSchedule"("scenarioId", "examId");

ALTER TABLE "ScenarioExamSchedule" ADD CONSTRAINT "ScenarioExamSchedule_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "PlanningScenario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScenarioExamSchedule" ADD CONSTRAINT "ScenarioExamSchedule_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;
