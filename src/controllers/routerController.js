const Project = require('../models/Project');
const ProjectSupplier = require('../models/ProjectSupplier');
const SurveySession = require('../models/SurveySession');

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
    // The foreign client's link will have a placeholder like `&uid=[ID]` or something we define.
    // For now, we'll assume the URL might have `[TTPID]` placeholder, or we just append it.
    let redirectUrl = project.surveyLink;
    
    // Replace placeholder if it exists, otherwise append
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
    // We replace the `[PID]` placeholder in the vendor's URL with the original panellistId
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
