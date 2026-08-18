// src/config/firebase.js
// Initializes Firebase Admin SDK. We only use this for sending
// push notifications (FCM) to workers/customers — NOT for OTP login
// in this MVP (see src/modules/auth for how OTP works).

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

let firebaseApp = null;

function initFirebase() {
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

  if (!serviceAccountPath || !fs.existsSync(path.resolve(serviceAccountPath))) {
    console.warn(
      '⚠️  Firebase service account file not found. Push notifications will be disabled.\n' +
      '    Set FIREBASE_SERVICE_ACCOUNT_PATH in .env to enable them.'
    );
    return null;
  }

  try {
    const serviceAccount = require(path.resolve(serviceAccountPath));
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log('✅ Firebase Admin SDK initialized');
    return firebaseApp;
  } catch (err) {
    console.warn('⚠️  Failed to initialize Firebase Admin SDK:', err.message);
    return null;
  }
}

initFirebase();

module.exports = { admin, firebaseApp };
