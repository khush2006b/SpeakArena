const WebPageTest = require('webpagetest');
const fs = require('fs');
const path = require('path');

// You must set WPT_API_KEY environment variable
const apiKey = process.env.WPT_API_KEY;
if (!apiKey) {
  console.error('WPT_API_KEY environment variable is not set. Skipping WebPageTest.');
  process.exit(0); // Skip instead of fail for local runs
}

const wpt = new WebPageTest('www.webpagetest.org', apiKey);
const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'wpt-config.json'), 'utf8'));

// Override target URL if provided via env
const targetUrl = process.env.STAGING_URL || config.targetUrl;

console.log(`🚀 Starting WebPageTest against ${targetUrl} (Simulating ${config.connectivity})`);

wpt.runTest(targetUrl, {
  location: config.location,
  connectivity: config.connectivity,
  runs: config.runs,
  firstViewOnly: config.firstViewOnly,
  video: config.video,
  pollResults: 5, // Poll every 5 seconds
}, (err, data) => {
  if (err) {
    console.error('❌ WebPageTest failed to initiate:', err);
    process.exit(1);
  }

  const { median } = data.data;
  const firstView = median.firstView;
  
  console.log('\n📊 WebPageTest Results (Median):');
  console.log(`- Load Time: ${firstView.loadTime}ms`);
  console.log(`- TTFB: ${firstView.TTFB}ms`);
  console.log(`- Fully Loaded: ${firstView.fullyLoaded}ms`);
  console.log(`- Speed Index: ${firstView.SpeedIndex}`);
  console.log(`- LCP: ${firstView.chromeUserTiming.LargestContentfulPaint}ms`);
  console.log(`\n🔗 Full Report: ${data.data.summary}`);

  // Assertions against performance budgets
  let failed = false;
  if (firstView.loadTime > config.specs.loadTime) {
    console.error(`🚨 Load Time budget exceeded: ${firstView.loadTime} > ${config.specs.loadTime}`);
    failed = true;
  }
  if (firstView.SpeedIndex > config.specs.SpeedIndex) {
    console.error(`🚨 Speed Index budget exceeded: ${firstView.SpeedIndex} > ${config.specs.SpeedIndex}`);
    failed = true;
  }

  if (failed) {
    console.error('\n❌ WebPageTest Performance Budgets failed.');
    process.exit(1);
  } else {
    console.log('\n✅ WebPageTest Performance Budgets passed.');
  }
});
