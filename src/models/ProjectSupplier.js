const mongoose = require('mongoose');

const projectSupplierSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  
  // Link configuration
  successUrl: { type: String, required: true },
  disqualifiedUrl: { type: String, required: true },
  quotaFullUrl: { type: String, required: true },
  securityTerminateUrl: { type: String, required: true },

  // Tracking metrics
  supplierCode: { type: String },
  allocatedHits: { type: Number, default: 1500 },
  allocatedCompletes: { type: Number, default: 150 },
  hits: { type: Number, default: 0 },
  completed: { type: Number, default: 0 },
  disqualified: { type: Number, default: 0 },
  quotaFull: { type: Number, default: 0 },
  securityTerminate: { type: Number, default: 0 },
  
  // Cost tracking
  cpc: { type: Number, default: 0 },
  status: { type: String, default: 'Testing' }
}, { timestamps: true });

// Ensure a company can only be added to a project once
projectSupplierSchema.index({ projectId: 1, companyId: 1 }, { unique: true });

module.exports = mongoose.model('ProjectSupplier', projectSupplierSchema);
