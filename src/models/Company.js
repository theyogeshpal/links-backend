const mongoose = require('mongoose');

const companySchema = new mongoose.Schema({
  companyType: { type: String },
  name: { type: String, required: true },
  abrvName: { type: String },
  contactNumber: { type: String },
  email: { type: String },
  invoiceEmail: { type: String },
  taxId: { type: String },
  address: { type: String },
  invoicingMethod: { type: String },
  paymentTerms: { type: String },
  city: { type: String },
  zipCode: { type: String },
  country: { type: String },
  state: { type: String },
  status: { type: String, enum: ['Active', 'Inactive', 'Disabled'], default: 'Active' },
  checkProxy: { type: String },
  isDiy: { type: String },
  completeLink: { type: String },
  disqualifyLink: { type: String },
  quotafullLink: { type: String },
  securityTermLink: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Company', companySchema);
