const Project = require('../models/Project');
const ProjectSupplier = require('../models/ProjectSupplier');
const SurveySession = require('../models/SurveySession');
const crypto = require('crypto');

exports.getProjectAuthTokens = (projectId) => {
  const salt = 'ttp_salt_2026';
  return {
    complete: crypto.createHash('md5').update(`1_${projectId}_${salt}`).digest('hex'),
    terminate: crypto.createHash('md5').update(`2_${projectId}_${salt}`).digest('hex'),
    quotafull: crypto.createHash('md5').update(`3_${projectId}_${salt}`).digest('hex'),
    security: crypto.createHash('md5').update(`4_${projectId}_${salt}`).digest('hex')
  };
};

exports.handleEntry = async (req, res, next) => {
  try {
    const { projectId, supplierId } = req.params;
    const { pid, passthru } = req.query; // 'pid' is the vendor's panellist ID

    if (!pid) {
      return res.status(400).send('Missing Panellist ID (pid)');
    }

    // 1. Verify Project & Supplier exist and are Active
    const project = await Project.findById(projectId);
    if (!project || project.status !== 'Running') {
      return res.status(404).send('Project not found or not active');
    }

    const supplierConfig = await ProjectSupplier.findOne({ projectId, companyId: supplierId });
    if (!supplierConfig || supplierConfig.status !== 'Running') {
      return res.status(404).send('Supplier config not found or not active');
    }

    // 2. Create the Survey Session
    const session = new SurveySession({
      projectId,
      vendorId: supplierId,
      panellistId: pid,
      passthru,
      statusCode: 9, // Pending/Redirected
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    await session.save();

    // 3. Update Supplier Hit Count
    supplierConfig.hits += 1;
    await supplierConfig.save();

    // 4. Construct the Foreign Client Survey Link
    let redirectUrl = project.surveyLink;
    
    if (redirectUrl.includes('[TTPID]')) {
      redirectUrl = redirectUrl.replace(/\[TTPID\]/g, session.sessionId);
    } else {
      const separator = redirectUrl.includes('?') ? '&' : '?';
      redirectUrl = `${redirectUrl}${separator}ttpid=${session.sessionId}`;
    }

    // 5. Redirect the respondent
    res.redirect(redirectUrl);

  } catch (error) {
    next(error);
  }
};

exports.handleEnd = async (req, res, next) => {
  try {
    const { status, projectId } = req.params;
    const { ttpid } = req.query; // Our session ID passed back by the foreign client

    if (!ttpid) {
      return res.status(400).send('Missing tracking ID (ttpid)');
    }

    // 1. Find the Session
    const session = await SurveySession.findOne({ sessionId: ttpid, projectId });
    if (!session) {
      return res.status(404).send('Invalid tracking session');
    }

    // 2. Prevent Duplicate Completions (only process if it was pending/9)
    if (session.statusCode !== 9) {
      return res.status(400).send('Session already processed');
    }

    // 3. Find Supplier Config
    const supplierConfig = await ProjectSupplier.findOne({ projectId, companyId: session.vendorId });
    const project = await Project.findById(projectId);

    if (!supplierConfig || !project) {
        return res.status(404).send('Project or Supplier config missing');
    }

    // 4. Update Stats & Determine Redirect URL
    let redirectUrl = '';
    
    switch(status) {
      case 'success':
        session.statusCode = 6;
        supplierConfig.completed += 1;
        project.completedCount += 1;
        redirectUrl = supplierConfig.successUrl;
        break;
      case 'disqualified':
        session.statusCode = 7;
        supplierConfig.disqualified += 1;
        redirectUrl = supplierConfig.disqualifiedUrl;
        break;
      case 'quotafull':
        session.statusCode = 8;
        supplierConfig.quotaFull += 1;
        redirectUrl = supplierConfig.quotaFullUrl;
        break;
      case 'security':
        session.statusCode = 10;
        supplierConfig.securityTerminate += 1;
        redirectUrl = supplierConfig.securityTerminateUrl;
        break;
      default:
        return res.status(400).send('Invalid end status');
    }

    // Save state
    await Promise.all([
      session.save(),
      supplierConfig.save(),
      project.save()
    ]);

    // 5. Construct final redirect to Supplier
    if (redirectUrl.includes('[PID]')) {
      redirectUrl = redirectUrl.replace(/\[PID\]/g, session.panellistId);
    } else {
      const separator = redirectUrl.includes('?') ? '&' : '?';
      redirectUrl = `${redirectUrl}${separator}pid=${session.panellistId}`;
    }

    res.redirect(redirectUrl);

  } catch (error) {
    next(error);
  }
};

exports.handleRedirectProcess = async (req, res, next) => {
  try {
    const { supp_code, status, pid, authToken } = req.query;
    const trackingId = pid || req.query.ttpid;

    if (!trackingId) {
      return res.status(400).send('Missing tracking ID (pid / ttpid)');
    }

    const session = await SurveySession.findOne({ sessionId: trackingId });
    if (!session) {
      return res.status(404).send('Invalid tracking session');
    }

    let endStatus = 'success';
    if (authToken) {
      const tokens = exports.getProjectAuthTokens(session.projectId.toString());
      if (authToken === tokens.complete) endStatus = 'success';
      else if (authToken === tokens.terminate) endStatus = 'disqualified';
      else if (authToken === tokens.quotafull) endStatus = 'quotafull';
      else if (authToken === tokens.security) endStatus = 'security';
    } else if (status) {
      if (status === '1') endStatus = 'success';
      else if (status === '2') endStatus = 'disqualified';
      else if (status === '3') endStatus = 'quotafull';
      else if (status === '4') endStatus = 'security';
    }

    req.params = { status: endStatus, projectId: session.projectId.toString() };
    req.query = { ttpid: trackingId };
    return exports.handleEnd(req, res, next);
  } catch (error) {
    next(error);
  }
};

exports.handleRedirectPostback = async (req, res, next) => {
  try {
    const { pid, status_id } = req.query;
    const trackingId = pid || req.query.ttpid;

    if (!trackingId) {
      return res.status(400).json({ success: false, message: 'Missing pid' });
    }

    const session = await SurveySession.findOne({ sessionId: trackingId });
    if (!session) {
      return res.status(404).json({ success: false, message: 'Invalid session' });
    }

    let endStatus = 'success';
    if (status_id === '1') endStatus = 'success';
    else if (status_id === '2') endStatus = 'disqualified';
    else if (status_id === '3') endStatus = 'quotafull';
    else if (status_id === '4') endStatus = 'security';

    req.params = { status: endStatus, projectId: session.projectId.toString() };
    req.query = { ttpid: trackingId };
    return exports.handleEnd(req, res, next);
  } catch (error) {
    next(error);
  }
};
