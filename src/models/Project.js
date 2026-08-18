const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  // 1. Setup Requirements
  name: { type: String, required: true },
  parentProjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
  studyTypeId: { type: mongoose.Schema.Types.ObjectId, ref: 'StudyType' },
  country: { type: String },
  language: { type: String },
  surveyLink: { type: String, required: true },
  surveyTestLink: { type: String },
  cpc: { type: Number, required: true, default: 0 },
  invoiceCurrency: { type: String, default: 'US Dollar' },
  conversionRate: { type: Number, default: 1 },

  // 2. Expected Metrics & Data
  reqCompletes: { type: Number, required: true, default: 1 },
  maxCompletes: { type: String },
  loi: { type: String, default: '10' }, 
  ir: { type: Number, required: true, default: 100 },
  pointsToAward: { type: Number, default: 0 },
  supportedDevices: { type: [String], default: ['Desktop', 'Mobile', 'Tablet'] },

  // 3. People
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
  clientContactId: { type: mongoose.Schema.Types.ObjectId, ref: 'Contact' },
  projectManager: { type: String }, // Can be tied to a User model later
  salesPerson: { type: String }, // Can be tied to a User model later

  // 4. Timeline
  startDate: { type: Date },
  endDate: { type: Date },

  // 5. Memorandum
  notes: { type: String },
  projectBrief: { type: String },

  // 6. Status
  status: { type: String, enum: ['Select Status', 'Running', 'On Hold', 'Closed', 'Archived'], default: 'Running' },

  // Internal Analytics tracking
  completedCount: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('Project', projectSchema);
