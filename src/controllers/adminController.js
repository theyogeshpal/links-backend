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
    const { timeframe } = req.query; // '1 Day', '1 Week', '1 Month', '3 Months', 'All'
    const now = new Date();
    let dateFilter = {};
    
    if (timeframe === '1 Day' || timeframe === '1day') {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      dateFilter = { createdAt: { $gte: startOfDay } };
    } else if (timeframe === '1 Week' || timeframe === '1week') {
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      dateFilter = { createdAt: { $gte: oneWeekAgo } };
    } else if (timeframe === '1 Month' || timeframe === '1month') {
      const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      dateFilter = { createdAt: { $gte: oneMonthAgo } };
    } else if (timeframe === '3 Months' || timeframe === '3months') {
      const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
      dateFilter = { createdAt: { $gte: threeMonthsAgo } };
    }

    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // 1. Today's Performance Stats
    const todaySessions = await SurveySession.aggregate([
      { $match: { createdAt: { $gte: startOfToday } } },
      { $group: { _id: '$statusCode', count: { $sum: 1 } } }
    ]);

    const todayStats = {
      completed: 0,
      disqualified: 0,
      quotaFull: 0,
      securityTerm: 0,
      blocked: 0,
      redirected: 0
    };

    todaySessions.forEach(s => {
      if (s._id === 6) todayStats.completed = s.count;
      else if (s._id === 7) todayStats.disqualified = s.count;
      else if (s._id === 8) todayStats.quotaFull = s.count;
      else if (s._id === 9) todayStats.redirected = s.count;
      else if (s._id === 10) todayStats.securityTerm = s.count;
      else if (s._id >= 11) todayStats.blocked += s.count;
    });

    // Fallback: If no today activity, compute all-time session stats so dashboard always reflects real data
    const allSessions = await SurveySession.aggregate([
      { $group: { _id: '$statusCode', count: { $sum: 1 } } }
    ]);
    const allStats = {
      completed: 0,
      disqualified: 0,
      quotaFull: 0,
      securityTerm: 0,
      blocked: 0,
      redirected: 0
    };
    allSessions.forEach(s => {
      if (s._id === 6) allStats.completed = s.count;
      else if (s._id === 7) allStats.disqualified = s.count;
      else if (s._id === 8) allStats.quotaFull = s.count;
      else if (s._id === 9) allStats.redirected = s.count;
      else if (s._id === 10) allStats.securityTerm = s.count;
      else if (s._id >= 11) allStats.blocked += s.count;
    });

    // 2. Project Status Matrix
    const [runningProjects, onHoldProjects, awaitingIdsProjects, completedProjects, archivedProjects, totalProjects] = await Promise.all([
      Project.countDocuments({ status: 'Running' }),
      Project.countDocuments({ status: 'On Hold' }),
      Project.countDocuments({ status: { $in: ['Awaiting IDs', 'Testing', 'Select Status'] } }),
      Project.countDocuments({ status: { $in: ['Completed', 'Closed'] } }),
      Project.countDocuments({ status: 'Archived' }),
      Project.countDocuments()
    ]);

    const projectMatrix = {
      running: runningProjects,
      onHold: onHoldProjects,
      awaitingIds: awaitingIdsProjects,
      completed: completedProjects,
      archived: archivedProjects,
      total: totalProjects
    };

    // 3. Monthly Conversion Ratios
    const monthSessions = await SurveySession.aggregate([
      { $match: { createdAt: { $gte: startOfMonth } } },
      { $group: { _id: '$statusCode', count: { $sum: 1 } } }
    ]);
    let monthTotal = 0;
    const monthCounts = { 6: 0, 7: 0, 8: 0, security: 0 };
    monthSessions.forEach(s => {
      monthTotal += s.count;
      if (s._id === 6) monthCounts[6] = s.count;
      else if (s._id === 7) monthCounts[7] = s.count;
      else if (s._id === 8) monthCounts[8] = s.count;
      else if (s._id >= 10) monthCounts.security += s.count;
    });

    // If no sessions this month, fallback to total across DB
    const totalSampleCount = monthTotal > 0 ? monthTotal : (allStats.completed + allStats.disqualified + allStats.quotaFull + allStats.securityTerm + allStats.blocked + allStats.redirected);
    const activeCounts = monthTotal > 0 ? monthCounts : {
      6: allStats.completed,
      7: allStats.disqualified,
      8: allStats.quotaFull,
      security: allStats.securityTerm + allStats.blocked
    };

    const conversionRatios = {
      sampleSize: totalSampleCount,
      completed: {
        count: activeCounts[6],
        percentage: totalSampleCount > 0 ? `${((activeCounts[6] / totalSampleCount) * 100).toFixed(2)}%` : '0%'
      },
      disqualified: {
        count: activeCounts[7],
        percentage: totalSampleCount > 0 ? `${((activeCounts[7] / totalSampleCount) * 100).toFixed(2)}%` : '0%'
      },
      quotaFull: {
        count: activeCounts[8],
        percentage: totalSampleCount > 0 ? `${((activeCounts[8] / totalSampleCount) * 100).toFixed(2)}%` : '0%'
      },
      securityTerminated: {
        count: activeCounts.security,
        percentage: totalSampleCount > 0 ? `${((activeCounts.security / totalSampleCount) * 100).toFixed(2)}%` : '0%'
      }
    };

    // 4. Top Clients by Completes
    const clientCompletes = await Project.aggregate([
      { $match: { clientId: { $exists: true, $ne: null } } },
      {
        $group: {
          _id: '$clientId',
          value: { $sum: '$completedCount' }
        }
      },
      { $sort: { value: -1 } },
      { $limit: 6 },
      {
        $lookup: {
          from: 'companies',
          localField: '_id',
          foreignField: '_id',
          as: 'company'
        }
      },
      { $unwind: { path: '$company', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          name: { $ifNull: ['$company.name', 'Unnamed Client'] },
          value: { $ifNull: ['$value', 0] }
        }
      }
    ]);

    // 5. Client Traffic Distribution
    const clientTraffic = await SurveySession.aggregate([
      { $match: dateFilter },
      {
        $lookup: {
          from: 'projects',
          localField: 'projectId',
          foreignField: '_id',
          as: 'project'
        }
      },
      { $unwind: { path: '$project', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'companies',
          localField: 'project.clientId',
          foreignField: '_id',
          as: 'client'
        }
      },
      { $unwind: { path: '$client', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: { $ifNull: ['$client.name', 'Global Projects'] },
          Redirected: { $sum: 1 },
          Completed: { $sum: { $cond: [{ $eq: ['$statusCode', 6] }, 1, 0] } },
          Rejected: { $sum: { $cond: [{ $in: ['$statusCode', [7, 10, 11, 14, 31, 32]] }, 1, 0] } },
          Quotafull: { $sum: { $cond: [{ $eq: ['$statusCode', 8] }, 1, 0] } }
        }
      },
      { $sort: { Redirected: -1 } },
      { $limit: 5 },
      {
        $project: {
          name: '$_id',
          Redirected: 1,
          Completed: 1,
          Rejected: 1,
          Quotafull: 1
        }
      }
    ]);

    // 6. Supplier Completes Share
    const supplierShare = await ProjectSupplier.aggregate([
      {
        $group: {
          _id: '$companyId',
          value: { $sum: '$completed' }
        }
      },
      { $sort: { value: -1 } },
      { $limit: 6 },
      {
        $lookup: {
          from: 'companies',
          localField: '_id',
          foreignField: '_id',
          as: 'company'
        }
      },
      { $unwind: { path: '$company', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          name: { $ifNull: ['$company.name', 'Internal Supplier'] },
          value: { $ifNull: ['$value', 0] }
        }
      }
    ]);

    // 7. Project Manager Volume
    const pmVolume = await Project.aggregate([
      {
        $group: {
          _id: { $ifNull: ['$projectManager', 'Admin TTP'] },
          completes: { $sum: '$completedCount' },
          projects: { $sum: 1 }
        }
      },
      { $sort: { completes: -1, projects: -1 } },
      { $limit: 5 },
      {
        $project: {
          name: { $cond: [{ $and: [{ $ne: ['$_id', ''] }, { $ne: ['$_id', null] }] }, '$_id', 'Admin TTP'] },
          value: { $cond: [{ $gt: ['$completes', 0] }, '$completes', '$projects'] }
        }
      }
    ]);

    res.json({
      success: true,
      today: todayStats,
      allTime: allStats,
      projectMatrix,
      conversionRatios,
      clientCompletes: clientCompletes.length > 0 ? clientCompletes : [
        { name: 'No Active Clients', value: 0 }
      ],
      clientTraffic: clientTraffic.length > 0 ? clientTraffic : [
        { name: 'General Traffic', Redirected: 0, Completed: 0, Rejected: 0, Quotafull: 0 }
      ],
      supplierShare: supplierShare.length > 0 ? supplierShare : [
        { name: 'Internal Supplier', value: 0 }
      ],
      pmVolume: pmVolume.length > 0 ? pmVolume : [
        { name: 'Admin TTP', value: 1 }
      ]
    });

  } catch (error) {
    next(error);
  }
};

