const mongoose = require('mongoose');

const companySchema = new mongoose.Schema({
  name: { type: String, required: true },
  companyType: { type: String, enum: ['Client', 'Vendor'], required: true },
  status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
  country: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  contactPerson: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model('Company', companySchema);
