// src/modules/auth/auth.routes.js

const express = require('express');
const router = express.Router();
const authController = require('./auth.controller');

router.post('/send-otp', authController.sendOtp);
router.post('/verify-otp', authController.verifyOtp);

module.exports = router;
