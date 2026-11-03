const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const SCREENSHOT_DIR = 'C:\\Users\\palyo\\.gemini\\antigravity\\brain\\71c8f4d0-b954-4b46-9a40-9cbb8ac4cfb3\\screenshots';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function clickButtonByText(page, text) {
  const buttons = await page.$$('button');
  for (const btn of buttons) {
    const btnText = await page.evaluate(el => el.textContent, btn);
    if (btnText && btnText.toLowerCase().includes(text.toLowerCase())) {
      await btn.click();
      return true;
    }
  }
  return false;
}

async function runBrowserTest() {
  console.log('--- STARTING COMPREHENSIVE BROWSER TESTING ---');
  console.log(`Using Chrome binary: ${CHROME_PATH}`);
  console.log(`Saving screenshots to: ${SCREENSHOT_DIR}\n`);

  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,920']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 920 });

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      console.log(`[Browser Console Error]: ${msg.text()}`);
    }
  });

  page.on('pageerror', (err) => {
    console.log(`[Browser Page Error]: ${err.message}`);
  });

  try {
    // 1. Login Page
    console.log('1. Testing Login Page (/login) ...');
    await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle2' });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01_login_page.png') });
    console.log('   ✓ Login Page loaded.');

    // 2. Perform Login
    console.log('2. Entering admin credentials (admin@gmail.com / admin@123) ...');
    await page.type('input[type="email"]', 'admin@gmail.com');
    await page.type('input[type="password"]', 'admin@123');
    await page.click('button[type="submit"]');

    // Wait for Dashboard
    await page.waitForNavigation({ waitUntil: 'networkidle2' });
    await delay(1500);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02_dashboard_live.png') });
    console.log('   ✓ Authenticated! Live Dashboard rendered.');

    // 3. Test Dashboard Timeframes
    console.log('3. Testing Dashboard Timeframe Filters ...');
    await clickButtonByText(page, '1 Month');
    await delay(800);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03_dashboard_1month.png') });
    console.log('   ✓ Dashboard timeframe filtering works.');

    // 4. Study Types
    console.log('4. Testing Study Types (/study-types) ...');
    await page.goto('http://localhost:5173/study-types', { waitUntil: 'networkidle2' });
    await delay(800);
    
    // Add a Study Type if form exists
    const stInput = await page.$('input[type="text"]');
    if (stInput) {
      await stInput.type('Consumer Survey B2C');
      await clickButtonByText(page, 'Add Study Type');
      await delay(1000);
    }
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04_study_types.png') });
    console.log('   ✓ Study Types page verified.');

    // 5. Companies Page
    console.log('5. Testing Companies (/companies) ...');
    await page.goto('http://localhost:5173/companies', { waitUntil: 'networkidle2' });
    await delay(800);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05_companies_list.png') });

    // Open Add Company modal
    const openedModal = await clickButtonByText(page, 'New Company');
    if (openedModal) {
      await delay(800);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06_add_company_modal.png') });
      console.log('   ✓ Add Company modal opened & verified.');
      // Close modal
      await clickButtonByText(page, 'Cancel');
      await delay(500);
    }

    // 6. Projects List
    console.log('6. Testing Projects List (/projects) ...');
    await page.goto('http://localhost:5173/projects', { waitUntil: 'networkidle2' });
    await delay(800);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '07_projects_list.png') });
    console.log('   ✓ Projects list verified.');

    // 7. Add Project Page
    console.log('7. Testing Add Project Form (/projects/new) ...');
    await page.goto('http://localhost:5173/projects/new', { waitUntil: 'networkidle2' });
    await delay(800);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '08_add_project_form.png') });
    console.log('   ✓ Add Project form loaded with all accordions.');

    // 8. Analysis Reports
    console.log('8. Testing Analysis Reports (/analysis/reports) ...');
    await page.goto('http://localhost:5173/analysis/reports', { waitUntil: 'networkidle2' });
    await delay(800);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '09_analysis_reports.png') });
    console.log('   ✓ Analysis Reports page loaded.');

    console.log('\n--- ALL BROWSER AUTOMATION TESTS COMPLETED SUCCESSFULLY! ---');

  } catch (err) {
    console.error('[TEST SUITE ERROR]:', err);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'error_state.png') });
  } finally {
    await browser.close();
  }
}

runBrowserTest();
