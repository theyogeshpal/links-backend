const Company = require('../models/Company');
const Project = require('../models/Project');
const VendorRedirect = require('../models/VendorRedirect');
const SurveySession = require('../models/SurveySession');
const StudyType = require('../models/StudyType');
const ContactType = require('../models/ContactType');
const Contact = require('../models/Contact');
const ProjectSupplier = require('../models/ProjectSupplier');
const ProjectQualification = require('../models/ProjectQualification');

// Dashboard Stats
exports.getDashboardStats = async (req, res, next) => {
  try {
    const totalProjects = await Project.countDocuments();
    const activeProjects = await Project.countDocuments({ status: 'Running' });
    
    // Aggregate session stats
    const sessionStats = await SurveySession.aggregate([
      {
        $group: {
          _id: '$statusCode',
          count: { $sum: 1 }
        }
      }
    ]);

    const stats = {
      totalProjects,
      activeProjects,
      completes: 0,
      terminates: 0,
      quotaFulls: 0,
      securityBlocks: 0,
      pending: 0
    };

    sessionStats.forEach(stat => {
      switch (stat._id) {
        case 6: stats.completes = stat.count; break;
        case 7: stats.terminates = stat.count; break;
        case 8: stats.quotaFulls = stat.count; break;
        case 9: stats.pending = stat.count; break;
        default: stats.securityBlocks += stat.count; break; // 10+
      }
    });

    res.json(stats);
  } catch (error) {
    next(error);
  }
};

// Companies CRUD
exports.getCompanies = async (req, res, next) => {
  try {
    const companies = await Company.find().sort({ createdAt: -1 });
    res.json(companies);
  } catch (error) { next(error); }
};

exports.createCompany = async (req, res, next) => {
  try {
    const company = new Company(req.body);
    await company.save();
    res.status(201).json(company);
  } catch (error) { next(error); }
};

exports.getVendorRedirects = async (req, res, next) => {
    try {
        const redirects = await VendorRedirect.find().populate('vendorId');
        res.json(redirects);
    } catch(error) { next(error); }
};

exports.createVendorRedirect = async (req, res, next) => {
    try {
        const redirect = new VendorRedirect(req.body);
        await redirect.save();
        res.status(201).json(redirect);
    } catch(error) { next(error); }
};

// Projects CRUD
exports.getProjects = async (req, res, next) => {
  try {
    const projects = await Project.find().populate('clientId', 'name').sort({ createdAt: -1 });
    res.json(projects);
  } catch (error) { next(error); }
};

exports.createProject = async (req, res, next) => {
  try {
    const project = new Project(req.body);
    await project.save();
    res.status(201).json(project);
  } catch (error) { next(error); }
};

exports.getProjectById = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found' });
    res.json(project);
  } catch (error) { next(error); }
};

exports.updateProject = async (req, res, next) => {
  try {
    const project = await Project.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!project) return res.status(404).json({ message: 'Project not found' });
    res.json(project);
  } catch (error) { next(error); }
};

exports.getProjectStats = async (req, res, next) => {
  try {
    const projectId = req.params.id;
    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    // Aggregate session stats for this project
    const sessionStats = await SurveySession.aggregate([
      { $match: { projectId: new (require('mongoose').Types.ObjectId)(projectId) } },
      { $group: { _id: '$statusCode', count: { $sum: 1 } } }
    ]);

    const stats = {
      totalHits: 0,
      redirects: 0,
      blocked: 0,
      completed: 0,
      disqualified: 0,
      quotaFull: 0,
      securityTerminate: 0,
      epc: 0,
      cr: 0,
      ir: 0,
      avgLoi: 0,
      medianLoi: 0,
      abandons: 0,
      lastCompleted: '-'
    };

    sessionStats.forEach(stat => {
      stats.totalHits += stat.count;
      switch (stat._id) {
        case 6: stats.completed = stat.count; break;
        case 7: stats.disqualified = stat.count; break;
        case 8: stats.quotaFull = stat.count; break;
        case 9: stats.redirects = stat.count; break;
        case 10: stats.securityTerminate = stat.count; break;
        default: stats.blocked += stat.count; break; // 10+
      }
    });

    if (stats.totalHits > 0) {
      stats.cr = Math.round((stats.completed / stats.totalHits) * 100);
      stats.ir = Math.round((stats.completed / (stats.completed + stats.disqualified || 1)) * 100);
      stats.epc = ((stats.completed * project.cpc) / stats.totalHits).toFixed(2);
      stats.abandons = Math.round((stats.redirects / stats.totalHits) * 100);
    }

    res.json(stats);
  } catch (error) { next(error); }
};

