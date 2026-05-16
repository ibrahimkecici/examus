const prisma = require('../config/prisma');

async function syncCourseStudentCounts(courseIds = null) {
  const where = Array.isArray(courseIds) && courseIds.length > 0 ? { id: { in: [...new Set(courseIds)] } } : {};
  const courses = await prisma.course.findMany({
    where,
    select: { id: true, _count: { select: { enrollments: true } } },
  });

  await prisma.$transaction(
    courses.map((course) =>
      prisma.course.update({
        where: { id: course.id },
        data: { studentCount: course._count.enrollments },
      }),
    ),
  );

  return courses.map((course) => ({ courseId: course.id, studentCount: course._count.enrollments }));
}

module.exports = { syncCourseStudentCounts };
