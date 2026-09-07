const mongoose = require('mongoose');
const projectQuotaSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  name: { type: String, required: true },
  quota: { type: Number, required: true },
  qualificationId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProjectQualification' },
  questionFieldType: { type: String }
}, { timestamps: true });
module.exports = mongoose.model('ProjectQuota', projectQuotaSchema);
