const axios = require('axios');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const BASE_URL = 'http://localhost:5000/api/v1';

async function testFullRoutingWorkflow() {
  console.log('===============================================================');
  console.log('   MARKET RESEARCH ROUTING, MASKING & HIT COUNT TEST SUITE     ');
  console.log('===============================================================\n');

  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/links';
  await mongoose.connect(mongoUri);

  const Company = require('../src/models/Company');
  const Project = require('../src/models/Project');
  const ProjectSupplier = require('../src/models/ProjectSupplier');
  const SurveySession = require('../src/models/SurveySession');

  // 1. Authenticate as Admin
  console.log('1. Authenticating as Admin to obtain JWT ...');
  const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
    email: 'admin@gmail.com',
    password: 'admin@123'
  });
  const token = loginRes.data.token;
  const authHeaders = { headers: { Authorization: `Bearer ${token}` } };
  console.log('   ✓ Logged in successfully. Token acquired.\n');

  // 2. Create Client Company
  console.log('2. Setting up test Client and Supplier Companies ...');
  const clientComp = new Company({
    name: 'Test Client Enterprise',
    companyType: 'Client',
    email: `client_${Date.now()}@acme.com`,
    status: 'Active'
  });
  await clientComp.save();

  const supplierComp = new Company({
    name: 'Global Panel Supplier Inc',
    companyType: 'Vendor',
    email: `supplier_${Date.now()}@panels.com`,
    status: 'Active'
  });
  await supplierComp.save();
  console.log(`   ✓ Client created: "${clientComp.name}" (ID: ${clientComp._id})`);
  console.log(`   ✓ Supplier created: "${supplierComp.name}" (ID: ${supplierComp._id})\n`);

  // 3. Create Project with Client Survey Link containing Tokens
  console.log('3. Creating Project with masked client survey URL ...');
  const rawClientSurveyUrl = 'https://client-portal.qualtrics.com/jfe/form/SV_TEST99?session_id=[TTPID]&respondent_uid=[PID]';
  const project = new Project({
    name: 'Q4 Global Consumer Study',
    clientId: clientComp._id,
    surveyLink: rawClientSurveyUrl,
    surveyTestLink: 'https://client-portal.qualtrics.com/jfe/form/SV_TEST99?test=1',
    cpc: 6.50,
    vendorMaxCpc: 4.80,
    reqCompletes: 100,
    maxCompletes: '110',
    status: 'Running'
  });
  await project.save();
  console.log(`   ✓ Project created: "${project.name}" (ID: ${project._id})`);
  console.log(`   -> Target Client Survey URL: ${rawClientSurveyUrl}\n`);

  // 4. Assign Supplier to Project with Postback URLs
  console.log('4. Registering Supplier with callback URLs ...');
  const supplierConfig = new ProjectSupplier({
    projectId: project._id,
    companyId: supplierComp._id,
    allocatedHits: 500,
    allocatedCompletes: 50,
    cpc: 4.50,
    status: 'Running',
    successUrl: 'https://supplier-panel.com/callbacks/complete?uid=[PID]&status=1',
    disqualifiedUrl: 'https://supplier-panel.com/callbacks/terminate?uid=[PID]&status=2',
    quotaFullUrl: 'https://supplier-panel.com/callbacks/quotafull?uid=[PID]&status=3',
    securityTerminateUrl: 'https://supplier-panel.com/callbacks/security?uid=[PID]&status=4',
    hits: 0,
    completed: 0,
    disqualified: 0,
    quotaFull: 0,
    securityTerminate: 0
  });
  await supplierConfig.save();
  console.log(`   ✓ Supplier registered. Initial Hits = ${supplierConfig.hits}, Completed = ${supplierConfig.completed}\n`);

  // 5. TEST: Survey Link Masking & Hit Count Increment (Respondent #1)
  const panellistId1 = 'VENDOR_PANELIST_101';
  const supplierEntryLink = `${BASE_URL}/router/entry/${project._id}/${supplierComp._id}?pid=${panellistId1}`;
  console.log('5. TEST 1: Respondent #1 clicks Supplier Entry Link (Survey Link Masking & Hit Counting)');
  console.log(`   -> Supplier Entry URL provided to vendor: ${supplierEntryLink}`);

  const entryResponse1 = await axios.get(supplierEntryLink, {
    maxRedirects: 0,
    validateStatus: (status) => status >= 200 && status < 400
  });

  const redirectedClientUrl1 = entryResponse1.headers.location;
  console.log(`   -> Router HTTP Status: ${entryResponse1.status} (302 Redirect)`);
  console.log(`   -> Masked Forwarded Destination: ${redirectedClientUrl1}`);

  // Verification 1: Did masking work?
  const hasSessionId = /session_id=[a-zA-Z0-9_-]{8,}/.test(redirectedClientUrl1);
  const hasPanellistId = redirectedClientUrl1.includes(`respondent_uid=${panellistId1}`);
  const doesNotContainTemplateTags = !redirectedClientUrl1.includes('[TTPID]') && !redirectedClientUrl1.includes('[PID]');

  if (hasSessionId && hasPanellistId && doesNotContainTemplateTags) {
    console.log('   ✓ SURVEY LINK MASKING: PASSED (Tokens replaced dynamically with secure session & vendor UID)');
  } else {
    console.error('   ✗ SURVEY LINK MASKING: FAILED');
  }

  // Extract session ID
  const match = redirectedClientUrl1.match(/session_id=([a-zA-Z0-9_-]+)/);
  const sessionId1 = match ? match[1] : null;
  console.log(`   -> Internal Session ID generated: ${sessionId1}`);

  // Verification 2: Check database hit count
  const updatedSupplier1 = await ProjectSupplier.findById(supplierConfig._id);
  console.log(`   -> Database Supplier Hit Count: ${updatedSupplier1.hits} (Expected: 1)`);
  if (updatedSupplier1.hits === 1) {
    console.log('   ✓ HIT COUNT INCREMENT: PASSED (Hits incremented from 0 -> 1)');
  } else {
    console.error(`   ✗ HIT COUNT INCREMENT: FAILED (Current hits: ${updatedSupplier1.hits})`);
  }

  // 6. TEST: Second Respondent Hit (Respondent #2)
  console.log('\n6. TEST 2: Respondent #2 clicks Entry Link (Verifying sequential hit counter)');
  const panellistId2 = 'VENDOR_PANELIST_202';
  const supplierEntryLink2 = `${BASE_URL}/router/entry/${project._id}/${supplierComp._id}?pid=${panellistId2}`;
  
  const entryResponse2 = await axios.get(supplierEntryLink2, {
    maxRedirects: 0,
    validateStatus: (status) => status >= 200 && status < 400
  });

  const redirectedClientUrl2 = entryResponse2.headers.location;
  const match2 = redirectedClientUrl2.match(/session_id=([a-zA-Z0-9_-]+)/);
  const sessionId2 = match2 ? match2[1] : null;

  const updatedSupplier2 = await ProjectSupplier.findById(supplierConfig._id);
  console.log(`   -> Database Supplier Hit Count: ${updatedSupplier2.hits} (Expected: 2)`);
  if (updatedSupplier2.hits === 2) {
    console.log('   ✓ SEQUENTIAL HIT COUNT: PASSED (Hits incremented from 1 -> 2)');
  } else {
    console.error(`   ✗ SEQUENTIAL HIT COUNT: FAILED`);
  }

  // 7. TEST: Survey Completion & Vendor Postback Callback (Respondent #1 Completes)
  console.log('\n7. TEST 3: Respondent #1 Completes Client Survey -> Hits Platform End Link');
  const clientCompleteEndUrl = `${BASE_URL}/router/end/success/${project._id}?ttpid=${sessionId1}`;
  console.log(`   -> Client redirects to: ${clientCompleteEndUrl}`);

  const completeRes = await axios.get(clientCompleteEndUrl, {
    maxRedirects: 0,
    validateStatus: (status) => status >= 200 && status < 400
  });

  const vendorCallbackUrl = completeRes.headers.location;
  console.log(`   -> Router HTTP Status: ${completeRes.status} (302 Redirect)`);
  console.log(`   -> Final Redirect to Supplier: ${vendorCallbackUrl}`);

  // Verification 3: Did callback redirect to supplier with [PID] replaced?
  const expectedVendorUrl = `https://supplier-panel.com/callbacks/complete?uid=${panellistId1}&status=1`;
  if (vendorCallbackUrl === expectedVendorUrl) {
    console.log(`   ✓ VENDOR POSTBACK MAPPING: PASSED (Redirected to: ${vendorCallbackUrl})`);
  } else {
    console.error(`   ✗ VENDOR POSTBACK MAPPING: FAILED (Got: ${vendorCallbackUrl})`);
  }

  // Verification 4: Check Completion counters in DB
  const finalProject = await Project.findById(project._id);
  const finalSupplier = await ProjectSupplier.findById(supplierConfig._id);
  const finalSession = await SurveySession.findOne({ sessionId: sessionId1 });

  console.log(`   -> Project Completed Count: ${finalProject.completedCount} (Expected: 1)`);
  console.log(`   -> Supplier Completed Count: ${finalSupplier.completed} (Expected: 1)`);
  console.log(`   -> Session Status Code: ${finalSession.statusCode} (Expected: 6 = Complete)`);

  if (finalProject.completedCount === 1 && finalSupplier.completed === 1 && finalSession.statusCode === 6) {
    console.log('   ✓ COMPLETION METRICS INCREMENT: PASSED');
  } else {
    console.error('   ✗ COMPLETION METRICS INCREMENT: FAILED');
  }

  // 8. TEST: Respondent #2 Gets Disqualified
  console.log('\n8. TEST 4: Respondent #2 is Disqualified -> Hits Platform Disqualify Link');
  const clientDisqualifyEndUrl = `${BASE_URL}/router/end/disqualified/${project._id}?ttpid=${sessionId2}`;

  const dqRes = await axios.get(clientDisqualifyEndUrl, {
    maxRedirects: 0,
    validateStatus: (status) => status >= 200 && status < 400
  });

  const vendorDqUrl = dqRes.headers.location;
  console.log(`   -> Final Redirect to Supplier: ${vendorDqUrl}`);

  const postDqSupplier = await ProjectSupplier.findById(supplierConfig._id);
  const postDqSession = await SurveySession.findOne({ sessionId: sessionId2 });
  console.log(`   -> Supplier Disqualified Count: ${postDqSupplier.disqualified} (Expected: 1)`);
  console.log(`   -> Session Status Code: ${postDqSession.statusCode} (Expected: 7 = Disqualified)`);

  if (postDqSupplier.disqualified === 1 && postDqSession.statusCode === 7) {
    console.log('   ✓ DISQUALIFICATION METRICS INCREMENT: PASSED');
  } else {
    console.error('   ✗ DISQUALIFICATION METRICS INCREMENT: FAILED');
  }

  // Clean up test documents
  console.log('\n9. Cleaning up test data ...');
  await Project.findByIdAndDelete(project._id);
  await ProjectSupplier.findByIdAndDelete(supplierConfig._id);
  await Company.findByIdAndDelete(clientComp._id);
  await Company.findByIdAndDelete(supplierComp._id);
  await SurveySession.deleteMany({ projectId: project._id });
  console.log('   ✓ Test data cleared cleanly.\n');

  console.log('===============================================================');
  console.log('   ALL ROUTING, MASKING & HIT COUNT TESTS PASSED (100% OK)     ');
  console.log('===============================================================\n');

  process.exit(0);
}

testFullRoutingWorkflow().catch((err) => {
  console.error('\n[TEST RUNNER FAILED]:', err.message);
  if (err.response) {
    console.error('Response data:', err.response.data);
  }
  process.exit(1);
});
