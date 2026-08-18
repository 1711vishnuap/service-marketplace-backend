// src/modules/works/work.controller.js
// Handles the CUSTOMER-side actions on the `works` resource.
// (Worker-side actions on works — accept/verify-otp/complete — live in
// worker.controller.js, but are routed here in work.routes.js since
// they're all under /api/works/:id/...)

const asyncHandler = require('../../utils/asyncHandler');
const { success } = require('../../utils/response');
const workService = require('./work.service');

// POST /api/works
const createWork = asyncHandler(async (req, res) => {
  const work = await workService.createWork(req.user.id, req.body);
  success(res, work, 'Work posted successfully', 201);
});

// GET /api/works/my
const getMyWorks = asyncHandler(async (req, res) => {
  const works = await workService.getMyWorks(req.user.id);
  success(res, works, 'Your works fetched');
});

// GET /api/works/:id
const getWorkById = asyncHandler(async (req, res) => {
  const work = await workService.getWorkById(req.user, req.params.id);
  success(res, work, 'Work details fetched');
});

// GET /api/works/:id/worker
const getWorkWorker = asyncHandler(async (req, res) => {
  const worker = await workService.getWorkWorker(req.user.id, req.params.id);
  success(res, worker, 'Assigned worker fetched');
});

module.exports = { createWork, getMyWorks, getWorkById, getWorkWorker };
