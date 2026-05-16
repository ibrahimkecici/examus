-- AlterTable
ALTER TABLE "Exam" ADD COLUMN     "bookletTypes" JSONB;

-- AlterTable
ALTER TABLE "SeatAssignment" ADD COLUMN     "bookletType" TEXT;
