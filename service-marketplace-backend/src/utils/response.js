// src/utils/response.js
// Small helpers so every API response has the same shape.
// Success: { success: true, message, data }
// Error:   { success: false, message }

function success(res, data = null, message = 'Success', statusCode = 200) {
  return res.status(statusCode).json({ success: true, message, data });
}

function error(res, message = 'Something went wrong', statusCode = 400) {
  return res.status(statusCode).json({ success: false, message });
}

module.exports = { success, error };
