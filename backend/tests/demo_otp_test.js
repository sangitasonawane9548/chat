/**
 * =============================================================================
 * DEMO OTP REGISTRATION & VERIFICATION TEST SUITE
 * =============================================================================
 * Verifies:
 * 1. Register with new email & username -> status is pending & unverified
 * 2. Database stores user and OTP hash
 * 3. Entering incorrect OTP (e.g. 000000) is rejected with "Invalid OTP. Please try again."
 * 4. Account is NOT activated on incorrect OTP
 * 5. Attempting to log in before verification is blocked (403)
 * 6. Entering demo OTP 123456 verifies and activates account
 * 7. Database updates email_verified = 1 and account_status = 'active'
 * 8. User can now successfully log in with username/password
 * 9. Duplicate email registration is rejected (409)
 * 10. Duplicate username registration is rejected (409)
 * 11. Resend OTP functionality works seamlessly
 */

const { pool } = require('../config/database');

const BASE_URL = 'http://localhost:5000/api';

let passed = 0;
let failed = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`✅ [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`❌ [FAIL] ${testName}`);
    if (details) console.error(`   Details: ${details}`);
    failed++;
  }
}

async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  const response = await fetch(url, {
    ...options,
    headers
  });

  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    data = { raw: text };
  }

  const cookieHeader = response.headers.get('set-cookie');
  let token = null;
  if (cookieHeader) {
    const match = cookieHeader.match(/token=([^;]+)/);
    if (match) token = match[1];
  }

  return { status: response.status, data, token };
}

async function runDemoOtpTests() {
  console.log('\n================================================================');
  console.log('🧪 RUNNING DEMO OTP REGISTRATION & VERIFICATION TESTS');
  console.log('================================================================\n');

  const testUser = {
    fullName: 'Demo Test User',
    username: 'demouser_test',
    email: 'demouser_test@example.com',
    password: 'SecurePassword123!',
    confirmPassword: 'SecurePassword123!',
    agreeTerms: true
  };

  try {
    // 0. Clean up any previous test artifacts
    await pool.query('DELETE FROM users WHERE email IN (?, ?, ?)', [
      testUser.email,
      'completely_new_email@example.com',
      'another_demo@example.com'
    ]);
    await pool.query('DELETE FROM users WHERE username IN (?, ?)', [
      testUser.username,
      'another_demo'
    ]);

    // -------------------------------------------------------------------------
    // TEST 1: Register new user with full details
    // -------------------------------------------------------------------------
    const regRes = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(testUser)
    });

    assert(
      regRes.status === 201 &&
      regRes.data.success === true &&
      regRes.data.email === testUser.email &&
      regRes.data.isDemo === true,
      'TEST 1: Register user succeeds with 201 and navigates to OTP verification'
    );

    // -------------------------------------------------------------------------
    // TEST 2: User is saved in MySQL as pending and unverified
    // -------------------------------------------------------------------------
    const [userDb] = await pool.query(
      'SELECT id, username, email, email_verified, account_status FROM users WHERE email = ?',
      [testUser.email]
    );

    assert(
      userDb.length === 1 &&
      userDb[0].email_verified === 0 &&
      userDb[0].account_status === 'pending',
      'TEST 2: User saved in MySQL with email_verified = 0 and account_status = pending'
    );

    const userId = userDb[0].id;

    // -------------------------------------------------------------------------
    // TEST 3: Active OTP record exists in email_verification_otps
    // -------------------------------------------------------------------------
    const [otpsDb] = await pool.query(
      'SELECT id, otp_hash, verified_at FROM email_verification_otps WHERE user_id = ? ORDER BY id DESC LIMIT 1',
      [userId]
    );

    assert(
      otpsDb.length === 1 && otpsDb[0].verified_at === null,
      'TEST 3: Active OTP record created in email_verification_otps'
    );

    // -------------------------------------------------------------------------
    // TEST 4: Attempting to log in before OTP verification is rejected (403)
    // -------------------------------------------------------------------------
    const earlyLogin = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        usernameOrEmail: testUser.username,
        password: testUser.password
      })
    });

    assert(
      earlyLogin.status === 403 && (earlyLogin.data.isUnverified === true || earlyLogin.data.requiresVerification === true),
      'TEST 4: Attempting to login before OTP verification is rejected with 403',
      JSON.stringify(earlyLogin.data)
    );

    // -------------------------------------------------------------------------
    // TEST 5: Entering incorrect OTP (e.g. 000000) is rejected with "Invalid OTP. Please try again."
    // -------------------------------------------------------------------------
    const wrongOtpRes = await request('/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({
        email: testUser.email,
        otp: '000000'
      })
    });

    assert(
      wrongOtpRes.status === 400 &&
      wrongOtpRes.data.success === false &&
      wrongOtpRes.data.message === 'Invalid OTP. Please try again.',
      'TEST 5: Incorrect OTP rejected with exact message "Invalid OTP. Please try again."'
    );

    // Account must still NOT be verified
    const [userDbAfterWrong] = await pool.query(
      'SELECT email_verified, account_status FROM users WHERE id = ?',
      [userId]
    );
    assert(
      userDbAfterWrong[0].email_verified === 0 &&
      userDbAfterWrong[0].account_status === 'pending',
      'TEST 6: Account remains pending and unverified after incorrect OTP'
    );

    // -------------------------------------------------------------------------
    // TEST 7: Resend OTP generates new OTP in demo mode
    // -------------------------------------------------------------------------
    const resendRes = await request('/auth/resend-otp', {
      method: 'POST',
      body: JSON.stringify({ email: testUser.email })
    });

    assert(
      resendRes.status === 200 && resendRes.data.success === true,
      'TEST 7: Resend OTP succeeds and creates fresh active code'
    );

    // -------------------------------------------------------------------------
    // TEST 8: Enter fixed DEMO OTP "123456" -> Account verified & activated
    // -------------------------------------------------------------------------
    const verifyRes = await request('/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({
        email: testUser.email,
        otp: '123456'
      })
    });

    assert(
      verifyRes.status === 200 && verifyRes.data.success === true,
      'TEST 8: Entering demo OTP 123456 successfully verifies email'
    );

    // -------------------------------------------------------------------------
    // TEST 9: MySQL database verification: email_verified = 1 and account_status = active
    // -------------------------------------------------------------------------
    const [userDbVerified] = await pool.query(
      'SELECT email_verified, account_status FROM users WHERE id = ?',
      [userId]
    );

    assert(
      userDbVerified[0].email_verified === 1 &&
      userDbVerified[0].account_status === 'active',
      'TEST 9: MySQL status updated: email_verified = 1 and account_status = active'
    );

    // -------------------------------------------------------------------------
    // TEST 10: Verified user can now log in successfully
    // -------------------------------------------------------------------------
    const validLogin = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        usernameOrEmail: testUser.username,
        password: testUser.password
      })
    });

    assert(
      validLogin.status === 200 &&
      validLogin.data.success === true &&
      validLogin.data.user.username === testUser.username &&
      validLogin.token !== null,
      'TEST 10: User can successfully log in using username and password'
    );

    // -------------------------------------------------------------------------
    // TEST 11: Duplicate email registration is rejected (409)
    // -------------------------------------------------------------------------
    const dupEmailRes = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        fullName: 'Another Person',
        username: 'different_user_name',
        email: testUser.email,
        password: 'Password123!',
        confirmPassword: 'Password123!',
        agreeTerms: true
      })
    });

    assert(
      dupEmailRes.status === 409 && dupEmailRes.data.success === false,
      'TEST 11: Duplicate verified email registration is rejected with 409'
    );

    // -------------------------------------------------------------------------
    // TEST 12: Duplicate username registration is rejected (409)
    // -------------------------------------------------------------------------
    const dupUsernameRes = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        fullName: 'Another Person',
        username: testUser.username,
        email: 'completely_new_email@example.com',
        password: 'Password123!',
        confirmPassword: 'Password123!',
        agreeTerms: true
      })
    });

    assert(
      dupUsernameRes.status === 409 && dupUsernameRes.data.success === false,
      'TEST 12: Duplicate verified username registration is rejected with 409'
    );

  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  } finally {
    console.log('\n================================================================');
    console.log(`🎉 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED (TOTAL ${passed + failed} TESTS)`);
    console.log('================================================================\n');

    process.exit(failed > 0 ? 1 : 0);
  }
}

runDemoOtpTests();
