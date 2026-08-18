const express = require('express');
const router = express.Router();
const supplierController = require('../controllers/supplierController');

// Vendor API Endpoint to fetch qualifications for a project
router.get('/projects/:projectId/qualifications', supplierController.getProjectQualificationsForSupplier);

module.exports = router;
