// src/modules/workers/worker.routes.js
// Mounted at /api/workers in src/routes/index.js

const express = require('express');
const router = express.Router();
const workerController = require('./worker.controller');
const { requireAuth, requireWorker } = require('../../middleware/authMiddleware');

router.use(requireAuth, requireWorker); // every route below requires a logged-in worker

router.post('/profile', workerController.createProfile);
router.post('/categories', workerController.setCategories);
router.post('/location', workerController.updateLocation);
router.get('/available-works', workerController.getAvailableWorks);

module.exports = router;
