// src/modules/works/work.service.js

const { pool } = require('../../config/db');
const AppError = require('../../utils/AppError');
const { generateOtp } = require('../../utils/otp');
const { haversineDistanceKm } = require('../../utils/distance');
const { notifyUser } = require('../notifications/notification.service');

const NEARBY_RADIUS_KM = Number(process.env.NEARBY_RADIUS_KM || 15);
const NEARBY_WORKERS_LIMIT = Number(process.env.NEARBY_WORKERS_LIMIT || 5);
const OTP_EXPIRY_MINUTES = Number(process.env.OTP_EXPIRY_MINUTES || 5) * 60 * 24; // work OTP lives longer (until job done)

/**
 * NEAREST WORKER MATCHING
 * ------------------------------------------------------------
 * 1. Find workers who offer the requested category AND are available.
 * 2. Calculate straight-line distance from each worker to the customer.
 * 3. Sort by distance (nearest first) and take the top N.
 * 4. Create a `work_assignments` row for each (status = NOTIFIED).
 * 5. Send each of them a push notification.
 * Whichever worker calls POST /api/works/:id/accept FIRST wins —
 * see worker.service.js acceptWork() for how that race is handled.
 */
async function findAndNotifyNearestWorkers(work) {
  const [candidates] = await pool.query(
    `SELECT w.id AS worker_id, w.user_id, w.current_lat, w.current_lng
     FROM workers w
     JOIN worker_categories wc ON wc.worker_id = w.id
     WHERE wc.category_id = ?
       AND w.is_available = 1
       AND w.current_lat IS NOT NULL
       AND w.current_lng IS NOT NULL`,
    [work.category_id]
  );

  if (candidates.length === 0) {
    return []; // no eligible workers right now — work stays in POSTED status
  }

  // Calculate distance for each candidate, keep only those within radius
  const withDistance = candidates
    .map((worker) => ({
      ...worker,
      distance_km: haversineDistanceKm(
        Number(work.customer_lat),
        Number(work.customer_lng),
        Number(worker.current_lat),
        Number(worker.current_lng)
      ),
    }))
    .filter((worker) => worker.distance_km <= NEARBY_RADIUS_KM)
    .sort((a, b) => a.distance_km - b.distance_km)
    .slice(0, NEARBY_WORKERS_LIMIT);

  if (withDistance.length === 0) {
    return [];
  }

  // Insert work_assignments rows for the selected nearest workers
  const values = withDistance.map((w) => [work.id, w.worker_id, w.distance_km, 'NOTIFIED']);
  await pool.query(
    `INSERT INTO work_assignments (work_id, worker_id, distance_km, status) VALUES ?`,
    [values]
  );

  // Send a push notification to each selected worker (best-effort, parallel)
  await Promise.all(
    withDistance.map((w) =>
      notifyUser({
        userId: w.user_id,
        title: 'New work near you!',
        body: `${work.title} — approx ${w.distance_km} km away`,
        workId: work.id,
      })
    )
  );

  return withDistance;
}

// POST /api/works
async function createWork(customerId, payload) {
  const { category_id, title, description, photo_url, lat, lng } = payload;

  if (!category_id || !title || lat === undefined || lng === undefined) {
    throw new AppError('category_id, title, lat and lng are required', 400);
  }

  const [categoryRows] = await pool.query(
    'SELECT id FROM categories WHERE id = ? AND is_active = 1',
    [category_id]
  );
  if (!categoryRows[0]) {
    throw new AppError('Invalid category_id', 400);
  }

  const otp = generateOtp(4);
  const otpExpiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  const [result] = await pool.query(
    `INSERT INTO works
        (customer_id, category_id, title, description, photo_url,
         customer_lat, customer_lng, status, otp_code, otp_generated_at, otp_expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'POSTED', ?, NOW(), ?)`,
    [customerId, category_id, title, description || null, photo_url || null, lat, lng, otp, otpExpiresAt]
  );

  const workId = result.insertId;

  await pool.query(
    `INSERT INTO work_status_history (work_id, status) VALUES (?, 'POSTED')`,
    [workId]
  );

  const [rows] = await pool.query('SELECT * FROM works WHERE id = ?', [workId]);
  const work = rows[0];

  // Find nearby eligible workers and notify them
  const notifiedWorkers = await findAndNotifyNearestWorkers(work);

  if (notifiedWorkers.length > 0) {
    await pool.query(`UPDATE works SET status = 'NOTIFIED' WHERE id = ?`, [workId]);
    await pool.query(
      `INSERT INTO work_status_history (work_id, status) VALUES (?, 'NOTIFIED')`,
      [workId]
    );
    work.status = 'NOTIFIED';
  }

  return work;
}

// GET /api/works/my
async function getMyWorks(customerId) {
  const [rows] = await pool.query(
    `SELECT w.*, c.name AS category_name
     FROM works w
     JOIN categories c ON c.id = w.category_id
     WHERE w.customer_id = ?
     ORDER BY w.created_at DESC`,
    [customerId]
  );
  return rows;
}

// GET /api/works/:id
// Accessible by the owning customer, OR the worker currently assigned to it.
async function getWorkById(user, workId) {
  const [rows] = await pool.query(
    `SELECT w.*, c.name AS category_name
     FROM works w
     JOIN categories c ON c.id = w.category_id
     WHERE w.id = ?`,
    [workId]
  );
  const work = rows[0];
  if (!work) throw new AppError('Work not found', 404);

  if (user.user_type === 'customer' && work.customer_id === user.id) {
    return work;
  }

  if (user.user_type === 'worker') {
    const [workerRows] = await pool.query(
      'SELECT id FROM workers WHERE user_id = ?',
      [user.id]
    );
    const worker = workerRows[0];
    if (worker && work.accepted_worker_id === worker.id) {
      return work;
    }
  }

  throw new AppError('You do not have access to this work', 403);
}

// GET /api/works/:id/worker
// Returns the accepted worker's basic info + current location so the
// customer can show them on a map.
async function getWorkWorker(customerId, workId) {
  const [workRows] = await pool.query('SELECT * FROM works WHERE id = ?', [
    workId,
  ]);
  const work = workRows[0];

  if (!work) throw new AppError('Work not found', 404);
  if (work.customer_id !== customerId) {
    throw new AppError('You do not have access to this work', 403);
  }
  if (!work.accepted_worker_id) {
    throw new AppError('No worker has accepted this work yet', 404);
  }

  const [rows] = await pool.query(
    `SELECT u.name, u.mobile_number, wk.current_lat, wk.current_lng, wk.rating
     FROM workers wk
     JOIN users u ON u.id = wk.user_id
     WHERE wk.id = ?`,
    [work.accepted_worker_id]
  );

  return rows[0];
}

module.exports = { createWork, getMyWorks, getWorkById, getWorkWorker };
