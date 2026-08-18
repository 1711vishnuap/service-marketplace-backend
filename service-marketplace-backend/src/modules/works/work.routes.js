// src/modules/works/work.routes.js
// Mounted at /api/works in src/routes/index.js
//
// This file intentionally combines CUSTOMER routes (create/view own
// works) and WORKER routes (accept/verify-otp/complete) because they
// all operate on the same `works` resource and URL prefix.

const express = require('express');
const router = express.Router();

const workController = require('./work.controller');
const workerController = require('../workers/worker.controller');
const {
  requireAuth,
  requireCustomer,
  requireWorker,
} = require('../../middleware/authMiddleware');

// Every route below requires SOME logged-in user; specific role checks
// are added per-route.
router.use(requireAuth);

// ----- CUSTOMER -----
router.post('/', requireCustomer, workController.createWork);
router.get('/my', requireCustomer, workController.getMyWorks);
router.get('/:id/worker', requireCustomer, workController.getWorkWorker);

// ----- SHARED (customer who owns it, or worker assigned to it) -----
router.get('/:id', workController.getWorkById);

// ----- WORKER -----
router.post('/:id/accept', requireWorker, workerController.acceptWork);
router.post('/:id/verify-otp', requireWorker, workerController.verifyWorkOtp);
router.post('/:id/complete', requireWorker, workerController.completeWork);

module.exports = router;
