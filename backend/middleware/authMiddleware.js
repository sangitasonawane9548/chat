const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');

/**
 * Protect private API routes with JWT and active database session validation
 */
const requireAuth = async (req, res, next) => {
  try {
    // 1. Extract token from HTTP-only cookie or Authorization header
    let token = req.cookies?.token;

    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please sign in.'
      });
    }

    // 2. Verify JWT signature
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'super_secret_dev_jwt_key_aether_platform_2026');
    } catch (err) {
      // Clear invalid cookie
      res.clearCookie('token', {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production'
      });
      return res.status(401).json({
        success: false,
        message: 'Session has expired or is invalid. Please sign in again.'
      });
    }

    const { userId, sessionId } = decoded;

    // 3. Verify session in user_sessions table
    const [sessions] = await pool.query(
      `SELECT id, user_id, expires_at, revoked_at 
       FROM user_sessions 
       WHERE id = ? AND user_id = ? AND revoked_at IS NULL AND expires_at > NOW()`,
      [sessionId, userId]
    );

    if (sessions.length === 0) {
      res.clearCookie('token');
      return res.status(401).json({
        success: false,
        message: 'Session has been revoked or expired. Please sign in again.'
      });
    }

    // 4. Load user and profile details
    const [users] = await pool.query(
      `SELECT u.id, u.full_name, u.username, u.email, u.email_verified, u.account_status, u.role, u.created_at,
              p.profile_picture, p.bio, p.is_online, p.last_seen
       FROM users u
       LEFT JOIN user_profiles p ON u.id = p.user_id
       WHERE u.id = ?`,
      [userId]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'User account not found.'
      });
    }

    const user = users[0];

    // 5. Account status checks
    if (user.account_status === 'suspended') {
      return res.status(403).json({
        success: false,
        message: 'This account has been suspended. Please contact support.'
      });
    }

    if (user.account_status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Account is not currently active.'
      });
    }

    // Attach sanitized user and session identifier to request
    req.user = {
      id: user.id,
      full_name: user.full_name,
      username: user.username,
      email: user.email,
      role: user.role,
      email_verified: Boolean(user.email_verified),
      profile_picture: user.profile_picture,
      bio: user.bio,
      is_online: Boolean(user.is_online),
      created_at: user.created_at
    };
    req.sessionId = sessionId;

    next();
  } catch (error) {
    console.error('[Auth Middleware Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server authentication error'
    });
  }
};

module.exports = {
  requireAuth
};