// Project Suppliers CRUD
exports.getProjectSuppliers = async (req, res, next) => {
  try {
    const suppliers = await ProjectSupplier.find({ projectId: req.params.id }).populate('companyId', 'name');
    res.json(suppliers);
  } catch (error) { next(error); }
};

exports.createProjectSupplier = async (req, res, next) => {
  try {
    const payload = { ...req.body, projectId: req.params.id };
    const supplier = new ProjectSupplier(payload);
    await supplier.save();
    res.status(201).json(supplier);
  } catch (error) { next(error); }
};

// Project Qualifications CRUD
exports.getProjectQualifications = async (req, res, next) => {
  try {
    const rules = await ProjectQualification.find({ projectId: req.params.id }).sort({ createdAt: -1 });
    res.json(rules);
  } catch (error) { next(error); }
};

exports.createProjectQualification = async (req, res, next) => {
  try {
    const payload = { ...req.body, projectId: req.params.id };
    const rule = new ProjectQualification(payload);
    await rule.save();
    res.status(201).json(rule);
  } catch (error) { next(error); }
};

exports.deleteProjectQualification = async (req, res, next) => {
  try {
    await ProjectQualification.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) { next(error); }
};

// Sessions Analytics
exports.getSessions = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const skip = parseInt(req.query.skip) || 0;
    const sessions = await SurveySession.find()
      .populate('projectId', 'name')
      .populate('vendorId', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await SurveySession.countDocuments();
    res.json({ data: sessions, total });
  } catch (error) { next(error); }
};
// Configurations CRUD
exports.getStudyTypes = async (req, res, next) => {
  try { res.json(await StudyType.find().sort({ order: 1, createdAt: -1 })); } catch (e) { next(e); }
};
exports.createStudyType = async (req, res, next) => {
  try { res.status(201).json(await new StudyType(req.body).save()); } catch (e) { next(e); }
};
exports.updateStudyType = async (req, res, next) => {
  try { res.json(await StudyType.findByIdAndUpdate(req.params.id, req.body, { new: true })); } catch (e) { next(e); }
};
exports.deleteStudyType = async (req, res, next) => {
  try { await StudyType.findByIdAndDelete(req.params.id); res.json({ success: true }); } catch (e) { next(e); }
};

exports.getContactTypes = async (req, res, next) => {
  try { res.json(await ContactType.find().sort({ order: 1, createdAt: -1 })); } catch (e) { next(e); }
};
exports.createContactType = async (req, res, next) => {
  try { res.status(201).json(await new ContactType(req.body).save()); } catch (e) { next(e); }
};
exports.updateContactType = async (req, res, next) => {
  try { res.json(await ContactType.findByIdAndUpdate(req.params.id, req.body, { new: true })); } catch (e) { next(e); }
};
exports.deleteContactType = async (req, res, next) => {
  try { await ContactType.findByIdAndDelete(req.params.id); res.json({ success: true }); } catch (e) { next(e); }
};

// Contacts CRUD
exports.getContacts = async (req, res, next) => {
  try { 
    res.json(await Contact.find().populate('contactTypeId').populate('companyId').sort({ createdAt: -1 })); 
  } catch (e) { next(e); }
};
exports.createContact = async (req, res, next) => {
  try { res.status(201).json(await new Contact(req.body).save()); } catch (e) { next(e); }
};
exports.updateContact = async (req, res, next) => {
  try { res.json(await Contact.findByIdAndUpdate(req.params.id, req.body, { new: true })); } catch (e) { next(e); }
};
exports.deleteContact = async (req, res, next) => {
  try { await Contact.findByIdAndDelete(req.params.id); res.json({ success: true }); } catch (e) { next(e); }
};
