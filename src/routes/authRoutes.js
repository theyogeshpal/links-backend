const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// @route   GET /api/v1/auth/seed
// @desc    Seed default admin user
// @access  Public
router.get('/seed', authController.seedAdmin);

// @route   POST /api/v1/auth/login
// @desc    Authenticate user & get token
// @access  Public
router.post('/login', authController.login);

module.exports = router;
