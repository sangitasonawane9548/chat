const { execSync } = require('child_process');
const path = require('path');

const suites = [
  'day2_auth_test.js',
  'demo_otp_test.js',
  'day3_discovery_test.js',
  'day4_messaging_test.js',
  'day5_media_test.js',
  'day6_calling_test.js',
  'day7_video_calling_test.js',
  'day8_group_test.js',
  'day9_status_test.js',
  'day10_final_integration_test.js',
  'day10_admin_test.js',
  'admin_security_rbac_test.js'
];

console.log('================================================================');
console.log('🚀 EXECUTING COMPLETE ALL-SUITES REGRESSION RUN (DAYS 1 TO 10)');
console.log('================================================================\n');

let totalPassedSuites = 0;

for (const suite of suites) {
  const filePath = path.join(__dirname, suite);
  console.log(`▶ Running test suite: ${suite}...`);
  try {
    const output = execSync(`node "${filePath}"`, { stdio: 'pipe' }).toString();
    console.log(output);
    totalPassedSuites++;
  } catch (err) {
    console.error(`❌ Suite failed: ${suite}`);
    console.error(err.stdout ? err.stdout.toString() : err.message);
    process.exit(1);
  }
}

console.log('================================================================');
console.log(`🎉 ALL ${totalPassedSuites}/${suites.length} TEST SUITES PASSED FLAWLESSLY!`);
console.log('================================================================\n');

