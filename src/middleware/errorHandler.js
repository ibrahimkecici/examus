module.exports = (err, req, res, next) => {
  const statusCode = err.statusCode || err.status || (res.statusCode && res.statusCode !== 200 ? res.statusCode : 500);

  if (process.env.NODE_ENV !== 'test') {
    console.error(err);
  }

  res.status(statusCode).json({
    success: false,
    message: err && err.message ? err.message : 'Sunucu hatası',
    details: err.details,
    ...(process.env.NODE_ENV === 'development' && err && err.stack ? { stack: err.stack } : {}),
  });
};
