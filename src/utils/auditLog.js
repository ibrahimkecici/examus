const prisma = require('../config/prisma');

async function writeAuditLog(req, { action, entity, entityId = null, metadata = null }) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: req?.user?.id || null,
        action,
        entity,
        entityId,
        metadata,
      },
    });
  } catch (error) {
    console.warn('Audit log yazılamadı:', error.message);
  }
}

module.exports = { writeAuditLog };
