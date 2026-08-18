// src/routes/index.js
// Central place where all module routers are mounted.

const express = require('express');
const router = express.Router();

const authRoutes = require('../modules/auth/auth.routes');
const workRoutes = require('../modules/works/work.routes');
const workerRoutes = require('../modules/workers/worker.routes');

router.use('/auth', authRoutes);
router.use('/works', workRoutes);
router.use('/workers', workerRoutes);

module.exports = router;
