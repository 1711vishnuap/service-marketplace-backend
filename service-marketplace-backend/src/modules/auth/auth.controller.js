// src/modules/auth/auth.controller.js

const asyncHandler = require('../../utils/asyncHandler');
const { success } = require('../../utils/response');
const authService = require('./auth.service');

// POST /api/auth/send-otp
const sendOtp = asyncHandler(async (req, res) => {
  const { mobile_number } = req.body;
  const result = await authService.sendOtp(mobile_number);
  success(res, result, 'OTP sent successfully');
});

// POST /api/auth/verify-otp
const verifyOtp = asyncHandler(async (req, res) => {
  const { mobile_number, otp, user_type, name } = req.body;
  const result = await authService.verifyOtp({ mobile_number, otp, user_type, name });
  success(res, result, 'Login successful');
});

module.exports = { sendOtp, verifyOtp };
