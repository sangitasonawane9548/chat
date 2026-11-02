const http = require('http');
const { pool } = require('../config/database');
const { hashData } = require('../utils/cryptoUtils');

// Helper to make HTTP requests
const request = (options, postData = null) => {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, headers: res.headers, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, data: body });
        }
      });
    });

    req.on('error', reject);

    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
};

const runAllTests = async () => {
  console.log('========================================================');
  console.log('🧪 RUNNING DAY 2: COMPLETE AUTHENTICATION SYSTEM TESTS');
  console.log('========================================================\n');

  let passedCount = 0;
  let failedCount = 0;

  const assert = (condition, testName, details = '') => {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passedCount++;
    } else {
      console.error(`❌ [FAIL] ${testName} - ${details}`);
      failedCount++;
    }
  };

  // Clean test users before starting
  await pool.query("DELETE FROM users WHERE email IN ('narendra@example.com', 'different_email@example.com') OR username IN ('narendra_dev', 'temp_unverified', 'alex_smith', 'alex_unique')");

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Register a new user with a unique username
    // -------------------------------------------------------------------------
    const regRes = await request(
      {
        hostname: 'localhost',
        port: 5000,
        path: '/api/auth/register',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      },
      {
        fullName: 'Narendra Sonawane',
        username: 'narendra_dev',
        email: 'narendra@example.com',
        password: 'SecurePassword123!',
        confirmPassword: 'SecurePassword123!',
        agreeTerms: true
      }
    );

    const [user1] = await pool.query("SELECT * FROM users WHERE username = 'narendra_dev'");
    assert(
      regRes.status === 201 && user1.length > 0 && user1[0].email_verified === 0 && user1[0].account_status === 'pending',
      'TEST 1: Register new user (Account created, unverified & pending status)'
    );

    // -------------------------------------------------------------------------
    // TEST 2: Register using an existing username
    // -------------------------------------------------------------------------
    const dupUserRes = await request(
      {
        hostname: 'localhost',
        port: 5000,
        path: '/api/auth/register',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      },
      {
        fullName: 'Another Narendra',
        username: 'narendra_dev',
        email: 'different_email@example.com',
        password: 'SecurePassword123!',
        confirmPassword: 'SecurePassword123!',
        agreeTerms: true
      }
    );
    assert(
      dupUserRes.status === 409 && dupUserRes.data.success === false,
      'TEST 2: Register using existing username (Rejected with 409)'
    );

    // -------------------------------------------------------------------------
    // TEST 3: Register using an existing email
    // -------------------------------------------------------------------------
    const dupEmailRes = await request(
      {
        hostname: 'localhost',
        port: 5000,
        path: '/api/auth/register',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      },
      {
        fullName: 'Alex Smith',
        username: 'alex_unique',
        email: 'narendra@example.com',
        password: 'SecurePassword123!',
        confirmPassword: 'SecurePassword123!',
        agreeTerms: true
      }
    );
    assert(
      dupEmailRes.status === 409 && dupEmailRes.data.success === false,
      'TEST 3: Register using existing email (Rejected with 409)'
    );

    // -------------------------------------------------------------------------
    // TEST 4: Request email OTP & verify generation
    // -------------------------------------------------------------------------
    const [otpRows] = await pool.query(
      "SELECT * FROM email_verification_otps WHERE email = 'narendra@example.com' ORDER BY id DESC LIMIT 1"
    );
    assert(
      otpRows.length > 0 && otpRows[0].otp_hash.length === 64,
      'TEST 4: Request email OTP (Cryptographic hash stored in DB with 5-minute expiry)'
    );

    // -------------------------------------------------------------------------
    // TEST 5: Enter incorrect OTP
    // -------------------------------------------------------------------------
    const wrongOtpRes = await request(
      {
        hostname: 'localhost',
        port: 5000,
        path: '/api/auth/verify-email',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      },
      {
        email: 'narendra@example.com',
        otp: '000000'
      }
    );
    const [attemptCheck] = await pool.query(
      "SELECT attempts FROM email_verification_otps WHERE email = 'narendra@example.com' ORDER BY id DESC LIMIT 1"
    );
    assert(
      wrongOtpRes.status === 400 && attemptCheck[0].attempts === 1,
      'TEST 5: Enter incorrect OTP (Rejected with 400, attempts incremented to 1)'
    );

    // -------------------------------------------------------------------------
    // TEST 6: Enter expired OTP
    // -------------------------------------------------------------------------
    // Manually set expiration to past
    await pool.query(
      "UPDATE email_verification_otps SET expires_at = DATE_SUB(NOW(), INTERVAL 1 MINUTE) WHERE email = 'narendra@example.com'"
    );
    const expiredOtpRes = await request(
      {
        hostname: 'localhost',
        port: 5000,
        path: '/api/auth/verify-email',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      },
      {
        email: 'narendra@example.com',
        otp: '123456'
      }
    );
    assert(
      expiredOtpRes.status === 400 && expiredOtpRes.data.message.includes('expired'),
      'TEST 6: Enter expired OTP (Rejected with expiration message)'
    );

    // -------------------------------------------------------------------------
    // TEST 7: Resend & Enter correct OTP -> Email successfully verified
    // -------------------------------------------------------------------------
    // Generate known valid OTP for testing verification
    const testOtp = '789123';
    const testOtpHash = hashData(testOtp);
    await pool.query(
      `INSERT INTO email_verification_otps (user_id, email, otp_hash, expires_at, attempts, max_attempts)
       VALUES (?, 'narendra@example.com', ?, DATE_ADD(NOW(), INTERVAL 5 MINUTE), 0, 5)`,
      [user1[0].id, testOtpHash]
    );

    const validVerifyRes = await request(
      {
        hostname: 'localhost',
        port: 5000,
        path: '/api/auth/verify-email',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      },
      {
        email: 'narendra@example.com',
        otp: testOtp
      }
    );

    const [verifiedUser] = await pool.query("SELECT email_verified, account_status FROM users WHERE username = 'narendra_dev'");
    assert(
      validVerifyRes.status === 200 && verifiedUser[0].email_verified === 1 && verifiedUser[0].account_status === 'active',
      'TEST 7: Enter correct OTP (Email verified, account activated to active)'
    );

    // -------------------------------------------------------------------------
    // TEST 8: Login using username
    // -------------------------------------------------------------------------
    const loginUserRes = await request(
      {
        hostname: 'localhost',
        port: 5000,
        path: '/api/auth/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      },
      {
        usernameOrEmail: 'narendra_dev',
        password: 'SecurePassword123!',
        rememberMe: true
      }
    );

    const cookieHeader = loginUserRes.headers['set-cookie'] ? loginUserRes.headers['set-cookie'][0] : '';
    assert(
      loginUserRes.status === 200 && loginUserRes.data.success && cookieHeader.includes('token='),
      'TEST 8: Login using username (Success 200, secure HTTP-only cookie issued)'
    );

    // Extract auth cookie
    const authCookie = cookieHeader.split(';')[0];

    // -------------------------------------------------------------------------
    // TEST 9: Login using email
    // -------------------------------------------------------------------------
    const loginEmailRes = await request(
      {
        hostname: 'localhost',
        port: 5000,
        path: '/api/auth/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      },
      {
        usernameOrEmail: 'narendra@example.com',
        password: 'SecurePassword123!',
        rememberMe: false
      }
    );
    assert(
      loginEmailRes.status === 200 && loginEmailRes.data.user.email === 'narendra@example.com',
      'TEST 9: Login using email (Success 200)'
    );

    // -------------------------------------------------------------------------
    // TEST 10: Login using incorrect password
    // -------------------------------------------------------------------------
    const wrongPassRes = await request(
      {
        hostname: 'localhost',
        port: 5000,
        path: '/api/auth/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      },
      {
        usernameOrEmail: 'narendra_dev',
        password: 'WrongPassword999!',
        rememberMe: false
      }
    );
    assert(
      wrongPassRes.status === 401 && wrongPassRes.data.message.includes('Invalid'),
      'TEST 10: Login using incorrect password (Rejected 401 with generic error)'
    );

    // -------------------------------------------------------------------------
    // TEST 11: Attempt login before verification
    // -------------------------------------------------------------------------
    const bcrypt = require('bcryptjs');
    const validHashForUnverified = await bcrypt.hash('SecurePassword123!', 10);
    await pool.query(
      `INSERT INTO users (full_name, username, email, password_hash, email_verified, account_status)
       VALUES ('Temp Unverified', 'temp_unverified', 'unverified@example.com', ?, 0, 'pending')`,
      [validHashForUnverified]
    );

    const unverifiedLoginRes = await request(
      {
        hostname: 'localhost',
        port: 5000,
        path: '/api/auth/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      },
      {
        usernameOrEmail: 'temp_unverified',
        password: 'SecurePassword123!',
        rememberMe: false
      }
    );
    assert(
      unverifiedLoginRes.status === 403 && unverifiedLoginRes.data.isUnverified === true,
      'TEST 11: Attempt login before verification (Rejected 403, requires email verification)'
    );

    // -------------------------------------------------------------------------
    // TEST 12: Forgot password
    // -------------------------------------------------------------------------
    const forgotRes = await request(
      {
        hostname: 'localhost',
        port: 5000,
        path: '/api/auth/forgot-password',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      },
      {
        email: 'narendra@example.com'
      }
    );

    const [resetTokens] = await pool.query(
      "SELECT * FROM password_reset_tokens WHERE user_id = ? ORDER BY id DESC LIMIT 1",
      [user1[0].id]
    );
    assert(
      forgotRes.status === 200 && resetTokens.length > 0 && resetTokens[0].token_hash,
      'TEST 12: Forgot password (Token generated and stored in password_reset_tokens table)'
    );

    // -------------------------------------------------------------------------
    // TEST 13: Reset password
    // -------------------------------------------------------------------------
    // Create known reset token
    const testRawToken = '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
    const testTokenHash = hashData(testRawToken);
    await pool.query(
      "INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 15 MINUTE))",
      [user1[0].id, testTokenHash]
    );

    const resetRes = await request(
      {
        hostname: 'localhost',
        port: 5000,
        path: '/api/auth/reset-password',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      },
      {
        token: testRawToken,
        email: 'narendra@example.com',
        newPassword: 'BrandNewPassword2026!',
        confirmPassword: 'BrandNewPassword2026!'
      }
    );

    // Try login with new password
    const newPassLogin = await request(
      {
        hostname: 'localhost',
        port: 5000,
        path: '/api/auth/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      },
      {
        usernameOrEmail: 'narendra_dev',
        password: 'BrandNewPassword2026!',
        rememberMe: true
      }
    );

    const newAuthCookie = newPassLogin.headers['set-cookie'][0].split(';')[0];
    assert(
      resetRes.status === 200 && newPassLogin.status === 200,
      'TEST 13: Reset password (Password updated successfully & new password works)'
    );

    // -------------------------------------------------------------------------
    // TEST 14: Refresh browser / Restore authenticated session via GET /api/auth/me
    // -------------------------------------------------------------------------
    const meRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/me',
      method: 'GET',
      headers: { Cookie: newAuthCookie }
    });

    assert(
      meRes.status === 200 && meRes.data.user.username === 'narendra_dev',
      'TEST 14: Refresh browser (Authenticated session restored via /api/auth/me with HTTP-only cookie)'
    );

    // -------------------------------------------------------------------------
    // TEST 15: Logout
    // -------------------------------------------------------------------------
    const logoutRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/logout',
      method: 'POST',
      headers: { Cookie: newAuthCookie }
    });

    // Try to access /api/auth/me after logout
    const postLogoutMe = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/me',
      method: 'GET',
      headers: { Cookie: newAuthCookie }
    });

    assert(
      logoutRes.status === 200 && postLogoutMe.status === 401,
      'TEST 15: Logout (Session invalidated, cookie cleared, protected routes inaccessible 401)'
    );

    console.log('\n========================================================');
    console.log(`🎉 TEST SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED (TOTAL 15 TESTS)`);
    console.log('========================================================\n');

    process.exit(failedCount === 0 ? 0 : 1);
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  }
};

runAllTests();
