const { execSync } = require('child_process');
const path = require('path');

console.log('🚀 Starting Lighthouse CI Performance Tests...');

try {
  // We execute lhci autorun, which automatically uses the lighthouserc.json in the same directory
  // It spins up the Next.js server, runs Lighthouse multiple times against the URLs, and asserts on the budgets.
  execSync('npx @lhci/cli@0.12.x autorun', { 
    stdio: 'inherit',
    cwd: path.resolve(__dirname, '../../frontend') // Execute from the frontend directory where package.json lives
  });
  console.log('✅ Lighthouse CI finished successfully. All Core Web Vitals are within budget.');
} catch (error) {
  console.error('❌ Lighthouse CI failed. Performance budgets were exceeded.');
  process.exit(1);
}
