// src/modules/workers/worker.service.js

const { pool } = require('../../config/db');
const AppError = require('../../utils/AppError');
const { notifyUser } = require('../notifications/notification.service');

// Looks up the `workers` row for a given users.id (throws if not found)
async function getWorkerByUserId(userId) {
  const [rows] = await pool.query('SELECT * FROM workers WHERE user_id = ?', [
    userId,
  ]);
  if (!rows[0]) {
    throw new AppError(
      'Worker profile not found. Please create your profile first (POST /api/workers/profile)',
      404
    );
  }
  return rows[0];
}

// POST /api/workers/profile
// Creates the worker profile row on first login, or just confirms it
// already exists on subsequent calls (simple upsert).
async function upsertProfile(userId) {
  const [existing] = await pool.query(
    'SELECT * FROM workers WHERE user_id = ?',
    [userId]
  );

  if (existing[0]) {
    return existing[0];
  }

  const [result] = await pool.query(
    'INSERT INTO workers (user_id) VALUES (?)',
    [userId]
  );

  const [rows] = await pool.query('SELECT * FROM workers WHERE id = ?', [
    result.insertId,
  ]);
  return rows[0];
}

// POST /api/workers/categories
// Replaces the worker's category list with the given category_ids.
async function setCategories(userId, categoryIds) {
  if (!Array.isArray(categoryIds) || categoryIds.length === 0) {
    throw new AppError('category_ids must be a non-empty array', 400);
  }

  const worker = await getWorkerByUserId(userId);

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    await connection.query('DELETE FROM worker_categories WHERE worker_id = ?', [
      worker.id,
    ]);

    const values = categoryIds.map((categoryId) => [worker.id, categoryId]);
    await connection.query(
      'INSERT INTO worker_categories (worker_id, category_id) VALUES ?',
      [values]
    );

    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }

  const [categories] = await pool.query(
    `SELECT c.id, c.name FROM categories c
     JOIN worker_categories wc ON wc.category_id = c.id
     WHERE wc.worker_id = ?`,
    [worker.id]
  );

  return categories;
}

// POST /api/workers/location
async function updateLocation(userId, lat, lng) {
  if (lat === undefined || lng === undefined) {
    throw new AppError('lat and lng are required', 400);
  }

  const worker = await getWorkerByUserId(userId);

  await pool.query(
    'UPDATE workers SET current_lat = ?, current_lng = ? WHERE id = ?',
    [lat, lng, worker.id]
  );

  return { updated: true, lat, lng };
}

// GET /api/workers/available-works
// Returns works that were notified to THIS worker and are still open
// (no one has accepted them yet).
async function getAvailableWorks(userId) {
  const worker = await getWorkerByUserId(userId);

  const [rows] = await pool.query(
    `SELECT
        w.id, w.title, w.description, w.photo_url,
        w.customer_lat, w.customer_lng, w.status,
        w.created_at, c.name AS category_name,
        wa.distance_km
     FROM work_assignments wa
     JOIN works w ON w.id = wa.work_id
     JOIN categories c ON c.id = w.category_id
     WHERE wa.worker_id = ?
       AND wa.status = 'NOTIFIED'
       AND w.status IN ('POSTED', 'NOTIFIED')
     ORDER BY wa.distance_km ASC`,
    [worker.id]
  );

  return rows;
}

