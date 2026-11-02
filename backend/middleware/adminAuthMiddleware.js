const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');

const ADMIN_ROLES = ['super_admin', 'admin', 'moderator', 'support_admin'];

/**
 * Admin Authentication Middleware
 * Enforces that only authenticated users with valid administrative roles can access admin endpoints.
 * Rejects standard users with HTTP 403.
 * Rejects unauthenticated callers with HTTP 401.
 */
const requireAdminAuth = async (req, res, next) => {
  try {
    // 1. Extract admin token from cookies or Authorization header
    let token = req.cookies?.admin_token || req.cookies?.token;

    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please sign in to the Admin Console.',
        code: 'UNAUTHENTICATED'
      });
    }

    // 2. Verify JWT signature
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'super_secret_dev_jwt_key_aether_platform_2026');
    } catch (err) {
      res.clearCookie('admin_token', {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production'
      });
      return res.status(401).json({
        success: false,
        message: 'Admin session has expired or is invalid. Please sign in again.',
        code: 'SESSION_EXPIRED'
      });
    }

    const { userId } = decoded;

    // 3. Load user & verify administrative role in database (never trust token claim alone)
    const [users] = await pool.query(
      `SELECT id, full_name, username, email, email_verified, account_status, role, created_at
       FROM users 
       WHERE id = ?`,
      [userId]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Admin account not found.',
        code: 'ACCOUNT_NOT_FOUND'
      });
    }

    const user = users[0];

    // 4. Role verification: standard users are strictly forbidden (403)
    if (!ADMIN_ROLES.includes(user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Administrator privileges required.',
        code: 'FORBIDDEN_NOT_ADMIN'
      });
    }

    // 5. Account standing checks
    if (user.account_status === 'suspended') {
      return res.status(403).json({
        success: false,
        message: 'This administrative account has been suspended.',
        code: 'ACCOUNT_SUSPENDED'
      });
    }

    if (user.account_status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Administrative account is inactive.',
        code: 'ACCOUNT_INACTIVE'
      });
    }

    // 6. Fetch permissions from admin_roles
    let permissions = [];
    if (user.role === 'super_admin' || user.role === 'admin') {
      permissions = ['*'];
    } else {
      const [roleRows] = await pool.query(
        'SELECT permissions FROM admin_roles WHERE role_name = ?',
        [user.role]
      );
      if (roleRows.length > 0 && roleRows[0].permissions) {
        try {
          permissions = typeof roleRows[0].permissions === 'string'
            ? JSON.parse(roleRows[0].permissions)
            : roleRows[0].permissions;
        } catch (e) {
          permissions = [];
        }
      }
    }

    // Attach verified admin to request
    req.admin = {
      id: user.id,
      full_name: user.full_name,
      username: user.username,
      email: user.email,
      role: user.role,
      permissions
    };

    req.user = req.admin;

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Require specific permission or Super Admin status
 */
const requireAdminPermission = (requiredPermission) => {
  return (req, res, next) => {
    if (!req.admin) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please sign in to the Admin Console.',
        code: 'UNAUTHENTICATED'
      });
    }

    const { role, permissions } = req.admin;

    // Super Admin has master bypass
    if (role === 'super_admin' || role === 'admin' || (Array.isArray(permissions) && permissions.includes('*'))) {
      return next();
    }

    const requiredList = Array.isArray(requiredPermission) ? requiredPermission : [requiredPermission];
    const hasPermission = requiredList.some(p => permissions.includes(p));

    if (hasPermission) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: `Forbidden. You do not possess the required permission: ${requiredList.join(' or ')}.`,
      code: 'FORBIDDEN_INSUFFICIENT_PERMISSIONS'
    });
  };
};

/**
 * Require specific role (e.g. Super Admin only operations)
 */
const requireAdminRole = (allowedRoles) => {
  const rolesList = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  return (req, res, next) => {
    if (!req.admin) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please sign in to the Admin Console.',
        code: 'UNAUTHENTICATED'
      });
    }

    const { role } = req.admin;

    if (role === 'super_admin' || rolesList.includes(role)) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: `Forbidden. This operation requires one of the following administrative roles: ${rolesList.join(', ')}.`,
      code: 'FORBIDDEN_ROLE_RESTRICTED'
    });
  };
};

/**
 * Helper to record administrative audit events
 */
const logAdminAction = async ({ adminId, action, targetType, targetId = null, details = {}, ip = null }) => {
  try {
    await pool.query(
      `INSERT INTO admin_audit_logs (admin_id, action, target_type, target_id, details, ip_address)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        adminId,
        action,
        targetType,
        targetId ? String(targetId) : null,
        JSON.stringify(details),
        ip || '127.0.0.1'
      ]
    );
  } catch (err) {
    console.error('[AdminAuditLog] Failed to record audit action:', err);
  }
};

module.exports = {
  ADMIN_ROLES,
  requireAdminAuth,
  requireAdminPermission,
  requireAdminRole,
  logAdminAction
};
