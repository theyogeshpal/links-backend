const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
  contactTypeId: { type: mongoose.Schema.Types.ObjectId, ref: 'ContactType' },
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
  salutation: String,
  firstName: { type: String, required: true },
  middleName: String,
  lastName: { type: String, required: true },
  gender: String,
  dateOfBirth: Date,
  email: { type: String, required: true },
  contactNo: String,
  address: String,
  city: String,
  zipCode: String,
  country: String,
  state: String,
  status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' }
}, { timestamps: true });

module.exports = mongoose.model('Contact', contactSchema);
