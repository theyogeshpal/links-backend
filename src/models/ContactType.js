const mongoose = require('mongoose');

const contactTypeSchema = new mongoose.Schema({
  name: { type: String, required: true },
  status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
  order: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('ContactType', contactTypeSchema);
