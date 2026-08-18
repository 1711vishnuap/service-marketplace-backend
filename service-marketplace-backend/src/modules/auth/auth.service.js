// src/modules/auth/auth.service.js
//
// AUTH DESIGN NOTE FOR THIS MVP:
// The tech stack calls for "Firebase Authentication/OTP for mobile
// login". In a full production setup, the actual SMS OTP is sent
// and verified on the FLUTTER SIDE using the Firebase Auth SDK
// (firebase_auth package), and the app then sends the resulting
// Firebase ID token to this backend, which verifies it using the
// Firebase Admin SDK.
//
// For this beginner-friendly MVP backend (so you can fully build
// and test the API right now, without setting up Firebase Phone
// Auth + SHA keys + billing first), we generate and check the OTP
// ourselves on the backend, and issue our own JWT after it's
// verified. Firebase Admin SDK is still used elsewhere in this
// project for push notifications (FCM), as required.
//
// To swap in real Firebase Phone Auth later: replace sendOtp/verifyOtp
// below with a single verifyFirebaseIdToken(idToken) call using
// admin.auth().verifyIdToken(idToken), then keep everything else
// (user creation + JWT issuing) the same.

const { pool } = require('../../config/db');
const { generateOtp } = require('../../utils/otp');
const { signToken } = require('../../utils/jwt');
const AppError = require('../../utils/AppError');

// In-memory OTP store: { [mobile_number]: { otp, expiresAt } }
// Fine for a single-server MVP. For production/multi-server setups,
// move this to Redis or a database table.
const otpStore = new Map();

const OTP_EXPIRY_MINUTES = Number(process.env.OTP_EXPIRY_MINUTES || 5);

function isValidMobileNumber(mobile) {
  return /^[0-9]{10,15}$/.test(mobile);
}

async function sendOtp(mobile_number) {
  if (!mobile_number || !isValidMobileNumber(mobile_number)) {
    throw new AppError('A valid mobile number is required', 400);
  }

  const otp = generateOtp(4);
  const expiresAt = Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000;

  otpStore.set(mobile_number, { otp, expiresAt });

  // Simulated SMS — in production, call your SMS gateway / Firebase here.
  console.log(`📲 OTP for ${mobile_number}: ${otp} (expires in ${OTP_EXPIRY_MINUTES} min)`);

  const response = { mobile_number, otp_sent: true };

  // Return the OTP directly only in development, so it's easy to test
  // via Postman/curl without wiring up a real SMS gateway.
  if (process.env.NODE_ENV !== 'production') {
    response.dev_otp = otp;
  }

  return response;
}

async function verifyOtp({ mobile_number, otp, user_type, name }) {
  if (!mobile_number || !otp) {
    throw new AppError('mobile_number and otp are required', 400);
  }

  const record = otpStore.get(mobile_number);

  if (!record) {
    throw new AppError('No OTP was requested for this mobile number', 400);
  }
  if (Date.now() > record.expiresAt) {
    otpStore.delete(mobile_number);
    throw new AppError('OTP has expired, please request a new one', 400);
  }
  if (record.otp !== otp) {
    throw new AppError('Invalid OTP', 400);
  }

  // OTP is correct — remove it so it can't be reused
  otpStore.delete(mobile_number);

  // Find existing user, or create a new one
  const [existingRows] = await pool.query(
    'SELECT * FROM users WHERE mobile_number = ?',
    [mobile_number]
  );

  let user = existingRows[0];

  if (!user) {
    if (!user_type || !['customer', 'worker'].includes(user_type)) {
      throw new AppError(
        'user_type ("customer" or "worker") is required for first-time login',
        400
      );
    }

    const firebaseUidPlaceholder = `local_${mobile_number}`; // see note at top of file

    const [result] = await pool.query(
      `INSERT INTO users (mobile_number, name, user_type, firebase_uid)
       VALUES (?, ?, ?, ?)`,
      [mobile_number, name || null, user_type, firebaseUidPlaceholder]
    );

    const [newRows] = await pool.query('SELECT * FROM users WHERE id = ?', [
      result.insertId,
    ]);
    user = newRows[0];
  }

  const token = signToken({ id: user.id, user_type: user.user_type });

  return { token, user };
}

module.exports = { sendOtp, verifyOtp };
