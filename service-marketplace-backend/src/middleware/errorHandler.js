// src/middleware/errorHandler.js
// Catches all errors passed via next(err) and sends a clean JSON
// response instead of leaking stack traces to the client.
// Must be registered LAST in app.js (after all routes).

function errorHandler(err, req, res, next) {
  console.error('❌ Error:', err.message);
  if (process.env.NODE_ENV === 'development') {
    console.error(err.stack);
  }

  const statusCode = err.isAppError ? err.statusCode : 500;
  const message = err.isAppError ? err.message : 'Internal server error';

  res.status(statusCode).json({ success: false, message });
}

// Handles requests to routes that don't exist
function notFoundHandler(req, res) {
  res.status(404).json({ success: false, message: 'Route not found' });
}

module.exports = { errorHandler, notFoundHandler };
