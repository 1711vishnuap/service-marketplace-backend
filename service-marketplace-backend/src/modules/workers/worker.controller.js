// src/modules/workers/worker.controller.js

const asyncHandler = require('../../utils/asyncHandler');
const { success } = require('../../utils/response');
const workerService = require('./worker.service');

// POST /api/workers/profile
const createProfile = asyncHandler(async (req, res) => {
  const worker = await workerService.upsertProfile(req.user.id);
  success(res, worker, 'Worker profile ready');
});

// POST /api/workers/categories
const setCategories = asyncHandler(async (req, res) => {
  const { category_ids } = req.body;
  const categories = await workerService.setCategories(req.user.id, category_ids);
  success(res, categories, 'Categories updated');
});

// POST /api/workers/location
const updateLocation = asyncHandler(async (req, res) => {
  const { lat, lng } = req.body;
  const result = await workerService.updateLocation(req.user.id, lat, lng);
  success(res, result, 'Location updated');
});

// GET /api/workers/available-works
const getAvailableWorks = asyncHandler(async (req, res) => {
  const works = await workerService.getAvailableWorks(req.user.id);
  success(res, works, 'Available works fetched');
});

// POST /api/works/:id/accept
const acceptWork = asyncHandler(async (req, res) => {
  const work = await workerService.acceptWork(req.user.id, req.params.id);
  success(res, work, 'Work accepted');
});

// POST /api/works/:id/verify-otp
const verifyWorkOtp = asyncHandler(async (req, res) => {
  const { otp } = req.body;
  const work = await workerService.verifyWorkOtp(req.user.id, req.params.id, otp);
  success(res, work, 'OTP verified, work started');
});

// POST /api/works/:id/complete
const completeWork = asyncHandler(async (req, res) => {
  const work = await workerService.completeWork(req.user.id, req.params.id);
  success(res, work, 'Work marked as completed');
});

module.exports = {
  createProfile,
  setCategories,
  updateLocation,
  getAvailableWorks,
  acceptWork,
  verifyWorkOtp,
  completeWork,
};
