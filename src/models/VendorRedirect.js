const mongoose = require('mongoose');

const vendorRedirectSchema = new mongoose.Schema({
  vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, unique: true },
  completeUrl: { type: String, required: true },
  terminateUrl: { type: String, required: true },
  quotaFullUrl: { type: String, required: true },
  securityTermUrl: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model('VendorRedirect', vendorRedirectSchema);
