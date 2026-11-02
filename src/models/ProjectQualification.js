const mongoose = require('mongoose');

const projectQualificationSchema = new mongoose.Schema({
  projectId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Project', 
    required: true 
  },
  questionType: { 
    type: String, 
    required: true 
  },
  questionName: { type: String },
  fieldType: { type: String, default: 'Range' }, // 'Range' or 'Dropdown'
  
  // Multi-row ranges (e.g. for Age)
  ranges: [{
    start: { type: mongoose.Schema.Types.Mixed },
    end: { type: mongoose.Schema.Types.Mixed },
    valid: { type: Number, default: 1 },
    isActive: { type: Boolean, default: true },
    optionText: { type: String, default: '-' }
  }],

  // Single range backward-compatibility
  rangeStart: { type: mongoose.Schema.Types.Mixed },
  rangeEnd: { type: mongoose.Schema.Types.Mixed },
  
  // Options for Dropdowns (e.g. Gender)
  options: [{ type: String }],
  optionItems: [{
    optionText: { type: String },
    start: { type: String, default: '-' },
    end: { type: String, default: '-' },
    valid: { type: Number, default: 1 },
    isActive: { type: Boolean, default: true }
  }],
  
  customQuestionName: { type: String },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('ProjectQualification', projectQualificationSchema);
