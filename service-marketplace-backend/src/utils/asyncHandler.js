// src/utils/asyncHandler.js
// Wraps an async route handler so any thrown error (or rejected promise)
// is automatically passed to next(err) -> our error handler middleware.
// This means controllers don't need try/catch everywhere.

function asyncHandler(fn) {
  return function (req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = asyncHandler;
