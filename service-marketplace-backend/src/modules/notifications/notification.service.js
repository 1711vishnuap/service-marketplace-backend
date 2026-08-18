// src/modules/notifications/notification.service.js
// Sends push notifications via Firebase Cloud Messaging (FCM) and
// keeps a record of every notification in the `notifications` table
// so the app can show an in-app notification list later if needed.
//
// This module has no REST routes of its own — it's used internally
// by the works module (e.g. when a new work is posted nearby).

const { pool } = require('../../config/db');
const { admin, firebaseApp } = require('../../config/firebase');

/**
 * Sends a push notification to a single user (by user_id) and logs it.
 * Never throws — a failed push should never break the main request
 * (e.g. creating a work should still succeed even if a push fails).
 */
async function notifyUser({ userId, title, body, workId = null, data = {} }) {
  // 1. Always log the notification in the DB
  try {
    await pool.query(
      `INSERT INTO notifications (user_id, work_id, title, body)
       VALUES (?, ?, ?, ?)`,
      [userId, workId, title, body]
    );
  } catch (err) {
    console.error('⚠️  Failed to save notification record:', err.message);
  }

  // 2. Try to send the actual push via FCM (best-effort)
  if (!firebaseApp) {
    return; // Firebase not configured — skip push, DB record still saved
  }

  try {
    const [rows] = await pool.query(
      'SELECT fcm_token FROM users WHERE id = ?',
      [userId]
    );
    const fcmToken = rows[0]?.fcm_token;

    if (!fcmToken) return; // user has no device token yet

    await admin.messaging().send({
      token: fcmToken,
      notification: { title, body },
      data: {
        work_id: workId ? String(workId) : '',
        ...data,
      },
    });
  } catch (err) {
    console.error(`⚠️  Failed to send push to user ${userId}:`, err.message);
  }
}

module.exports = { notifyUser };
