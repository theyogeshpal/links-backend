const Project = require('../models/Project');
const ProjectSupplier = require('../models/ProjectSupplier');
const SurveySession = require('../models/SurveySession');
const ProjectQualification = require('../models/ProjectQualification');
const ClientCode = require('../models/ClientCode');
const crypto = require('crypto');

// Helper to replace supplier placeholders in callback URLs
const formatSupplierRedirectUrl = (url, pid) => {
  if (!url) return '';
  if (/\[PID\]|{{PID}}|{{UID}}|\[UID\]/i.test(url)) {
    return url.replace(/\[PID\]|{{PID}}|{{UID}}|\[UID\]/gi, pid);
  }
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}pid=${encodeURIComponent(pid)}`;
};

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
    const { pid, passthru, age, gender } = req.query; // 'pid' is the vendor's panellist ID

    if (!pid) {
      return res.status(400).send('Missing Panellist ID (pid)');
    }

    // 1. Verify Project & Supplier exist
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).send('Project not found');
    }

    const supplierConfig = await ProjectSupplier.findOne({ projectId, companyId: supplierId }).populate('companyId', 'name');
    if (!supplierConfig) {
      return res.status(404).send('Supplier config not found');
    }

    // If project is not Running
    if (project.status !== 'Running') {
      if (supplierConfig.securityTerminateUrl) {
        return res.redirect(formatSupplierRedirectUrl(supplierConfig.securityTerminateUrl, pid));
      }
      return res.status(403).send('Project is not in Running status');
    }

    // 2. Auto-Cap Check: Project Max Completes / Target Cap
    const targetCompletes = Number(project.maxCompletes) || project.reqCompletes || 0;
    if (targetCompletes > 0 && (project.completedCount || 0) >= targetCompletes) {
      const qfSession = new SurveySession({
        projectId,
        vendorId: supplierId,
        panellistId: pid,
        passthru,
        statusCode: 8, // Quota Full
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });
      supplierConfig.quotaFull = (supplierConfig.quotaFull || 0) + 1;
      supplierConfig.hits = (supplierConfig.hits || 0) + 1;
      await Promise.all([qfSession.save(), supplierConfig.save()]);
      return res.redirect(formatSupplierRedirectUrl(supplierConfig.quotaFullUrl, pid));
    }

    // 3. Auto-Cap Check: Supplier Allocated Completes
    if (supplierConfig.allocatedCompletes > 0 && (supplierConfig.completed || 0) >= supplierConfig.allocatedCompletes) {
      const qfSession = new SurveySession({
        projectId,
        vendorId: supplierId,
        panellistId: pid,
        passthru,
        statusCode: 8, // Quota Full
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });
      supplierConfig.quotaFull = (supplierConfig.quotaFull || 0) + 1;
      supplierConfig.hits = (supplierConfig.hits || 0) + 1;
      await Promise.all([qfSession.save(), supplierConfig.save()]);
      return res.redirect(formatSupplierRedirectUrl(supplierConfig.quotaFullUrl, pid));
    }

    // 4. Device Validation Check
    if (project.supportedDevices && project.supportedDevices.length > 0) {
      const ua = req.get('User-Agent') || '';
      const isMobile = /Mobile|Android|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
      const isTablet = /Tablet|iPad/i.test(ua);
      const isDesktop = !isMobile && !isTablet;

      let currentDevice = 'Desktop';
      if (isTablet) currentDevice = 'Tablet';
      else if (isMobile) currentDevice = 'Mobile';

      if (!project.supportedDevices.includes(currentDevice)) {
        const secSession = new SurveySession({
          projectId,
          vendorId: supplierId,
          panellistId: pid,
          passthru,
          statusCode: 10, // Security Terminate (Device Mismatch)
          ipAddress: req.ip,
          userAgent: ua
        });
        supplierConfig.securityTerminate = (supplierConfig.securityTerminate || 0) + 1;
        supplierConfig.hits = (supplierConfig.hits || 0) + 1;
        await Promise.all([secSession.save(), supplierConfig.save()]);
        return res.redirect(formatSupplierRedirectUrl(supplierConfig.securityTerminateUrl, pid));
      }
    }

    // 5. Pre-Screener Demographics Check (Qualifications)
    if (age || gender) {
      const qualifications = await ProjectQualification.find({ projectId, isActive: true });
      for (const q of qualifications) {
        // Age screener
        if (age && (q.questionType === 'Age' || q.fieldType === 'Range')) {
          const numAge = Number(age);
          if (!isNaN(numAge) && q.ranges && q.ranges.length > 0) {
            const matchesValidRange = q.ranges.some(r => {
              if (r.valid !== 1) return false;
              const start = Number(r.start);
              const end = Number(r.end);
              return numAge >= start && numAge <= end;
            });
            if (!matchesValidRange) {
              const dqSession = new SurveySession({
                projectId,
                vendorId: supplierId,
                panellistId: pid,
                passthru,
                statusCode: 7, // Disqualified
                ipAddress: req.ip,
                userAgent: req.get('User-Agent')
              });
              supplierConfig.disqualified = (supplierConfig.disqualified || 0) + 1;
              supplierConfig.hits = (supplierConfig.hits || 0) + 1;
              await Promise.all([dqSession.save(), supplierConfig.save()]);
              return res.redirect(formatSupplierRedirectUrl(supplierConfig.disqualifiedUrl, pid));
            }
          }
        }

        // Gender screener
        if (gender && (q.questionType === 'Gender' || q.fieldType === 'Dropdown')) {
          const userGender = String(gender).trim().toLowerCase();
          if (q.optionItems && q.optionItems.length > 0) {
            const matchesValidOption = q.optionItems.some(opt => {
              if (opt.valid !== 1) return false;
              return (opt.optionText || '').trim().toLowerCase() === userGender;
            });
            if (!matchesValidOption) {
              const dqSession = new SurveySession({
                projectId,
                vendorId: supplierId,
                panellistId: pid,
                passthru,
                statusCode: 7, // Disqualified
                ipAddress: req.ip,
                userAgent: req.get('User-Agent')
              });
              supplierConfig.disqualified = (supplierConfig.disqualified || 0) + 1;
              supplierConfig.hits = (supplierConfig.hits || 0) + 1;
              await Promise.all([dqSession.save(), supplierConfig.save()]);
              return res.redirect(formatSupplierRedirectUrl(supplierConfig.disqualifiedUrl, pid));
            }
          }
        }
      }
    }

    // 6. Create the Survey Session
    const session = new SurveySession({
      projectId,
      vendorId: supplierId,
      panellistId: pid,
      passthru,
      statusCode: 9, // Pending / Redirected
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });
    await session.save();

    // 7. Update Supplier Hit Count
    supplierConfig.hits = (supplierConfig.hits || 0) + 1;
    await supplierConfig.save();

    // 8. Client Code (Unique Token) Assignment
    let assignedClientCode = '';
    const totalClientCodes = await ClientCode.countDocuments({ projectId });
    if (totalClientCodes > 0) {
      const codeDoc = await ClientCode.findOneAndUpdate(
        { projectId, isUsed: false },
        {
          $set: {
            isUsed: true,
            ttpid: session.sessionId,
            panelListId: pid,
            vendorName: supplierConfig.companyId?.name || 'Vendor',
            started: new Date()
          }
        },
        { new: true }
      );

      if (!codeDoc) {
        // All unique client codes have been exhausted!
        session.statusCode = 8;
        await session.save();
        supplierConfig.quotaFull = (supplierConfig.quotaFull || 0) + 1;
        await supplierConfig.save();
        return res.redirect(formatSupplierRedirectUrl(supplierConfig.quotaFullUrl, pid));
      }

      assignedClientCode = codeDoc.clientCode;
    }

    // 9. Construct the Foreign Client Survey Link with Dynamic Replacements
    let redirectUrl = project.surveyLink;

    // Replace Standard Market Research tokens
    redirectUrl = redirectUrl
      .replace(/\[TTPID\]|{{TTPID}}|\[SESSION_ID\]|{{SESSION_ID}}|\[ID\]|{{ID}}/gi, session.sessionId)
      .replace(/\[PID\]|{{PID}}|\[UID\]|{{UID}}|\[PANELLIST_ID\]|{{PANELLIST_ID}}/gi, pid)
      .replace(/\[CLIENTKEY\]|{{CLIENTKEY}}|\[CLIENTCODE\]|{{CLIENTCODE}}/gi, assignedClientCode);

    // If no session token was present in the template, append ttpid query param automatically
    if (!redirectUrl.includes(session.sessionId)) {
      const separator = redirectUrl.includes('?') ? '&' : '?';
      redirectUrl = `${redirectUrl}${separator}ttpid=${session.sessionId}`;
    }

    // 10. Redirect the respondent into the client's survey
    res.redirect(redirectUrl);

  } catch (error) {
    next(error);
  }
};

exports.handleEnd = async (req, res, next) => {
  try {
    const { status, projectId } = req.params;
    const trackingId = req.query.ttpid || req.query.pid || req.query.id; // Session ID passed back by client

    if (!trackingId) {
      return res.status(400).send('Missing tracking ID (ttpid / pid)');
    }

    // 1. Find the Session
    const session = await SurveySession.findOne({ 
      $or: [{ sessionId: trackingId }, { _id: trackingId.length === 24 ? trackingId : null }],
      projectId 
    });
    
    if (!session) {
      return res.status(404).send('Invalid tracking session');
    }

    // 2. Prevent Duplicate Completions (only process if it was pending/9)
    if (session.statusCode !== 9) {
      return res.status(400).send('Session already processed');
    }

    // 3. Find Supplier Config & Project
    const supplierConfig = await ProjectSupplier.findOne({ projectId, companyId: session.vendorId });
    const project = await Project.findById(projectId);

    if (!supplierConfig || !project) {
      return res.status(404).send('Project or Supplier config missing');
    }

    // 4. Update Stats & Determine Redirect URL
    let redirectUrl = '';
    
    switch(status.toLowerCase()) {
      case 'success':
      case 'complete':
        session.statusCode = 6;
        supplierConfig.completed = (supplierConfig.completed || 0) + 1;
        project.completedCount = (project.completedCount || 0) + 1;
        redirectUrl = supplierConfig.successUrl;

        // Stamp completion on ClientCode
        await ClientCode.updateOne(
          { ttpid: session.sessionId, projectId },
          { $set: { completedOn: new Date() } }
        );
        break;

      case 'disqualified':
      case 'terminate':
        session.statusCode = 7;
        supplierConfig.disqualified = (supplierConfig.disqualified || 0) + 1;
        redirectUrl = supplierConfig.disqualifiedUrl;

        // Recycle unused client code
        await ClientCode.updateOne(
          { ttpid: session.sessionId, projectId },
          { $set: { isUsed: false, ttpid: null, started: null } }
        );
        break;

      case 'quotafull':
      case 'qf':
        session.statusCode = 8;
        supplierConfig.quotaFull = (supplierConfig.quotaFull || 0) + 1;
        redirectUrl = supplierConfig.quotaFullUrl;

        // Recycle unused client code
        await ClientCode.updateOne(
          { ttpid: session.sessionId, projectId },
          { $set: { isUsed: false, ttpid: null, started: null } }
        );
        break;

      case 'security':
      case 'securityterm':
      default:
        session.statusCode = 10;
        supplierConfig.securityTerminate = (supplierConfig.securityTerminate || 0) + 1;
        redirectUrl = supplierConfig.securityTerminateUrl;

        // Recycle unused client code
        await ClientCode.updateOne(
          { ttpid: session.sessionId, projectId },
          { $set: { isUsed: false, ttpid: null, started: null } }
        );
        break;
    }

    // Save states
    await Promise.all([
      session.save(),
      supplierConfig.save(),
      project.save()
    ]);

    // 5. Construct final redirect to Supplier
    res.redirect(formatSupplierRedirectUrl(redirectUrl, session.panellistId));

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
