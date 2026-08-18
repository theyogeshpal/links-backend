const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const surveySessionSchema = new mongoose.Schema({
  sessionId: { type: String, default: uuidv4, unique: true },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  panellistId: { type: String, required: true },
  passthru: { type: String }, // Optional dynamic passthru ID
  statusCode: { type: Number, default: 9 }, // 6 (Complete), 7 (Disqualified), 8 (Quota Full), 9 (Redirected/Pending), 10+ (Security/Fraud)
  ipAddress: { type: String },
  userAgent: { type: String },
  referralHeader: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('SurveySession', surveySessionSchema);
