const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

const surveyRoutes = require('./routes/surveyRoutes');
const adminRoutes = require('./routes/adminRoutes');
const routerRoutes = require('./routes/routerRoutes');
const supplierRoutes = require('./routes/supplierRoutes');
const authRoutes = require('./routes/authRoutes');
const authMiddleware = require('./middleware/authMiddleware');

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000 // limit each IP to 1000 requests per windowMs
});

// Apply to all requests
app.use(limiter);

// Health check route
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date(), message: 'Backend is running' });
});

// API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/survey', surveyRoutes);
app.use('/api/v1/admin', authMiddleware, adminRoutes);
app.use('/api/v1/router', routerRoutes);
app.use('/api/v1/supplier', supplierRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: 'Internal Server Error', error: err.message });
});

module.exports = app;
