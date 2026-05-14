const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-change-me';

exports.signToken = (user) =>
  jwt.sign({ sub: user.id, role: user.role, email: user.email }, JWT_SECRET, { expiresIn: '8h' });

exports.requireAuth = async (req, res, next) => {
  try {
    const header = req.headers.authorization || '';
    const queryToken = Array.isArray(req.query.token) ? req.query.token[0] : req.query.token;
    const token = header.startsWith('Bearer ') ? header.slice(7) : queryToken;

    if (!token) {
      return res.status(401).json({ success: false, message: 'Oturum gerekli.' });
    }

    const payload = jwt.verify(token, JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, name: true, email: true, role: true, department: true },
    });

    if (!user) {
      return res.status(401).json({ success: false, message: 'Geçersiz oturum.' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Oturum doğrulanamadı.' });
  }
};

exports.requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'Bu işlem için yetkiniz yok.' });
  }
  next();
};
