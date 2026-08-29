const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

// In a real scenario, protect these routes with JWT Auth middleware.
// For now, we will leave them unprotected so the frontend can connect easily.

// Dashboard
router.get('/dashboard', adminController.getDashboardStats);

// Companies
router.get('/companies', adminController.getCompanies);
router.post('/companies', adminController.createCompany);

// Vendor Redirects
router.get('/vendor-redirects', adminController.getVendorRedirects);
router.post('/vendor-redirects', adminController.createVendorRedirect);

router.get('/projects', adminController.getProjects);
router.post('/projects', adminController.createProject);
router.get('/projects/:id', adminController.getProjectById);
router.put('/projects/:id', adminController.updateProject);
router.get('/projects/:id/stats', adminController.getProjectStats);

// Project Suppliers
router.get('/projects/:id/suppliers', adminController.getProjectSuppliers);
router.post('/projects/:id/suppliers', adminController.createProjectSupplier);

// Project Qualifications
router.get('/projects/:id/qualifications', adminController.getProjectQualifications);
router.post('/projects/:id/qualifications', adminController.createProjectQualification);
router.delete('/qualifications/:id', adminController.deleteProjectQualification);

// Sessions
router.get('/sessions', adminController.getSessions);

// Configs
router.get('/study-types', adminController.getStudyTypes);
router.post('/study-types', adminController.createStudyType);
router.put('/study-types/:id', adminController.updateStudyType);
router.delete('/study-types/:id', adminController.deleteStudyType);

router.get('/contact-types', adminController.getContactTypes);
router.post('/contact-types', adminController.createContactType);
router.put('/contact-types/:id', adminController.updateContactType);
router.delete('/contact-types/:id', adminController.deleteContactType);

router.get('/contacts', adminController.getContacts);
router.post('/contacts', adminController.createContact);
router.put('/contacts/:id', adminController.updateContact);
router.delete('/contacts/:id', adminController.deleteContact);

module.exports = router;
