const SurveySession = require('../models/SurveySession');
const Project = require('../models/Project');
const VendorRedirect = require('../models/VendorRedirect');

exports.entry = async (req, res, next) => {
  try {
    const { project_id, vendor_id, panellist_id, passthru } = req.query;

    if (!project_id || !vendor_id || !panellist_id) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const project = await Project.findById(project_id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    
    if (project.status !== 'Running') {
      return res.status(400).json({ error: 'Project is not currently running' });
    }

    if (project.completedCount >= project.targetQuota) {
      // Create session as Quota Full immediately if project is full before entry
      // For this simplified logic, just error out or redirect to Vendor's Quota Full
      // Better to create a session first so we can redirect cleanly:
    }

    const session = new SurveySession({
      projectId: project._id,
      vendorId: vendor_id,
      panellistId: panellist_id,
      passthru,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      referralHeader: req.get('referer')
    });
    
    await session.save();

    if (project.completedCount >= project.targetQuota) {
        session.statusCode = 8;
        await session.save();
        const vendorRedirect = await VendorRedirect.findOne({ vendorId: vendor_id });
        let url = vendorRedirect ? vendorRedirect.quotaFullUrl : '';
        if(url) {
            url = url.replace('{{PANELLIST_ID}}', panellist_id);
            return res.redirect(302, url);
        } else {
             return res.status(400).json({ error: 'Quota Full and no redirect URL set' });
        }
    }

    // Replace {{SESSION_ID}} in client url
    const redirectUrl = project.clientSurveyLink.replace('{{SESSION_ID}}', session.sessionId);
    
    res.redirect(302, redirectUrl);

  } catch (error) {
    next(error);
  }
};

exports.process = async (req, res, next) => {
  try {
    const { session_id, status_code } = req.query;

    if (!session_id || !status_code) {
      return res.status(400).json({ error: 'Missing session_id or status_code' });
    }

    const session = await SurveySession.findOne({ sessionId: session_id });
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const parsedStatus = parseInt(status_code, 10);
    
    // Only update if it's currently pending (9) to prevent multiple triggers
    if (session.statusCode === 9) {
      session.statusCode = parsedStatus;
      await session.save();

      // If complete (6), update project completed count atomically
      if (parsedStatus === 6) {
        await Project.findByIdAndUpdate(session.projectId, {
          $inc: { completedCount: 1 }
        });
      }
    }

    const vendorRedirect = await VendorRedirect.findOne({ vendorId: session.vendorId });
    if (!vendorRedirect) {
        return res.status(500).json({ error: 'Vendor redirects not configured' });
    }

    let redirectUrl = '';
    switch(parsedStatus) {
      case 6: redirectUrl = vendorRedirect.completeUrl; break;
      case 7: redirectUrl = vendorRedirect.terminateUrl; break;
      case 8: redirectUrl = vendorRedirect.quotaFullUrl; break;
      default: redirectUrl = vendorRedirect.securityTermUrl; break;
    }

    // Replace variables in vendor URL if needed (e.g. {{PANELLIST_ID}})
    redirectUrl = redirectUrl.replace('{{PANELLIST_ID}}', session.panellistId);
    if(session.passthru) {
       redirectUrl = redirectUrl.replace('{{PASSTHRU}}', session.passthru);
    }

    res.redirect(302, redirectUrl);

  } catch (error) {
    next(error);
  }
};
