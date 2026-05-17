-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Department_code_key" ON "Department"("code");

-- AlterTable
ALTER TABLE "User" ADD COLUMN "departmentId" TEXT;
ALTER TABLE "User" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Student" ADD COLUMN "departmentId" TEXT;
ALTER TABLE "Course" ADD COLUMN "departmentId" TEXT;
ALTER TABLE "Invigilator" ADD COLUMN "departmentId" TEXT;

-- Backfill departments from existing string fields.
INSERT INTO "Department" ("id", "code", "name", "updatedAt")
SELECT
  'dept_' || md5(trim("department")),
  upper(regexp_replace(trim("department"), '[^[:alnum:]]+', '_', 'g')),
  trim("department"),
  CURRENT_TIMESTAMP
FROM (
  SELECT "department" FROM "User" WHERE "department" IS NOT NULL AND trim("department") <> ''
  UNION
  SELECT "department" FROM "Student" WHERE "department" IS NOT NULL AND trim("department") <> ''
  UNION
  SELECT "department" FROM "Course" WHERE "department" IS NOT NULL AND trim("department") <> ''
  UNION
  SELECT "department" FROM "Invigilator" WHERE "department" IS NOT NULL AND trim("department") <> ''
) AS departments
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "Department" ("id", "code", "name", "updatedAt")
VALUES ('dept_genel', 'GENEL', 'Genel', CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

UPDATE "User" SET "departmentId" = 'dept_' || md5(trim("department"))
WHERE "department" IS NOT NULL AND trim("department") <> '';
UPDATE "Student" SET "departmentId" = 'dept_' || md5(trim("department"))
WHERE "department" IS NOT NULL AND trim("department") <> '';
UPDATE "Course" SET "departmentId" = 'dept_' || md5(trim("department"))
WHERE "department" IS NOT NULL AND trim("department") <> '';
UPDATE "Invigilator" SET "departmentId" = 'dept_' || md5(trim("department"))
WHERE "department" IS NOT NULL AND trim("department") <> '';

UPDATE "Student" SET "departmentId" = 'dept_genel'
WHERE "departmentId" IS NULL;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Student" ADD CONSTRAINT "Student_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Course" ADD CONSTRAINT "Course_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Invigilator" ADD CONSTRAINT "Invigilator_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
