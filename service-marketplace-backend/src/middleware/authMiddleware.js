// src/middleware/authMiddleware.js
// Protects routes by requiring a valid JWT in the Authorization header:
//   Authorization: Bearer <token>
//
// On success, sets req.user = { id, user_type } for use in controllers.

const { verifyToken } = require('../utils/jwt');
const { error } = require('../utils/response');

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return error(res, 'Authentication token missing', 401);
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = verifyToken(token);
    req.user = { id: decoded.id, user_type: decoded.user_type };
    next();
  } catch (err) {
    return error(res, 'Invalid or expired token', 401);
  }
}

// Use AFTER requireAuth on routes only customers should access
function requireCustomer(req, res, next) {
  if (req.user.user_type !== 'customer') {
    return error(res, 'This action is only available to customers', 403);
  }
  next();
}

// Use AFTER requireAuth on routes only workers should access
function requireWorker(req, res, next) {
  if (req.user.user_type !== 'worker') {
    return error(res, 'This action is only available to workers', 403);
  }
  next();
}

module.exports = { requireAuth, requireCustomer, requireWorker };
