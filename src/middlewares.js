const notFound = (req, res, next) => {
  res.status(404);
  const error = new Error(`🔍 Path '${req.originalUrl}' is not found`);
  next(error);
};

const errorHandler = (err, _req, res, _next) => {
  const code = res.statusCode !== 200 ? res.statusCode : 500;
  res.status(code);

  res.json(
    {
      error: true,
      code: err.code,
      message: err.message,
      stack: process.env.NODE_ENV === 'production' ? undefined : err.stack
    }
  );
};

module.exports = {
  notFound,
  errorHandler
};