// POST /api/works/:id/accept
// Uses an atomic UPDATE (WHERE accepted_worker_id IS NULL) so that if
// two workers tap "Accept" at the same time, only the first one wins.
async function acceptWork(userId, workId) {
  const worker = await getWorkerByUserId(userId);

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [updateResult] = await connection.query(
      `UPDATE works
       SET accepted_worker_id = ?, status = 'ACCEPTED'
       WHERE id = ?
         AND accepted_worker_id IS NULL
         AND status IN ('POSTED', 'NOTIFIED')`,
      [worker.id, workId]
    );

    if (updateResult.affectedRows === 0) {
      // Either the work doesn't exist, or someone else already accepted it
      await connection.rollback();
      throw new AppError(
        'This work is no longer available (it may already be accepted by another worker)',
        409
      );
    }

    // Mark this worker's assignment as ACCEPTED
    await connection.query(
      `UPDATE work_assignments SET status = 'ACCEPTED'
       WHERE work_id = ? AND worker_id = ?`,
      [workId, worker.id]
    );

    // Mark all other notified workers for this work as EXPIRED
    await connection.query(
      `UPDATE work_assignments SET status = 'EXPIRED'
       WHERE work_id = ? AND worker_id != ? AND status = 'NOTIFIED'`,
      [workId, worker.id]
    );

    await connection.query(
      `INSERT INTO work_status_history (work_id, status) VALUES (?, 'ACCEPTED')`,
      [workId]
    );

    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }

  // Notify the customer that a worker accepted their work (best-effort)
  const [workRows] = await pool.query(
    'SELECT customer_id, title FROM works WHERE id = ?',
    [workId]
  );
  if (workRows[0]) {
    await notifyUser({
      userId: workRows[0].customer_id,
      title: 'Worker assigned!',
      body: `A worker has accepted your request: "${workRows[0].title}"`,
      workId,
    });
  }

  const [rows] = await pool.query('SELECT * FROM works WHERE id = ?', [workId]);
  return rows[0];
}

// Shared helper: fetch a work and confirm it belongs to this worker
async function getOwnedWork(userId, workId) {
  const worker = await getWorkerByUserId(userId);

  const [rows] = await pool.query('SELECT * FROM works WHERE id = ?', [workId]);
  const work = rows[0];

  if (!work) throw new AppError('Work not found', 404);
  if (work.accepted_worker_id !== worker.id) {
    throw new AppError('This work is not assigned to you', 403);
  }

  return { work, worker };
}

// POST /api/works/:id/verify-otp
// Worker enters the OTP shown by the customer to confirm arrival and
// start the job.
async function verifyWorkOtp(userId, workId, otp) {
  if (!otp) throw new AppError('otp is required', 400);

  const { work } = await getOwnedWork(userId, workId);

  if (work.status !== 'ACCEPTED') {
    throw new AppError(
      `OTP can only be verified for accepted work (current status: ${work.status})`,
      400
    );
  }

  if (work.otp_expires_at && new Date(work.otp_expires_at) < new Date()) {
    throw new AppError('This OTP has expired', 400);
  }

  if (work.otp_code !== otp) {
    throw new AppError('Invalid OTP', 400);
  }

  await pool.query(
    `UPDATE works
     SET status = 'STARTED', otp_verified_at = NOW()
     WHERE id = ?`,
    [workId]
  );

  await pool.query(
    `INSERT INTO work_status_history (work_id, status) VALUES (?, 'STARTED')`,
    [workId]
  );

  const [rows] = await pool.query('SELECT * FROM works WHERE id = ?', [workId]);
  return rows[0];
}

// POST /api/works/:id/complete
async function completeWork(userId, workId) {
  const { work } = await getOwnedWork(userId, workId);

  if (work.status !== 'STARTED') {
    throw new AppError(
      `Work can only be completed after it has started (current status: ${work.status})`,
      400
    );
  }

  await pool.query(`UPDATE works SET status = 'COMPLETED' WHERE id = ?`, [
    workId,
  ]);

  await pool.query(
    `INSERT INTO work_status_history (work_id, status) VALUES (?, 'COMPLETED')`,
    [workId]
  );

  await notifyUser({
    userId: work.customer_id,
    title: 'Work completed',
    body: `Your work "${work.title}" has been marked as completed.`,
    workId,
  });

  const [rows] = await pool.query('SELECT * FROM works WHERE id = ?', [workId]);
  return rows[0];
}

module.exports = {
  getWorkerByUserId,
  upsertProfile,
  setCategories,
  updateLocation,
  getAvailableWorks,
  acceptWork,
  verifyWorkOtp,
  completeWork,
};
