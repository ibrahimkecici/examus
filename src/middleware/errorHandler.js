module.exports = (err, req, res, next) => {
  // If a response status was already set (and isn't 200), keep it; otherwise default to 500.
  const statusCode = res.statusCode && res.statusCode !== 200 ? res.statusCode : 500;

  res.status(statusCode).json({
    success: false,
    message: err && err.message ? err.message : 'Sunucu hatası',
    ...(process.env.NODE_ENV === 'development' && err && err.stack ? { stack: err.stack } : {})
  });
};
