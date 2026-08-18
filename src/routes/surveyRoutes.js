const express = require('express');
const router = express.Router();
const surveyController = require('../controllers/surveyController');

// GET /api/v1/survey/entry
router.get('/entry', surveyController.entry);

// GET /api/v1/survey/process
router.get('/process', surveyController.process);

module.exports = router;
