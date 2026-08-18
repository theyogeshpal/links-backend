const ProjectQualification = require('../models/ProjectQualification');
const Project = require('../models/Project');

exports.getProjectQualificationsForSupplier = async (req, res, next) => {
  try {
    const projectId = req.params.projectId;
    
    // Ensure project exists and is active
    const project = await Project.findById(projectId);
    if (!project || project.status !== 'Running') {
      return res.status(404).json({ success: false, message: 'Project not found or not active.' });
    }

    // Fetch active qualifications
    const rules = await ProjectQualification.find({ projectId, isActive: true });
    
    // Format them for the supplier API (Vendor-friendly format)
    const formattedRules = rules.map(rule => {
      let condition = {};
      if (rule.questionType === 'Age') {
        condition = { min: rule.rangeStart, max: rule.rangeEnd };
      } else if (rule.questionType === 'Gender') {
        condition = { allowed: rule.options };
      } else {
        condition = { allowed: rule.options, name: rule.customQuestionName };
      }
      
      return {
        type: rule.questionType,
        condition: condition
      };
    });

    res.json({
      success: true,
      projectId: projectId,
      projectName: project.name,
      qualifications: formattedRules
    });
  } catch (error) { next(error); }
};
