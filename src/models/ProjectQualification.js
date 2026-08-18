const mongoose = require('mongoose');

const projectQualificationSchema = new mongoose.Schema({
  projectId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Project', 
    required: true 
  },
  questionType: { 
    type: String, 
    enum: ['Age', 'Gender', 'Custom'], 
    required: true 
  },
  // Used for Range questions (like Age)
  rangeStart: { type: Number },
  rangeEnd: { type: Number },
  
  // Used for Dropdown questions (like Gender)
  options: [{ type: String }],
  
  customQuestionName: { type: String },

  isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('ProjectQualification', projectQualificationSchema);
