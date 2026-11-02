const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');
const { generateSecureOTP, hashData, generateRandomToken } = require('../utils/cryptoUtils');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../services/emailService');

const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,20}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BCRYPT_SALT_ROUNDS = 12;

/**
 * Check if demo OTP mode is active
 * Safety rule: In production environment, demo mode is strictly forbidden.
 * @returns {boolean}
 */
const isDemoOtpMode = () => {
  if (process.env.NODE_ENV === 'production') {
    return false;
  }
  return (process.env.OTP_MODE || '').toLowerCase() === 'demo';
};

/**
 * 1. Check Username Availability
 * GET /api/auth/check-username?username=narendra_dev
 */
const checkUsername = async (req, res, next) => {
  try {
    const rawUsername = req.query.username;

    if (!rawUsername) {
      return res.status(400).json({
        success: false,
        available: false,
        message: 'Username parameter is required'
      });
    }

    const username = rawUsername.trim();

    if (!USERNAME_REGEX.test(username)) {
      return res.status(200).json({
        success: true,
        available: false,
        message: 'Username must be 3-20 characters long and contain only letters, numbers, and underscores'
      });
    }

    // Check case-insensitive uniqueness
    const [rows] = await pool.query(
      'SELECT id FROM users WHERE LOWER(username) = LOWER(?) LIMIT 1',
      [username]
    );

    if (rows.length > 0) {
      return res.status(200).json({
        success: true,
        available: false,
        message: 'This username is already taken'
      });
    }

    return res.status(200).json({
      success: true,
      available: true,
      message: 'Username is available'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 2. User Registration
 * POST /api/auth/register
 */
const register = async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const { fullName, username, email, password, confirmPassword, agreeTerms, profilePicture, role } = req.body;

    // Strict Role Escalation Prevention: Public registration can NEVER create admin accounts
    if (role && role !== 'user') {
      return res.status(403).json({
        success: false,
        message: 'Public registration for administrative accounts is strictly forbidden.'
      });
    }

    // Validation
    if (!fullName || !fullName.trim()) {
      return res.status(400).json({ success: false, message: 'Full name is required' });
    }

    const trimmedUsername = (username || '').trim();
    if (!trimmedUsername || !USERNAME_REGEX.test(trimmedUsername)) {
      return res.status(400).json({
        success: false,
        message: 'Username must be 3-20 characters and contain only letters, numbers, and underscores (no spaces)'
      });
    }

    const normalizedEmail = (email || '').trim().toLowerCase();
    if (!normalizedEmail || !EMAIL_REGEX.test(normalizedEmail)) {
      return res.status(400).json({ success: false, message: 'Please provide a valid email address' });
    }

    if (!password || password.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters long' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Passwords do not match' });
    }

    if (!agreeTerms) {
      return res.status(400).json({ success: false, message: 'You must agree to the Terms and Conditions' });
    }

    // Check duplicate username
    const [existingUsernames] = await connection.query(
      'SELECT id FROM users WHERE LOWER(username) = LOWER(?) LIMIT 1',
      [trimmedUsername]
    );
    if (existingUsernames.length > 0) {
      return res.status(409).json({ success: false, message: 'This username is already registered' });
    }

    // Check duplicate email
    const [existingEmails] = await connection.query(
      'SELECT id, email_verified FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1',
      [normalizedEmail]
    );

    if (existingEmails.length > 0) {
      const existingUser = existingEmails[0];
      if (existingUser.email_verified) {
        return res.status(409).json({
          success: false,
          message: 'An account with this email address already exists. Please log in.'
        });
      } else {
        // Unverified account exists with this email: inform user to verify
        return res.status(409).json({
          success: false,
          isUnverified: true,
          email: normalizedEmail,
          message: 'An account with this email is pending verification. Please verify your email with the 6-digit code.'
        });
      }
    }

    // Hash password securely with bcrypt
    const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

    // Generate 6-digit OTP (Demo mode: 123456, Production: cryptographically secure random)
    const demoMode = isDemoOtpMode();
    const otp = demoMode ? '123456' : generateSecureOTP();
    const otpHash = hashData(otp);

    await connection.beginTransaction();

    // Create new pending registration record
    const [userResult] = await connection.query(
      `INSERT INTO users (full_name, username, email, password_hash, email_verified, account_status, role)
       VALUES (?, ?, ?, ?, 0, 'pending', 'user')`,
      [fullName.trim(), trimmedUsername, normalizedEmail, passwordHash]
    );
    const userId = userResult.insertId;

    // Initialize user profile
    await connection.query(
      `INSERT INTO user_profiles (user_id, profile_picture, bio, is_online)
       VALUES (?, ?, '', 0)`,
      [userId, profilePicture || null]
    );

    // Initialize user settings
    await connection.query(
      `INSERT INTO user_settings (user_id, theme, show_last_seen, show_online_status, show_read_receipts, allow_username_search, call_permissions)
       VALUES (?, 'dark', 1, 1, 1, 1, 'everyone')`,
      [userId]
    );

    // Store OTP record with 15-minute expiration
    await connection.query(
      `INSERT INTO email_verification_otps (user_id, email, otp_hash, expires_at, attempts, max_attempts)
       VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 15 MINUTE), 0, 5)`,
      [userId, normalizedEmail, otpHash]
    );

    await connection.commit();

    // Send email or log demo instructions
    if (!demoMode) {
      await sendVerificationEmail(normalizedEmail, otp, fullName.trim());
    } else {
      console.log(`[MELT Auth - DEMO OTP MODE] Fixed verification OTP for ${normalizedEmail} is: 123456`);
    }

    return res.status(201).json({
      success: true,
      message: demoMode
        ? 'Account created! Demo Mode active: Use code 123456 to verify.'
        : 'Account created successfully. A 6-digit verification code has been sent to your email.',
      email: normalizedEmail,
      username: trimmedUsername,
      isDemo: demoMode
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
};

/**
 * 3. Verify Email OTP
 * POST /api/auth/verify-email
 */
const verifyEmail = async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const { email, otp } = req.body;

    const normalizedEmail = (email || '').trim().toLowerCase();
    const cleanOtp = (otp || '').trim();

    if (!normalizedEmail || !cleanOtp || cleanOtp.length !== 6) {
      return res.status(400).json({
        success: false,
        message: 'Valid email and 6-digit verification code are required'
      });
    }

    // Lookup user
    const [users] = await connection.query(
      'SELECT id, email_verified, account_status FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1',
      [normalizedEmail]
    );

    if (users.length === 0) {
      return res.status(404).json({ success: false, message: 'Account not found with this email' });
    }

    const user = users[0];
    if (user.email_verified) {
      return res.status(200).json({
        success: true,
        alreadyVerified: true,
        message: 'Email is already verified. You can sign in.'
      });
    }

    // Fetch latest active OTP record for this user
    const [otps] = await connection.query(
      `SELECT id, otp_hash, expires_at, attempts, max_attempts 
       FROM email_verification_otps 
       WHERE user_id = ? AND verified_at IS NULL 
       ORDER BY id DESC LIMIT 1`,
      [user.id]
    );

    if (otps.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No active verification code found. Please request a new one.'
      });
    }

    const otpRecord = otps[0];

    // Check max attempts
    if (otpRecord.attempts >= otpRecord.max_attempts) {
      return res.status(400).json({
        success: false,
        message: 'Too many incorrect attempts. Please request a new verification code.'
      });
    }

    // Check expiration
    const now = new Date();
    const expiresAt = new Date(otpRecord.expires_at);
    if (now > expiresAt) {
      return res.status(400).json({
        success: false,
        message: 'Verification code has expired. Please request a new OTP.'
      });
    }

    // Validate OTP against demo or stored hash
    const demoMode = isDemoOtpMode();
    const submittedHash = hashData(cleanOtp);
    const isValid = demoMode
      ? (cleanOtp === '123456' || submittedHash === otpRecord.otp_hash)
      : (submittedHash === otpRecord.otp_hash);

    if (!isValid) {
      await connection.query(
        'UPDATE email_verification_otps SET attempts = attempts + 1 WHERE id = ?',
        [otpRecord.id]
      );
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP. Please try again.'
      });
    }

    // OTP is valid! Activate account in MySQL transaction
    await connection.beginTransaction();

    // Mark current OTP verified
    await connection.query(
      'UPDATE email_verification_otps SET verified_at = NOW() WHERE id = ?',
      [otpRecord.id]
    );

    // Invalidate any other prior unverified OTPs for this user
    await connection.query(
      'UPDATE email_verification_otps SET verified_at = NOW() WHERE user_id = ? AND verified_at IS NULL',
      [user.id]
    );

    // Activate user account and mark email verified
    await connection.query(
      "UPDATE users SET email_verified = 1, account_status = 'active' WHERE id = ?",
      [user.id]
    );

    // Ensure user profile exists
    await connection.query(
      `INSERT INTO user_profiles (user_id, profile_picture, bio, is_online)
       VALUES (?, NULL, '', 0)
       ON DUPLICATE KEY UPDATE user_id = user_id`,
      [user.id]
    );

    // Ensure user settings exist
    await connection.query(
      `INSERT INTO user_settings (user_id, theme, show_last_seen, show_online_status, show_read_receipts, allow_username_search, call_permissions)
       VALUES (?, 'dark', 1, 1, 1, 1, 'everyone')
       ON DUPLICATE KEY UPDATE user_id = user_id`,
      [user.id]
    );

    await connection.commit();

    return res.status(200).json({
      success: true,
      message: 'Email verified successfully'
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
};

/**
 * 4. Resend Verification OTP
 * POST /api/auth/resend-otp
 */
const resendOtp = async (req, res, next) => {
  try {
    const { email } = req.body;
    const normalizedEmail = (email || '').trim().toLowerCase();

    if (!normalizedEmail || !EMAIL_REGEX.test(normalizedEmail)) {
      return res.status(400).json({ success: false, message: 'Please provide a valid email address' });
    }

    const [users] = await pool.query(
      'SELECT id, full_name, email_verified FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1',
      [normalizedEmail]
    );

    if (users.length === 0) {
      return res.status(404).json({ success: false, message: 'Account not found with this email' });
    }

    const user = users[0];
    if (user.email_verified) {
      return res.status(400).json({
        success: false,
        message: 'Your email is already verified. Please sign in.'
      });
    }

    const demoMode = isDemoOtpMode();
    const cooldownSeconds = demoMode ? 0 : 60;

    // Cooldown check
    if (cooldownSeconds > 0) {
      const [recentOtps] = await pool.query(
        `SELECT created_at FROM email_verification_otps 
         WHERE user_id = ? AND created_at > DATE_SUB(NOW(), INTERVAL ? SECOND)
         ORDER BY id DESC LIMIT 1`,
        [user.id, cooldownSeconds]
      );

      if (recentOtps.length > 0) {
        return res.status(429).json({
          success: false,
          message: `Please wait ${cooldownSeconds} seconds before requesting a new code.`
        });
      }
    }

    // Invalidate prior unverified OTPs
    await pool.query(
      'UPDATE email_verification_otps SET verified_at = NOW() WHERE user_id = ? AND verified_at IS NULL',
      [user.id]
    );

    // Generate new OTP (Demo mode: 123456, Production: random 6 digits)
    const newOtp = demoMode ? '123456' : generateSecureOTP();
    const newOtpHash = hashData(newOtp);

    await pool.query(
      `INSERT INTO email_verification_otps (user_id, email, otp_hash, expires_at, attempts, max_attempts)
       VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 15 MINUTE), 0, 5)`,
      [user.id, normalizedEmail, newOtpHash]
    );

    if (!demoMode) {
      await sendVerificationEmail(normalizedEmail, newOtp, user.full_name);
    } else {
      console.log(`[MELT Auth - DEMO OTP MODE] Resent fixed verification OTP for ${normalizedEmail}: 123456`);
    }

    return res.status(200).json({
      success: true,
      message: demoMode
        ? 'Demo mode active: Use code 123456 to verify.'
        : 'A new 6-digit verification code has been dispatched to your email.',
      isDemo: demoMode
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 5. User Login
 * POST /api/auth/login
 */
const login = async (req, res, next) => {
  try {
    const { usernameOrEmail, password, rememberMe } = req.body;

    if (!usernameOrEmail || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username/email and password are required'
      });
    }

    const identifier = usernameOrEmail.trim().toLowerCase();

    // Query user by username or email
    const [users] = await pool.query(
      `SELECT u.id, u.full_name, u.username, u.email, u.password_hash, u.email_verified, u.account_status, u.role,
              p.profile_picture, p.bio
       FROM users u
       LEFT JOIN user_profiles p ON u.id = p.user_id
       WHERE LOWER(u.username) = ? OR LOWER(u.email) = ?
       LIMIT 1`,
      [identifier, identifier]
    );

    // Generic error message for security
    const INVALID_CREDENTIALS_MSG = 'Invalid username/email or password';

    if (users.length === 0) {
      return res.status(401).json({ success: false, message: INVALID_CREDENTIALS_MSG });
    }

    const user = users[0];

    // Verify bcrypt password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: INVALID_CREDENTIALS_MSG });
    }

    // Check verification status
    if (!user.email_verified) {
      return res.status(403).json({
        success: false,
        isUnverified: true,
        email: user.email,
        message: 'Please verify your email address with the 6-digit code before signing in.'
      });
    }

    // Check account status
    if (user.account_status === 'suspended') {
      return res.status(403).json({
        success: false,
        message: 'This account has been suspended. Please contact platform support.'
      });
    }

    if (user.account_status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Your account is pending review or inactive.'
      });
    }

    // Create session in user_sessions
    const sessionToken = generateRandomToken(32);
    const sessionTokenHash = hashData(sessionToken);
    const sessionDays = rememberMe ? 30 : 7;
    const deviceInfo = (req.headers['user-agent'] || 'Unknown Device').substring(0, 250);
    const ipAddress = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim().substring(0, 45);

    const [sessionResult] = await pool.query(
      `INSERT INTO user_sessions (user_id, session_token_hash, device_info, ip_address, expires_at)
       VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? DAY))`,
      [user.id, sessionTokenHash, deviceInfo, ipAddress, sessionDays]
    );

    const sessionId = sessionResult.insertId;

    // Sign JWT
    const jwtSecret = process.env.JWT_SECRET || 'super_secret_dev_jwt_key_aether_platform_2026';
    const token = jwt.sign(
      { userId: user.id, username: user.username, sessionId },
      jwtSecret,
      { expiresIn: `${sessionDays}d` }
    );

    // Set secure HTTP-only cookie
    const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https' || process.env.NODE_ENV === 'production';
    res.cookie('token', token, {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'lax',
      maxAge: sessionDays * 24 * 60 * 60 * 1000
    });

    return res.status(200).json({
      success: true,
      message: 'Logged in successfully',
      token,
      user: {
        id: user.id,
        full_name: user.full_name,
        username: user.username,
        email: user.email,
        email_verified: true,
        role: user.role,
        profile_picture: user.profile_picture,
        bio: user.bio
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 6. Get Current Authenticated User
 * GET /api/auth/me
 */
const getMe = async (req, res) => {
  return res.status(200).json({
    success: true,
    user: req.user
  });
};

/**
 * 7. User Logout
 * POST /api/auth/logout
 */
const logout = async (req, res, next) => {
  try {
    if (req.sessionId) {
      await pool.query(
        'UPDATE user_sessions SET revoked_at = NOW() WHERE id = ?',
        [req.sessionId]
      );
    }

    res.clearCookie('token', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production'
    });

    return res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 8. Logout from all active sessions
 * POST /api/auth/logout-all
 */
const logoutAll = async (req, res, next) => {
  try {
    await pool.query(
      'UPDATE user_sessions SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL',
      [req.user.id]
    );

    res.clearCookie('token', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production'
    });

    return res.status(200).json({
      success: true,
      message: 'All sessions revoked successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 9. Get User's Active Sessions
 * GET /api/auth/sessions
 */
const getSessions = async (req, res, next) => {
  try {
    const [sessions] = await pool.query(
      `SELECT id, device_info, ip_address, expires_at, created_at
       FROM user_sessions
       WHERE user_id = ? AND revoked_at IS NULL AND expires_at > NOW()
       ORDER BY id DESC`,
      [req.user.id]
    );

    const formattedSessions = sessions.map((s) => ({
      id: s.id,
      device_info: s.device_info,
      ip_address: s.ip_address,
      expires_at: s.expires_at,
      created_at: s.created_at,
      is_current: s.id === req.sessionId
    }));

    return res.status(200).json({
      success: true,
      sessions: formattedSessions
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 10. Forgot Password Request
 * POST /api/auth/forgot-password
 */
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const normalizedEmail = (email || '').trim().toLowerCase();

    // Generic response regardless of whether email exists to prevent enumeration
    const GENERIC_RESPONSE = {
      success: true,
      message: 'If that email address is registered, a password reset link has been sent.'
    };

    if (!normalizedEmail || !EMAIL_REGEX.test(normalizedEmail)) {
      return res.status(200).json(GENERIC_RESPONSE);
    }

    const [users] = await pool.query(
      'SELECT id, full_name, email FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1',
      [normalizedEmail]
    );

    if (users.length > 0) {
      const user = users[0];

      // Invalidate existing active reset tokens
      await pool.query(
        'UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL',
        [user.id]
      );

      // Generate 32-byte hex token
      const rawToken = generateRandomToken(32);
      const tokenHash = hashData(rawToken);

      // Insert reset token record valid for 15 minutes
      await pool.query(
        `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
         VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 15 MINUTE))`,
        [user.id, tokenHash]
      );

      // Send email
      await sendPasswordResetEmail(user.email, rawToken, user.full_name);
    }

    return res.status(200).json(GENERIC_RESPONSE);
  } catch (error) {
    next(error);
  }
};

/**
 * 11. Reset Password with Token
 * POST /api/auth/reset-password
 */
const resetPassword = async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const { token, email, newPassword, confirmPassword } = req.body;

    if (!token || !email || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Token, email, and new password are required'
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long'
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match'
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const tokenHash = hashData(token.trim());

    // Validate token and user
    const [rows] = await connection.query(
      `SELECT prt.id, prt.user_id, prt.expires_at, prt.used_at, u.email
       FROM password_reset_tokens prt
       JOIN users u ON prt.user_id = u.id
       WHERE prt.token_hash = ? AND LOWER(u.email) = LOWER(?) AND prt.used_at IS NULL`,
      [tokenHash, normalizedEmail]
    );

    if (rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired password reset link. Please request a new one.'
      });
    }

    const resetRecord = rows[0];

    // Check expiration
    if (new Date() > new Date(resetRecord.expires_at)) {
      return res.status(400).json({
        success: false,
        message: 'Password reset link has expired. Please request a new one.'
      });
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);

    await connection.beginTransaction();

    // Update password
    await connection.query(
      'UPDATE users SET password_hash = ? WHERE id = ?',
      [newPasswordHash, resetRecord.user_id]
    );

    // Invalidate reset token
    await connection.query(
      'UPDATE password_reset_tokens SET used_at = NOW() WHERE id = ?',
      [resetRecord.id]
    );

    // Revoke all existing sessions for security
    await connection.query(
      'UPDATE user_sessions SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL',
      [resetRecord.user_id]
    );

    await connection.commit();

    return res.status(200).json({
      success: true,
      message: 'Password has been reset successfully. You can now log in.'
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
};

/**
 * 12. Authenticated Change Password
 * POST /api/auth/change-password
 */
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Current and new password are required' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'New password must be at least 8 characters long' });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'New passwords do not match' });
    }

    const [users] = await pool.query(
      'SELECT password_hash FROM users WHERE id = ?',
      [req.user.id]
    );

    if (users.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const isMatch = await bcrypt.compare(currentPassword, users[0].password_hash);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect' });
    }

    const newHash = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);
    await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, req.user.id]);

    return res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  checkUsername,
  register,
  verifyEmail,
  resendOtp,
  login,
  getMe,
  logout,
  logoutAll,
  getSessions,
  forgotPassword,
  resetPassword,
  changePassword
};

