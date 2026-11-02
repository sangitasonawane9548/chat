const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');
const { logAdminAction } = require('../middleware/adminAuthMiddleware');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_dev_jwt_key_aether_platform_2026';

/**
 * 1. Admin Authentication
 */
exports.adminLogin = async (req, res, next) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Admin username and password are required.'
      });
    }

    const cleanIdentifier = username.trim().toLowerCase().replace(/^@/, '');

    // 1. Fetch user by username or email joined with profile
    const [users] = await pool.query(
      `SELECT u.id, u.full_name, u.username, u.email, u.password_hash, u.role, u.account_status,
              p.profile_picture, p.is_online
       FROM users u
       LEFT JOIN user_profiles p ON u.id = p.user_id
       WHERE LOWER(u.username) = ? OR LOWER(u.email) = ?`,
      [cleanIdentifier, cleanIdentifier]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid administrative credentials.'
      });
    }

    const user = users[0];

    // 2. Validate administrative role
    const adminRoles = ['super_admin', 'admin', 'moderator', 'support_admin'];
    if (!adminRoles.includes(user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You do not possess administrative permissions.'
      });
    }

    // 3. Check account standing
    if (user.account_status === 'suspended') {
      return res.status(403).json({
        success: false,
        message: 'This administrative account is suspended. Contact system root administrator.'
      });
    }

    // 4. Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      await logAdminAction({
        adminId: user.id,
        action: 'FAILED_ADMIN_LOGIN',
        targetType: 'admin_auth',
        targetId: user.id,
        details: { username: user.username, reason: 'Invalid password' },
        ip: req.ip || req.connection?.remoteAddress
      });

      return res.status(401).json({
        success: false,
        message: 'Invalid administrative credentials.'
      });
    }

    // 5. Generate Admin JWT Token
    const token = jwt.sign(
      { userId: user.id, role: user.role, type: 'admin_session' },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // 6. Set HTTP-only Cookie
    res.cookie('admin_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });

    // 7. Load permissions for role
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

    // 8. Log successful admin login
    await logAdminAction({
      adminId: user.id,
      action: 'ADMIN_LOGIN',
      targetType: 'admin_auth',
      targetId: user.id,
      details: { username: user.username, role: user.role },
      ip: req.ip || req.connection?.remoteAddress
    });

    return res.status(200).json({
      success: true,
      message: 'Admin console authenticated successfully.',
      token,
      admin: {
        id: user.id,
        full_name: user.full_name,
        username: user.username,
        email: user.email,
        role: user.role,
        profile_picture: user.profile_picture,
        permissions
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.adminGetMe = async (req, res, next) => {
  try {
    return res.status(200).json({
      success: true,
      admin: req.admin
    });
  } catch (error) {
    next(error);
  }
};

exports.adminLogout = async (req, res, next) => {
  try {
    if (req.admin?.id) {
      await logAdminAction({
        adminId: req.admin.id,
        action: 'ADMIN_LOGOUT',
        targetType: 'admin_auth',
        targetId: req.admin.id,
        details: { username: req.admin.username },
        ip: req.ip || req.connection?.remoteAddress
      });
    }

    res.clearCookie('admin_token', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production'
    });
    return res.status(200).json({
      success: true,
      message: 'Signed out of administrator console.'
    });
  } catch (error) {
    next(error);
  }
};

exports.changeAdminPassword = async (req, res, next) => {
  try {
    const adminId = req.admin.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required.'
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 8 characters long.'
      });
    }

    const [users] = await pool.query('SELECT password_hash FROM users WHERE id = ?', [adminId]);
    if (users.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const isMatch = await bcrypt.compare(currentPassword, users[0].password_hash);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, adminId]);

    await logAdminAction({
      adminId,
      action: 'ADMIN_PASSWORD_CHANGED',
      targetType: 'user',
      targetId: adminId,
      details: { username: req.admin.username },
      ip: req.ip || req.connection?.remoteAddress
    });

    return res.status(200).json({
      success: true,
      message: 'Password updated successfully.'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 2. Admin Dashboard Stats & Health Telemetry
 */
exports.getDashboardStats = async (req, res, next) => {
  try {
    const startTime = Date.now();

    const [
      [userStats],
      [activeToday],
      [onlineUsers],
      [groupStats],
      [messageStats],
      [directVsGroupMsg],
      [callStats],
      [statusStats],
      [reportStats],
      [suspendedStats]
    ] = await Promise.all([
      // Total users
      pool.query('SELECT COUNT(*) AS total FROM users'),
      // Active users today
      pool.query(
        `SELECT COUNT(DISTINCT user_id) AS total FROM (
           SELECT user_id FROM user_sessions WHERE created_at >= CURDATE()
           UNION
           SELECT user_id FROM user_profiles WHERE last_seen >= CURDATE()
         ) active_pool`
      ),
      // Online users
      pool.query('SELECT COUNT(*) AS total FROM user_profiles WHERE is_online = 1'),
      // Total groups & active groups
      pool.query('SELECT COUNT(*) AS total, SUM(CASE WHEN status = "active" THEN 1 ELSE 0 END) AS active_groups FROM `groups`'),
      // Total messages sent
      pool.query('SELECT COUNT(*) AS total FROM messages'),
      // Direct vs Group messages
      pool.query(
        `SELECT 
           COALESCE(SUM(CASE WHEN c.conversation_type = 'direct' THEN 1 ELSE 0 END), 0) AS direct_messages,
           COALESCE(SUM(CASE WHEN c.conversation_type = 'group' THEN 1 ELSE 0 END), 0) AS group_messages
         FROM messages m
         JOIN conversations c ON m.conversation_id = c.id`
      ),
      // Call statistics
      pool.query(
        `SELECT 
           COUNT(*) AS total_calls,
           COALESCE(SUM(CASE WHEN status = 'ongoing' THEN 1 ELSE 0 END), 0) AS active_calls,
           COALESCE(SUM(duration_seconds), 0) AS total_duration_seconds
         FROM calls`
      ),
      // Statuses/Stories
      pool.query(
        `SELECT 
           COUNT(*) AS total_statuses,
           COALESCE(SUM(CASE WHEN expires_at > NOW() AND deleted_at IS NULL THEN 1 ELSE 0 END), 0) AS active_statuses
         FROM statuses`
      ),
      // Pending and Total Reports
      pool.query(
        `SELECT 
           COUNT(*) AS total_reports,
           COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0) AS pending_reports,
           COALESCE(SUM(CASE WHEN status = 'under_review' THEN 1 ELSE 0 END), 0) AS under_review_reports,
           COALESCE(SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END), 0) AS resolved_reports
         FROM user_reports`
      ),
      // Suspended Users & Suspended Groups
      pool.query(
        `SELECT 
           (SELECT COUNT(*) FROM users WHERE account_status = 'suspended') AS suspended_users,
           (SELECT COUNT(*) FROM \`groups\` WHERE status = 'suspended') AS suspended_groups`
      )
    ]);

    const dbLatencyMs = Math.max(1, Date.now() - startTime);

    const uptimeSec = Math.floor(process.uptime());
    const days = Math.floor(uptimeSec / 86400);
    const hours = Math.floor((uptimeSec % 86400) / 3600);
    const minutes = Math.floor((uptimeSec % 3600) / 60);
    const uptimeString = `${days > 0 ? days + 'd ' : ''}${hours}h ${minutes}m`;

    const totalDurationMinutes = Math.round((callStats[0]?.total_duration_seconds || 0) / 60);

    return res.status(200).json({
      success: true,
      stats: {
        totalUsers: Number(userStats[0]?.total || 0),
        activeUsersToday: Number(activeToday[0]?.total || 0),
        onlineUsers: Number(onlineUsers[0]?.total || 0),
        offlineUsers: Math.max(0, Number(userStats[0]?.total || 0) - Number(onlineUsers[0]?.total || 0)),
        totalGroups: Number(groupStats[0]?.total || 0),
        activeGroups: Number(groupStats[0]?.active_groups || 0),
        totalMessagesSent: Number(messageStats[0]?.total || 0),
        directMessagesSent: Number(directVsGroupMsg[0]?.direct_messages || 0),
        groupMessagesSent: Number(directVsGroupMsg[0]?.group_messages || 0),
        totalCalls: Number(callStats[0]?.total_calls || 0),
        activeCalls: Number(callStats[0]?.active_calls || 0),
        totalCallMinutes: totalDurationMinutes,
        totalStatuses: Number(statusStats[0]?.total_statuses || 0),
        activeStatuses: Number(statusStats[0]?.active_statuses || 0),
        totalReports: Number(reportStats[0]?.total_reports || 0),
        pendingReports: Number(reportStats[0]?.pending_reports || 0),
        underReviewReports: Number(reportStats[0]?.under_review_reports || 0),
        resolvedReports: Number(reportStats[0]?.resolved_reports || 0),
        suspendedUsers: Number(suspendedStats[0]?.suspended_users || 0),
        suspendedGroups: Number(suspendedStats[0]?.suspended_groups || 0),
        serverUptime: uptimeString,
        systemStatus: 'healthy',
        dbLatency: `${dbLatencyMs}ms`
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 3. Dashboard Charts Telemetry
 */
exports.getDashboardCharts = async (req, res, next) => {
  try {
    const [regRows] = await pool.query(
      `SELECT DATE(created_at) AS date, COUNT(*) AS count
       FROM users
       WHERE created_at >= CURDATE() - INTERVAL 14 DAY
       GROUP BY DATE(created_at)
       ORDER BY date ASC`
    );

    const [msgRows] = await pool.query(
      `SELECT DATE(created_at) AS date, COUNT(*) AS count
       FROM messages
       WHERE created_at >= CURDATE() - INTERVAL 14 DAY
       GROUP BY DATE(created_at)
       ORDER BY date ASC`
    );

    const [callDistribution] = await pool.query(
      `SELECT call_type, COUNT(*) AS count, COALESCE(SUM(duration_seconds),0) AS total_duration
       FROM calls
       GROUP BY call_type`
    );

    return res.status(200).json({
      success: true,
      charts: {
        registrations: regRows,
        messagesVolume: msgRows,
        callDistribution
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 4. User Management
 */
exports.getUsers = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
    const offset = (page - 1) * limit;

    const { search = '', role = 'all', status = 'all', sortBy = 'created_at', sortOrder = 'DESC' } = req.query;

    const conditions = [];
    const params = [];

    if (search.trim()) {
      const q = `%${search.trim().replace(/^@/, '')}%`;
      conditions.push('(u.username LIKE ? OR u.full_name LIKE ? OR u.email LIKE ?)');
      params.push(q, q, q);
    }

    if (role !== 'all') {
      conditions.push('u.role = ?');
      params.push(role);
    }

    if (status !== 'all') {
      conditions.push('u.account_status = ?');
      params.push(status);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const [countResult] = await pool.query(
      `SELECT COUNT(*) AS total FROM users u ${whereClause}`,
      params
    );
    const total = countResult[0]?.total || 0;

    const allowedSortColumns = ['id', 'username', 'full_name', 'email', 'role', 'account_status', 'created_at'];
    const validSort = allowedSortColumns.includes(sortBy) ? `u.${sortBy}` : 'u.created_at';
    const validOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const query = `
      SELECT 
        u.id, 
        u.full_name, 
        u.username, 
        u.email, 
        u.email_verified, 
        u.account_status, 
        u.role, 
        u.created_at,
        p.profile_picture,
        p.bio,
        p.last_seen,
        p.is_online,
        (SELECT COUNT(*) FROM user_reports r WHERE r.reported_user_id = u.id) AS reports_count,
        (SELECT COUNT(*) FROM messages m WHERE m.sender_id = u.id) AS messages_sent
      FROM users u
      LEFT JOIN user_profiles p ON u.id = p.user_id
      ${whereClause}
      ORDER BY ${validSort} ${validOrder}
      LIMIT ? OFFSET ?
    `;

    const [users] = await pool.query(query, [...params, limit, offset]);

    return res.status(200).json({
      success: true,
      users: users.map(u => ({
        ...u,
        reports_count: Number(u.reports_count || 0),
        messages_sent: Number(u.messages_sent || 0),
        is_online: Boolean(u.is_online)
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.getUserDetails = async (req, res, next) => {
  try {
    const userId = req.params.id;

    const [users] = await pool.query(
      `SELECT u.id, u.full_name, u.username, u.email, u.email_verified,
              u.role, u.account_status, u.created_at, u.updated_at,
              p.profile_picture, p.bio, p.last_seen, p.is_online
       FROM users u
       LEFT JOIN user_profiles p ON u.id = p.user_id
       WHERE u.id = ?`,
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const user = users[0];

    // Groups joined
    const [groups] = await pool.query(
      `SELECT g.id, g.name, g.profile_image, gm.role AS member_role, gm.joined_at
       FROM group_members gm
       JOIN \`groups\` g ON gm.group_id = g.id
       WHERE gm.user_id = ?`,
      [userId]
    );

    // Reports filed against user
    const [reportsAgainst] = await pool.query(
      `SELECT r.id, r.reason, r.status, r.created_at, u.username AS reporter_username
       FROM user_reports r
       LEFT JOIN users u ON r.reporter_id = u.id
       WHERE r.reported_user_id = ?
       ORDER BY r.created_at DESC LIMIT 10`,
      [userId]
    );

    // Active sessions
    const [sessions] = await pool.query(
      `SELECT id, ip_address, device_info, expires_at, revoked_at, created_at
       FROM user_sessions
       WHERE user_id = ?
       ORDER BY created_at DESC LIMIT 5`,
      [userId]
    );

    return res.status(200).json({
      success: true,
      user,
      groups,
      reportsAgainst,
      sessions
    });
  } catch (error) {
    next(error);
  }
};

exports.updateUserStatus = async (req, res, next) => {
  try {
    const userId = req.params.id;
    const { status, reason } = req.body;

    if (!['active', 'suspended'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be "active" or "suspended".'
      });
    }

    const [targetUsers] = await pool.query('SELECT id, username, role, account_status FROM users WHERE id = ?', [userId]);
    if (targetUsers.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const targetUser = targetUsers[0];

    if (Number(userId) === Number(req.admin.id)) {
      return res.status(400).json({
        success: false,
        message: 'You cannot change the status of your own administrator account.'
      });
    }

    if (['super_admin', 'admin'].includes(targetUser.role) && req.admin.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Only a Super Administrator can suspend administrator accounts.'
      });
    }

    await pool.query('UPDATE users SET account_status = ? WHERE id = ?', [status, userId]);

    if (status === 'suspended') {
      await pool.query('UPDATE user_sessions SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL', [userId]);
    }

    await logAdminAction({
      adminId: req.admin.id,
      action: status === 'suspended' ? 'USER_SUSPENDED' : 'USER_REACTIVATED',
      targetType: 'user',
      targetId: userId,
      details: {
        username: targetUser.username,
        previousStatus: targetUser.account_status,
        newStatus: status,
        reason: reason || 'Administrative action'
      },
      ip: req.ip || req.connection?.remoteAddress
    });

    return res.status(200).json({
      success: true,
      message: `User @${targetUser.username} has been ${status === 'suspended' ? 'suspended' : 'reactivated'}.`,
      account_status: status
    });
  } catch (error) {
    next(error);
  }
};

exports.updateUserRole = async (req, res, next) => {
  try {
    const userId = req.params.id;
    const { role } = req.body;

    const validRoles = ['user', 'moderator', 'support_admin', 'admin', 'super_admin'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: `Invalid role. Must be one of: ${validRoles.join(', ')}`
      });
    }

    if (req.admin.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Only a Super Administrator can update user roles.'
      });
    }

    const [targetUsers] = await pool.query('SELECT id, username, role FROM users WHERE id = ?', [userId]);
    if (targetUsers.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const targetUser = targetUsers[0];

    if (Number(userId) === Number(req.admin.id) && role !== 'super_admin') {
      return res.status(400).json({
        success: false,
        message: 'You cannot demote your own Super Administrator account.'
      });
    }

    await pool.query('UPDATE users SET role = ? WHERE id = ?', [role, userId]);

    await logAdminAction({
      adminId: req.admin.id,
      action: 'USER_ROLE_PROMOTION',
      targetType: 'user',
      targetId: userId,
      details: {
        username: targetUser.username,
        oldRole: targetUser.role,
        newRole: role
      },
      ip: req.ip || req.connection?.remoteAddress
    });

    return res.status(200).json({
      success: true,
      message: `User @${targetUser.username} role updated to ${role}.`,
      role
    });
  } catch (error) {
    next(error);
  }
};

exports.deleteUser = async (req, res, next) => {
  try {
    const userId = req.params.id;

    if (req.admin.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Only a Super Administrator can permanently delete user accounts.'
      });
    }

    if (Number(userId) === Number(req.admin.id)) {
      return res.status(400).json({
        success: false,
        message: 'You cannot delete your own administrator account.'
      });
    }

    const [targetUsers] = await pool.query('SELECT id, username FROM users WHERE id = ?', [userId]);
    if (targetUsers.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const username = targetUsers[0].username;

    await pool.query('DELETE FROM user_profiles WHERE user_id = ?', [userId]);
    await pool.query('DELETE FROM user_sessions WHERE user_id = ?', [userId]);
    await pool.query('DELETE FROM users WHERE id = ?', [userId]);

    await logAdminAction({
      adminId: req.admin.id,
      action: 'USER_DELETED',
      targetType: 'user',
      targetId: userId,
      details: { username },
      ip: req.ip || req.connection?.remoteAddress
    });

    return res.status(200).json({
      success: true,
      message: `User @${username} has been permanently deleted.`
    });
  } catch (error) {
    next(error);
  }
};

exports.createAdminUser = async (req, res, next) => {
  try {
    if (req.admin.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Only a Super Administrator can provision administrative accounts.'
      });
    }

    const { fullName, username, email, password, role } = req.body;

    if (!fullName || !username || !email || !password || !role) {
      return res.status(400).json({
        success: false,
        message: 'Full name, username, email, password, and role are required.'
      });
    }

    const validRoles = ['moderator', 'support_admin', 'admin', 'super_admin'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: `Invalid administrative role. Must be one of: ${validRoles.join(', ')}`
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long.'
      });
    }

    const cleanUsername = username.trim().toLowerCase().replace(/^@/, '');
    const cleanEmail = email.trim().toLowerCase();

    const [existing] = await pool.query(
      'SELECT id FROM users WHERE LOWER(username) = ? OR LOWER(email) = ?',
      [cleanUsername, cleanEmail]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'A user with that username or email already exists.'
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const [insertResult] = await pool.query(
      `INSERT INTO users (full_name, username, email, password_hash, email_verified, account_status, role)
       VALUES (?, ?, ?, ?, 1, 'active', ?)`,
      [fullName.trim(), cleanUsername, cleanEmail, passwordHash, role]
    );

    const newAdminId = insertResult.insertId;

    await pool.query(
      `INSERT INTO user_profiles (user_id, bio, is_online) VALUES (?, 'Administrative Account', 0)`,
      [newAdminId]
    );

    await logAdminAction({
      adminId: req.admin.id,
      action: 'ADMIN_ACCOUNT_CREATED',
      targetType: 'user',
      targetId: newAdminId,
      details: { username: cleanUsername, role, email: cleanEmail },
      ip: req.ip || req.connection?.remoteAddress
    });

    return res.status(201).json({
      success: true,
      message: `Administrative user @${cleanUsername} (${role}) provisioned successfully.`,
      user: {
        id: newAdminId,
        full_name: fullName.trim(),
        username: cleanUsername,
        email: cleanEmail,
        role
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 5. Group Management
 */
exports.getGroups = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
    const offset = (page - 1) * limit;

    const { search = '', status = 'all' } = req.query;

    const conditions = [];
    const params = [];

    if (search.trim()) {
      conditions.push('(g.name LIKE ? OR g.description LIKE ?)');
      params.push(`%${search.trim()}%`, `%${search.trim()}%`);
    }

    if (status !== 'all') {
      conditions.push('g.status = ?');
      params.push(status);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const [countResult] = await pool.query(`SELECT COUNT(*) AS total FROM \`groups\` g ${whereClause}`, params);
    const total = countResult[0]?.total || 0;

    const query = `
      SELECT 
        g.id,
        g.name,
        g.description,
        g.profile_image,
        g.conversation_id,
        g.created_by,
        g.status,
        g.created_at,
        u.username AS creator_username,
        u.full_name AS creator_name,
        (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id) AS members_count,
        (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = g.conversation_id) AS messages_count,
        (SELECT COUNT(*) FROM calls c WHERE c.conversation_id = g.conversation_id AND c.status = 'ongoing') > 0 AS active_call
      FROM \`groups\` g
      LEFT JOIN users u ON g.created_by = u.id
      ${whereClause}
      ORDER BY g.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const [groups] = await pool.query(query, [...params, limit, offset]);

    return res.status(200).json({
      success: true,
      groups: groups.map(g => ({
        ...g,
        members_count: Number(g.members_count || 0),
        messages_count: Number(g.messages_count || 0),
        active_call: Boolean(g.active_call)
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.getGroupDetails = async (req, res, next) => {
  try {
    const groupId = req.params.id;

    const [groups] = await pool.query(
      `SELECT g.*, u.username AS creator_username, u.full_name AS creator_name
       FROM \`groups\` g
       LEFT JOIN users u ON g.created_by = u.id
       WHERE g.id = ?`,
      [groupId]
    );

    if (groups.length === 0) {
      return res.status(404).json({ success: false, message: 'Group not found.' });
    }

    const group = groups[0];

    const [members] = await pool.query(
      `SELECT gm.id, gm.user_id, gm.role, gm.joined_at, u.username, u.full_name, p.profile_picture, p.is_online
       FROM group_members gm
       JOIN users u ON gm.user_id = u.id
       LEFT JOIN user_profiles p ON u.id = p.user_id
       WHERE gm.group_id = ?
       ORDER BY gm.role DESC, gm.joined_at ASC`,
      [groupId]
    );

    return res.status(200).json({
      success: true,
      group,
      members
    });
  } catch (error) {
    next(error);
  }
};

exports.updateGroupStatus = async (req, res, next) => {
  try {
    const groupId = req.params.id;
    const { status, reason } = req.body;

    if (!['active', 'suspended', 'archived'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be "active", "suspended", or "archived".'
      });
    }

    const [groups] = await pool.query('SELECT id, name, status FROM `groups` WHERE id = ?', [groupId]);
    if (groups.length === 0) {
      return res.status(404).json({ success: false, message: 'Group not found.' });
    }

    const group = groups[0];

    await pool.query('UPDATE `groups` SET status = ? WHERE id = ?', [status, groupId]);

    await logAdminAction({
      adminId: req.admin.id,
      action: 'GROUP_STATUS_UPDATE',
      targetType: 'group',
      targetId: groupId,
      details: {
        groupName: group.name,
        oldStatus: group.status,
        newStatus: status,
        reason: reason || 'Administrative moderation action'
      },
      ip: req.ip || req.connection?.remoteAddress
    });

    return res.status(200).json({
      success: true,
      message: `Group "${group.name}" marked as ${status}.`,
      status
    });
  } catch (error) {
    next(error);
  }
};

exports.deleteGroup = async (req, res, next) => {
  try {
    const groupId = req.params.id;

    if (!['super_admin', 'admin'].includes(req.admin.role)) {
      return res.status(403).json({
        success: false,
        message: 'Only Super Administrators and Administrators can disband groups.'
      });
    }

    const [groups] = await pool.query('SELECT id, name, conversation_id FROM `groups` WHERE id = ?', [groupId]);
    if (groups.length === 0) {
      return res.status(404).json({ success: false, message: 'Group not found.' });
    }

    const group = groups[0];

    await pool.query('DELETE FROM group_members WHERE group_id = ?', [groupId]);
    await pool.query('DELETE FROM `groups` WHERE id = ?', [groupId]);

    if (group.conversation_id) {
      await pool.query('DELETE FROM conversations WHERE id = ?', [group.conversation_id]);
    }

    await logAdminAction({
      adminId: req.admin.id,
      action: 'GROUP_DISBANDED',
      targetType: 'group',
      targetId: groupId,
      details: { groupName: group.name },
      ip: req.ip || req.connection?.remoteAddress
    });

    return res.status(200).json({
      success: true,
      message: `Group "${group.name}" was disbanded administratively.`
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 6. Report & Moderation Management
 */
exports.getReports = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
    const offset = (page - 1) * limit;

    const { status = 'all', targetType = 'all' } = req.query;

    const conditions = [];
    const params = [];

    if (status !== 'all') {
      conditions.push('r.status = ?');
      params.push(status);
    }

    if (targetType === 'user') {
      conditions.push('r.reported_user_id IS NOT NULL');
    } else if (targetType === 'group') {
      conditions.push('r.group_id IS NOT NULL');
    } else if (targetType === 'message') {
      conditions.push('r.message_id IS NOT NULL');
    } else if (targetType === 'status') {
      conditions.push('r.status_id IS NOT NULL');
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const [countResult] = await pool.query(`SELECT COUNT(*) AS total FROM user_reports r ${whereClause}`, params);
    const total = countResult[0]?.total || 0;

    const query = `
      SELECT 
        r.id,
        r.reporter_id,
        r.reported_user_id,
        r.group_id,
        r.message_id,
        r.status_id,
        r.reason,
        r.description,
        r.status,
        r.reviewed_by,
        r.admin_notes,
        r.action_taken,
        r.created_at,
        r.updated_at,
        reporter.username AS reporter_username,
        reporter.full_name AS reporter_name,
        target_user.username AS reported_username,
        target_user.full_name AS reported_user_name,
        target_user.account_status AS reported_user_status,
        g.name AS group_name,
        reviewer.username AS reviewer_username
      FROM user_reports r
      LEFT JOIN users reporter ON r.reporter_id = reporter.id
      LEFT JOIN users target_user ON r.reported_user_id = target_user.id
      LEFT JOIN \`groups\` g ON r.group_id = g.id
      LEFT JOIN users reviewer ON r.reviewed_by = reviewer.id
      ${whereClause}
      ORDER BY 
        CASE WHEN r.status = 'pending' THEN 1 WHEN r.status = 'under_review' THEN 2 ELSE 3 END,
        r.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const [reports] = await pool.query(query, [...params, limit, offset]);

    return res.status(200).json({
      success: true,
      reports,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.updateReport = async (req, res, next) => {
  try {
    const reportId = req.params.id;
    const { status, admin_notes, action_taken } = req.body;

    const validStatuses = ['pending', 'under_review', 'resolved', 'dismissed'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid report status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    const [reports] = await pool.query('SELECT * FROM user_reports WHERE id = ?', [reportId]);
    if (reports.length === 0) {
      return res.status(404).json({ success: false, message: 'Report ticket not found.' });
    }

    const currentReport = reports[0];
    const newStatus = status || currentReport.status;
    const newNotes = admin_notes !== undefined ? admin_notes : currentReport.admin_notes;
    const newAction = action_taken !== undefined ? action_taken : currentReport.action_taken;

    if (action_taken === 'suspend_user' && currentReport.reported_user_id) {
      await pool.query('UPDATE users SET account_status = "suspended" WHERE id = ?', [currentReport.reported_user_id]);
      await pool.query('UPDATE user_sessions SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL', [currentReport.reported_user_id]);
    }

    if (action_taken === 'suspend_group' && currentReport.group_id) {
      await pool.query('UPDATE `groups` SET status = "suspended" WHERE id = ?', [currentReport.group_id]);
    }

    await pool.query(
      `UPDATE user_reports 
       SET status = ?, admin_notes = ?, action_taken = ?, reviewed_by = ?
       WHERE id = ?`,
      [newStatus, newNotes, newAction, req.admin.id, reportId]
    );

    await logAdminAction({
      adminId: req.admin.id,
      action: 'REPORT_RESOLVED',
      targetType: 'report',
      targetId: reportId,
      details: {
        newStatus,
        actionTaken: newAction,
        reportedUserId: currentReport.reported_user_id
      },
      ip: req.ip || req.connection?.remoteAddress
    });

    return res.status(200).json({
      success: true,
      message: `Report #${reportId} updated to "${newStatus}".`,
      report: {
        id: reportId,
        status: newStatus,
        admin_notes: newNotes,
        action_taken: newAction,
        reviewed_by: req.admin.id
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 7. System Analytics & Telemetry
 */
exports.getAnalytics = async (req, res, next) => {
  try {
    const [userGrowth] = await pool.query(
      `SELECT DATE(created_at) AS date, COUNT(*) AS count
       FROM users
       WHERE created_at >= CURDATE() - INTERVAL 30 DAY
       GROUP BY DATE(created_at)
       ORDER BY date ASC`
    );

    const [msgGrowth] = await pool.query(
      `SELECT DATE(created_at) AS date, COUNT(*) AS count
       FROM messages
       WHERE created_at >= CURDATE() - INTERVAL 30 DAY
       GROUP BY DATE(created_at)
       ORDER BY date ASC`
    );

    const [callMetrics] = await pool.query(
      `SELECT 
         call_type,
         status,
         COUNT(*) AS count,
         COALESCE(SUM(duration_seconds), 0) AS total_seconds
       FROM calls
       GROUP BY call_type, status`
    );

    const [mediaMetrics] = await pool.query(
      `SELECT 
         file_type,
         COUNT(*) AS count,
         COALESCE(SUM(file_size), 0) AS total_bytes
       FROM message_attachments
       GROUP BY file_type`
    );

    return res.status(200).json({
      success: true,
      analytics: {
        userGrowth,
        messagesGrowth: msgGrowth,
        calls: callMetrics,
        mediaUsage: mediaMetrics
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 8. Admin Audit Logs
 */
exports.getAuditLogs = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    const { action = 'all', search = '' } = req.query;

    const conditions = [];
    const params = [];

    if (action !== 'all') {
      conditions.push('l.action = ?');
      params.push(action);
    }

    if (search.trim()) {
      conditions.push('(u.username LIKE ? OR l.action LIKE ? OR l.target_type LIKE ?)');
      params.push(`%${search.trim()}%`, `%${search.trim()}%`, `%${search.trim()}%`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const [countResult] = await pool.query(
      `SELECT COUNT(*) AS total FROM admin_audit_logs l LEFT JOIN users u ON l.admin_id = u.id ${whereClause}`,
      params
    );
    const total = countResult[0]?.total || 0;

    const query = `
      SELECT 
        l.id,
        l.admin_id,
        l.action,
        l.target_type,
        l.target_id,
        l.details,
        l.ip_address,
        l.created_at,
        u.username AS admin_username,
        u.full_name AS admin_name,
        u.role AS admin_role
      FROM admin_audit_logs l
      LEFT JOIN users u ON l.admin_id = u.id
      ${whereClause}
      ORDER BY l.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const [logs] = await pool.query(query, [...params, limit, offset]);

    return res.status(200).json({
      success: true,
      logs: logs.map(l => {
        let parsedDetails = l.details;
        if (typeof l.details === 'string') {
          try {
            parsedDetails = JSON.parse(l.details);
          } catch (e) {
            parsedDetails = l.details;
          }
        }
        return {
          ...l,
          details: parsedDetails
        };
      }),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 9. Admin Notifications
 */
exports.getNotifications = async (req, res, next) => {
  try {
    const [notifications] = await pool.query(
      `SELECT id, admin_id, title, message, notification_type, is_read, reference_id, created_at
       FROM admin_notifications
       ORDER BY created_at DESC
       LIMIT 50`
    );

    const [unread] = await pool.query(
      'SELECT COUNT(*) AS count FROM admin_notifications WHERE is_read = 0'
    );

    return res.status(200).json({
      success: true,
      notifications,
      unreadCount: Number(unread[0]?.count || 0)
    });
  } catch (error) {
    next(error);
  }
};

exports.markNotificationsRead = async (req, res, next) => {
  try {
    const { notificationIds } = req.body;

    if (Array.isArray(notificationIds) && notificationIds.length > 0) {
      await pool.query('UPDATE admin_notifications SET is_read = 1 WHERE id IN (?)', [notificationIds]);
    } else {
      await pool.query('UPDATE admin_notifications SET is_read = 1');
    }

    return res.status(200).json({
      success: true,
      message: 'Notifications marked as read.'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 10. Platform Settings
 */
exports.getSettings = async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT setting_key, setting_value, data_type, description, updated_at FROM platform_settings');

    const settingsMap = {};
    rows.forEach(r => {
      let val = r.setting_value;
      if (r.data_type === 'number') val = Number(val);
      if (r.data_type === 'boolean') val = val === 'true' || val === '1';
      if (r.data_type === 'json') {
        try { val = JSON.parse(val); } catch (e) {}
      }
      settingsMap[r.setting_key] = val;
    });

    return res.status(200).json({
      success: true,
      settings: settingsMap,
      rawList: rows
    });
  } catch (error) {
    next(error);
  }
};

exports.updateSettings = async (req, res, next) => {
  try {
    if (req.admin.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Only a Super Administrator can modify global platform settings.'
      });
    }

    const { settings } = req.body;
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Settings object payload required.'
      });
    }

    for (const [key, val] of Object.entries(settings)) {
      const stringVal = typeof val === 'object' ? JSON.stringify(val) : String(val);
      await pool.query(
        `INSERT INTO platform_settings (setting_key, setting_value, updated_by)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_by = VALUES(updated_by)`,
        [key, stringVal, req.admin.id]
      );
    }

    await logAdminAction({
      adminId: req.admin.id,
      action: 'GLOBAL_SETTINGS_UPDATE',
      targetType: 'platform_settings',
      targetId: 'global',
      details: settings,
      ip: req.ip || req.connection?.remoteAddress
    });

    return res.status(200).json({
      success: true,
      message: 'Platform configurations updated successfully.',
      updatedSettings: settings
    });
  } catch (error) {
    next(error);
  }
};