// Companies CRUD
exports.getCompanies = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.type) {
      const typeQuery = req.query.type.toLowerCase();
      if (typeQuery === 'client') {
        filter.companyType = { $in: ['Client', 'Both', /^client$/i, /^both/i] };
      } else if (typeQuery === 'vendor') {
        filter.companyType = { $in: ['Vendor', 'Both', /^vendor$/i, /^both/i] };
      } else {
        filter.companyType = new RegExp(`^${req.query.type}$`, 'i');
      }
    }
    const companies = await Company.find(filter).sort({ createdAt: -1 });
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

exports.updateCompany = async (req, res, next) => {
  try {
    const company = await Company.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(company);
  } catch (error) { next(error); }
};

exports.deleteCompany = async (req, res, next) => {
  try {
    await Company.findByIdAndDelete(req.params.id);
    res.json({ success: true });
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
    const payload = { ...req.body };
    ['studyTypeId', 'clientId', 'clientContactId', 'parentProjectId', 'startDate', 'endDate'].forEach(field => {
      if (payload[field] === '') payload[field] = null;
    });
    const project = new Project(payload);
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
    const payload = { ...req.body };
    ['studyTypeId', 'clientId', 'clientContactId', 'parentProjectId', 'startDate', 'endDate'].forEach(field => {
      if (payload[field] === '') payload[field] = null;
    });
    const project = await Project.findByIdAndUpdate(req.params.id, payload, { new: true });
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

exports.getProjectSessions = async (req, res, next) => {
  try {
    const sessions = await SurveySession.find({ projectId: req.params.id })
      .populate('vendorId', 'name')
      .sort({ createdAt: -1 });
    res.json(sessions);
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
    if (!payload.supplierCode) {
      payload.supplierCode = String(Math.floor(10000 + Math.random() * 90000));
    }
    const supplier = new ProjectSupplier(payload);
    await supplier.save();
    res.status(201).json(supplier);
  } catch (error) { next(error); }
};

exports.updateProjectSupplier = async (req, res, next) => {
  try {
    const supplier = await ProjectSupplier.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(supplier);
  } catch (error) { next(error); }
};

exports.deleteProjectSupplier = async (req, res, next) => {
  try {
    await ProjectSupplier.findByIdAndDelete(req.params.id);
    res.json({ success: true });
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

exports.updateProjectQualification = async (req, res, next) => {
  try {
    const rule = await ProjectQualification.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(rule);
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
  try {
    const payload = { ...req.body };
    if (!payload.contactTypeId) payload.contactTypeId = null;
    if (!payload.companyId) payload.companyId = null;
    if (!payload.dateOfBirth) payload.dateOfBirth = null;
    res.status(201).json(await new Contact(payload).save());
  } catch (e) { next(e); }
};
exports.updateContact = async (req, res, next) => {
  try {
    const payload = { ...req.body };
    if (!payload.contactTypeId) payload.contactTypeId = null;
    if (!payload.companyId) payload.companyId = null;
    if (!payload.dateOfBirth) payload.dateOfBirth = null;
    res.json(await Contact.findByIdAndUpdate(req.params.id, payload, { new: true }));
  } catch (e) { next(e); }
};
exports.deleteContact = async (req, res, next) => {
  try { await Contact.findByIdAndDelete(req.params.id); res.json({ success: true }); } catch (e) { next(e); }
};
exports.getProjectQuotas = async (req, res, next) => {
  try {
    const ProjectQuota = require('../models/ProjectQuota');
    const quotas = await ProjectQuota.find({ projectId: req.params.id }).populate('qualificationId');
    res.json(quotas);
  } catch (e) { next(e); }
};
exports.createProjectQuota = async (req, res, next) => {
  try {
    const ProjectQuota = require('../models/ProjectQuota');
    let body = { ...req.body, projectId: req.params.id }; if(!body.qualificationId) delete body.qualificationId; const quota = new ProjectQuota(body);
    await quota.save();
    res.status(201).json(quota);
  } catch (e) { next(e); }
};
exports.deleteProjectQuota = async (req, res, next) => {
  try {
    const ProjectQuota = require('../models/ProjectQuota');
    await ProjectQuota.findByIdAndDelete(req.params.quotaId);
    res.json({ success: true });
  } catch (e) { next(e); }
};
exports.getClientCodes = async (req, res, next) => {
  try {
    const ClientCode = require('../models/ClientCode');
    const codes = await ClientCode.find({ projectId: req.params.id });
    res.json(codes);
  } catch (e) { next(e); }
};
exports.importClientCodes = async (req, res, next) => {
  try {
    const ClientCode = require('../models/ClientCode');
    const { codes } = req.body; // Array of string codes
    if (!codes || !Array.isArray(codes)) return res.status(400).json({ message: 'Invalid codes array' });
    
    const docs = codes.map(c => ({
      projectId: req.params.id,
      clientCode: c,
      isUsed: false
    }));
    await ClientCode.insertMany(docs);
    res.json({ success: true, count: docs.length });
  } catch (e) { next(e); }
};

exports.clearUnusedClientCodes = async (req, res, next) => {
  try {
    const ClientCode = require('../models/ClientCode');
    const result = await ClientCode.deleteMany({ projectId: req.params.id, isUsed: false });
    res.json({ success: true, deletedCount: result.deletedCount });
  } catch (e) { next(e); }
};

exports.reconcileProject = async (req, res, next) => {
  try {
    const projectId = req.params.id;
    const { items } = req.body; // Array of { ttpid, status_id }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'No reconciliation items provided' });
    }

    let approved = 0;
    let rejected = 0;
    let updated = 0;

    for (const item of items) {
      const trackingId = (item.ttpid || item.TTPID || item.id || '').trim();
      const rawStatus = (item.status_id || item.status || item.Status_ID || '').toString().trim().toLowerCase();

      if (!trackingId) continue;

      const session = await SurveySession.findOne({
        projectId,
        $or: [{ sessionId: trackingId }, { _id: trackingId.length === 24 ? trackingId : null }]
      });

      if (!session) continue;

      // Status mapping: 1 / 6 / complete / approved = Complete
      let newStatusCode = session.statusCode;
      if (rawStatus === '1' || rawStatus === '6' || rawStatus === 'complete' || rawStatus === 'approved') {
        newStatusCode = 6;
        approved++;
      } else if (rawStatus === '2' || rawStatus === '7' || rawStatus === 'terminate' || rawStatus === 'disqualified' || rawStatus === 'rejected') {
        newStatusCode = 7;
        rejected++;
      } else if (rawStatus === '3' || rawStatus === '8' || rawStatus === 'quotafull') {
        newStatusCode = 8;
        rejected++;
      } else if (rawStatus === '4' || rawStatus === '10' || rawStatus === 'security') {
        newStatusCode = 10;
        rejected++;
      }

      if (session.statusCode !== newStatusCode) {
        session.statusCode = newStatusCode;
        await session.save();
        updated++;
      }
    }

    // Recalculate Project Completed Count
    const totalApproved = await SurveySession.countDocuments({ projectId, statusCode: 6 });
    await Project.findByIdAndUpdate(projectId, { completedCount: totalApproved });

    // Recalculate each Supplier's completed count
    const suppliers = await ProjectSupplier.find({ projectId });
    for (const supp of suppliers) {
      const suppCompletes = await SurveySession.countDocuments({ projectId, vendorId: supp.companyId, statusCode: 6 });
      const suppDisqualified = await SurveySession.countDocuments({ projectId, vendorId: supp.companyId, statusCode: 7 });
      const suppQuotaFull = await SurveySession.countDocuments({ projectId, vendorId: supp.companyId, statusCode: 8 });
      const suppSec = await SurveySession.countDocuments({ projectId, vendorId: supp.companyId, statusCode: { $gte: 10 } });
      
      supp.completed = suppCompletes;
      supp.disqualified = suppDisqualified;
      supp.quotaFull = suppQuotaFull;
      supp.securityTerminate = suppSec;
      await supp.save();
    }

    res.json({
      success: true,
      totalProcessed: items.length,
      approved,
      rejected,
      updatedSessions: updated,
      message: `Reconciliation completed successfully: ${approved} approved, ${rejected} rejected.`
    });
  } catch (e) {
    next(e);
  }
};

