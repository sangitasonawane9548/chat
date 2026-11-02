/**
 * Centralized Global Error Handling Middleware
 */
const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || (res.statusCode === 200 ? 500 : res.statusCode);
  let message = err.message || 'Internal Server Error';

  console.error(`[Error] [${req.method} ${req.url}] :`, err);

  // Handle Multer upload errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    statusCode = 400;
    message = 'File size exceeds maximum allowed limit.';
  }

  // Handle MySQL duplicate entry
  if (err.code === 'ER_DUP_ENTRY') {
    statusCode = 409;
    message = 'A record with this identifier already exists.';
  }

  // In production, sanitize 500 errors to avoid leaking internal system details
  if (process.env.NODE_ENV === 'production' && statusCode === 500) {
    message = 'An unexpected server error occurred. Please try again later.';
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

module.exports = errorHandler;

