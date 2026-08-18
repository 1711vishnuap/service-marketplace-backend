// src/utils/AppError.js
// A simple custom Error class so we can throw errors with a specific
// HTTP status code from anywhere (services/controllers) and have the
// global error handler respond correctly.

class AppError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
    this.isAppError = true;
  }
}

module.exports = AppError;
