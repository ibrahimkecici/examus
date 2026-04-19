module.exports = (req, res, next) => {
  res.status(404).json({
    success: false,
    message: 'Geçersiz Endpoint / Route bulunamadı',
    path: req.originalUrl
  });
};
