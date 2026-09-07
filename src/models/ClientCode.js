const mongoose = require('mongoose');
const clientCodeSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  ttpid: { type: String },
  vendorName: { type: String },
  started: { type: Date },
  completedOn: { type: Date },
  panelListId: { type: String },
  clientCode: { type: String, required: true },
  isUsed: { type: Boolean, default: false }
}, { timestamps: true });
module.exports = mongoose.model('ClientCode', clientCodeSchema);
