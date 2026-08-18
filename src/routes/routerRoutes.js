const express = require('express');
const router = express.Router();
const routerController = require('../controllers/routerController');

// Entry Link for Suppliers
// e.g. GET /api/v1/router/entry/64a.../64b...?pid=12345
router.get('/entry/:projectId/:supplierId', routerController.handleEntry);

// End Pages for Foreign Clients
// e.g. GET /api/v1/router/end/success/64a...?ttpid=uuid-1234
router.get('/end/:status/:projectId', routerController.handleEnd);

module.exports = router;
