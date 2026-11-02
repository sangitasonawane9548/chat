const { pool } = require('../config/database');

const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,20}$/;

/**
 * 1. Search Users by Username or Name
 * GET /api/users/search?q=narendra&page=1&limit=20
 */
const searchUsers = async (req, res, next) => {
  try {
    const rawQuery = (req.query.q || '').trim();
    const cleanQuery = rawQuery.replace(/^@/, '').trim();
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit || '20', 10)));
    const offset = (page - 1) * limit;

    const currentUserId = req.user.id;

    if (!cleanQuery) {
      return res.status(200).json({
        success: true,
        users: [],
        pagination: { total: 0, page, limit, totalPages: 0 }
      });
    }

    const searchPattern = `%${cleanQuery}%`;

    // Count total matching users (excluding self, unverified, inactive, blocked, and non-discoverable unless exact match)
    const [countResult] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM users u
       JOIN user_profiles p ON u.id = p.user_id
       LEFT JOIN user_settings s ON u.id = s.user_id
       WHERE u.id != ?
         AND u.email_verified = 1
         AND u.account_status = 'active'
         AND (LOWER(u.username) LIKE LOWER(?) OR LOWER(u.full_name) LIKE LOWER(?))
         AND (s.allow_username_search = 1 OR LOWER(u.username) = LOWER(?))
         AND u.id NOT IN (
           SELECT blocked_user_id FROM blocked_users WHERE blocker_id = ?
           UNION
           SELECT blocker_id FROM blocked_users WHERE blocked_user_id = ?
         )`,
      [currentUserId, searchPattern, searchPattern, cleanQuery, currentUserId, currentUserId]
    );

    const total = countResult[0]?.total || 0;
    const totalPages = Math.ceil(total / limit);

    // Fetch matching user records
    const [rows] = await pool.query(
      `SELECT u.id, u.full_name, u.username, u.created_at,
              p.profile_picture, p.bio, p.is_online, p.last_seen,
              s.show_online_status, s.show_last_seen, s.allow_chat_requests
       FROM users u
       JOIN user_profiles p ON u.id = p.user_id
       LEFT JOIN user_settings s ON u.id = s.user_id
       WHERE u.id != ?
         AND u.email_verified = 1
         AND u.account_status = 'active'
         AND (LOWER(u.username) LIKE LOWER(?) OR LOWER(u.full_name) LIKE LOWER(?))
         AND (s.allow_username_search = 1 OR LOWER(u.username) = LOWER(?))
         AND u.id NOT IN (
           SELECT blocked_user_id FROM blocked_users WHERE blocker_id = ?
           UNION
           SELECT blocker_id FROM blocked_users WHERE blocked_user_id = ?
         )
       ORDER BY 
         CASE WHEN LOWER(u.username) = LOWER(?) THEN 0
              WHEN LOWER(u.username) LIKE LOWER(?) THEN 1
              ELSE 2 END,
         u.full_name ASC
       LIMIT ? OFFSET ?`,
      [
        currentUserId, searchPattern, searchPattern, cleanQuery,
        currentUserId, currentUserId,
        cleanQuery, `${cleanQuery}%`,
        limit, offset
      ]
    );

    // Compute relationship for each result
    const usersWithRelationship = await Promise.all(
      rows.map(async (u) => {
        let relationship = 'none';
        let conversationId = null;
        let requestId = null;

        // Check if direct conversation exists
        const [convRows] = await pool.query(
          `SELECT c.id 
           FROM conversations c
           JOIN conversation_members cm1 ON c.id = cm1.conversation_id AND cm1.user_id = ?
           JOIN conversation_members cm2 ON c.id = cm2.conversation_id AND cm2.user_id = ?
           WHERE c.conversation_type = 'direct'
           LIMIT 1`,
          [currentUserId, u.id]
        );

        if (convRows.length > 0) {
          relationship = 'connected';
          conversationId = convRows[0].id;
        } else {
          // Check chat requests
          const [reqRows] = await pool.query(
            `SELECT id, sender_id, receiver_id, status 
             FROM chat_requests 
             WHERE ((sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?))
               AND status = 'pending'
             ORDER BY id DESC LIMIT 1`,
            [currentUserId, u.id, u.id, currentUserId]
          );

          if (reqRows.length > 0) {
            const reqRecord = reqRows[0];
            requestId = reqRecord.id;
            if (reqRecord.sender_id === currentUserId) {
              relationship = 'pending_outgoing';
            } else {
              relationship = 'pending_incoming';
            }
          }
        }

        return {
          id: u.id,
          full_name: u.full_name,
          username: u.username,
          profile_picture: u.profile_picture,
          bio: u.bio || '',
          is_online: u.show_online_status ? Boolean(u.is_online) : false,
          last_seen: u.show_last_seen ? u.last_seen : null,
          allow_chat_requests: u.allow_chat_requests !== 'nobody',
          relationship,
          conversation_id: conversationId,
          request_id: requestId
        };
      })
    );

    return res.status(200).json({
      success: true,
      users: usersWithRelationship,
      pagination: {
        total,
        page,
        limit,
        totalPages
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 2. Get Suggested Users for Discovery Screen
 * GET /api/users/suggestions
 */
const getSuggestions = async (req, res, next) => {
  try {
    const currentUserId = req.user.id;

    const [rows] = await pool.query(
      `SELECT u.id, u.full_name, u.username, u.created_at,
              p.profile_picture, p.bio, p.is_online, p.last_seen,
              s.show_online_status, s.show_last_seen, s.allow_chat_requests
       FROM users u
       JOIN user_profiles p ON u.id = p.user_id
       LEFT JOIN user_settings s ON u.id = s.user_id
       WHERE u.id != ?
         AND u.email_verified = 1
         AND u.account_status = 'active'
         AND s.allow_username_search = 1
         AND u.id NOT IN (
           SELECT blocked_user_id FROM blocked_users WHERE blocker_id = ?
           UNION
           SELECT blocker_id FROM blocked_users WHERE blocked_user_id = ?
         )
       ORDER BY p.is_online DESC, u.created_at DESC
       LIMIT 10`,
      [currentUserId, currentUserId, currentUserId]
    );

    // Annotate with relationship
    const suggestions = await Promise.all(
      rows.map(async (u) => {
        let relationship = 'none';
        let conversationId = null;
        let requestId = null;

        const [convRows] = await pool.query(
          `SELECT c.id 
           FROM conversations c
           JOIN conversation_members cm1 ON c.id = cm1.conversation_id AND cm1.user_id = ?
           JOIN conversation_members cm2 ON c.id = cm2.conversation_id AND cm2.user_id = ?
           WHERE c.conversation_type = 'direct'
           LIMIT 1`,
          [currentUserId, u.id]
        );

        if (convRows.length > 0) {
          relationship = 'connected';
          conversationId = convRows[0].id;
        } else {
          const [reqRows] = await pool.query(
            `SELECT id, sender_id, receiver_id, status 
             FROM chat_requests 
             WHERE ((sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?))
               AND status = 'pending'
             ORDER BY id DESC LIMIT 1`,
            [currentUserId, u.id, u.id, currentUserId]
          );

          if (reqRows.length > 0) {
            const reqRecord = reqRows[0];
            requestId = reqRecord.id;
            relationship = reqRecord.sender_id === currentUserId ? 'pending_outgoing' : 'pending_incoming';
          }
        }

        return {
          id: u.id,
          full_name: u.full_name,
          username: u.username,
          profile_picture: u.profile_picture,
          bio: u.bio || '',
          is_online: u.show_online_status ? Boolean(u.is_online) : false,
          last_seen: u.show_last_seen ? u.last_seen : null,
          allow_chat_requests: u.allow_chat_requests !== 'nobody',
          relationship,
          conversation_id: conversationId,
          request_id: requestId
        };
      })
    );

    return res.status(200).json({
      success: true,
      users: suggestions
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 3. Get User Public Profile by Username
 * GET /api/users/:username
 */
const getUserProfile = async (req, res, next) => {
  try {
    const rawUsername = (req.params.username || '').trim().replace(/^@/, '');
    const currentUserId = req.user.id;

    if (!rawUsername) {
      return res.status(400).json({ success: false, message: 'Username is required' });
    }

    const [users] = await pool.query(
      `SELECT u.id, u.full_name, u.username, u.email, u.role, u.created_at,
              p.profile_picture, p.bio, p.is_online, p.last_seen,
              s.show_online_status, s.show_last_seen, s.allow_chat_requests, s.profile_visibility
       FROM users u
       JOIN user_profiles p ON u.id = p.user_id
       LEFT JOIN user_settings s ON u.id = s.user_id
       WHERE LOWER(u.username) = LOWER(?) AND u.account_status = 'active' AND u.email_verified = 1
       LIMIT 1`,
      [rawUsername]
    );

    if (users.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const targetUser = users[0];
    const isOwnProfile = targetUser.id === currentUserId;

    // Check if blocked by target or target is blocked by requester
    if (!isOwnProfile) {
      const [blocked] = await pool.query(
        `SELECT id FROM blocked_users 
         WHERE (blocker_id = ? AND blocked_user_id = ?) OR (blocker_id = ? AND blocked_user_id = ?)
         LIMIT 1`,
        [currentUserId, targetUser.id, targetUser.id, currentUserId]
      );
      if (blocked.length > 0) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }
    }

    // Determine relationship
    let relationship = 'none';
    let conversationId = null;
    let requestId = null;

    if (!isOwnProfile) {
      const [convRows] = await pool.query(
        `SELECT c.id 
         FROM conversations c
         JOIN conversation_members cm1 ON c.id = cm1.conversation_id AND cm1.user_id = ?
         JOIN conversation_members cm2 ON c.id = cm2.conversation_id AND cm2.user_id = ?
         WHERE c.conversation_type = 'direct'
         LIMIT 1`,
        [currentUserId, targetUser.id]
      );

      if (convRows.length > 0) {
        relationship = 'connected';
        conversationId = convRows[0].id;
      } else {
        const [reqRows] = await pool.query(
          `SELECT id, sender_id, receiver_id, status 
           FROM chat_requests 
           WHERE ((sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?))
             AND status = 'pending'
           ORDER BY id DESC LIMIT 1`,
          [currentUserId, targetUser.id, targetUser.id, currentUserId]
        );

        if (reqRows.length > 0) {
          const reqRecord = reqRows[0];
          requestId = reqRecord.id;
          relationship = reqRecord.sender_id === currentUserId ? 'pending_outgoing' : 'pending_incoming';
        }
      }
    }

    return res.status(200).json({
      success: true,
      profile: {
        id: targetUser.id,
        full_name: targetUser.full_name,
        username: targetUser.username,
        bio: targetUser.bio || '',
        profile_picture: targetUser.profile_picture,
        created_at: targetUser.created_at,
        is_own_profile: isOwnProfile,
        is_online: isOwnProfile || targetUser.show_online_status ? Boolean(targetUser.is_online) : false,
        last_seen: isOwnProfile || targetUser.show_last_seen ? targetUser.last_seen : null,
        allow_chat_requests: targetUser.allow_chat_requests !== 'nobody',
        relationship,
        conversation_id: conversationId,
        request_id: requestId,
        // Only return private details if own profile
        ...(isOwnProfile && {
          email: targetUser.email,
          role: targetUser.role
        })
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 4. Update Current User Profile
 * PUT /api/users/me/profile
 */
const updateOwnProfile = async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const { fullName, bio, username, role } = req.body;
    const userId = req.user.id;

    // Strict Role Escalation Prevention: Users cannot mutate or elevate their own role
    if (role !== undefined && role !== req.user.role) {
      connection.release();
      return res.status(403).json({
        success: false,
        message: 'Forbidden. Self-assigned role escalation is strictly prohibited.'
      });
    }

    if (!fullName || !fullName.trim()) {
      return res.status(400).json({ success: false, message: 'Full name is required' });
    }

    const trimmedName = fullName.trim().substring(0, 100);
    const trimmedBio = (bio || '').trim().substring(0, 160); // Max 160 chars

    await connection.beginTransaction();

    // Check if username change requested
    let updatedUsername = req.user.username;
    if (username && username.trim().toLowerCase() !== req.user.username.toLowerCase()) {
      const cleanUsername = username.trim();
      if (!USERNAME_REGEX.test(cleanUsername)) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: 'Username must be 3-20 characters; letters, numbers, and underscores only'
        });
      }

      // Check case-insensitive uniqueness
      const [existing] = await connection.query(
        'SELECT id FROM users WHERE LOWER(username) = LOWER(?) AND id != ? LIMIT 1',
        [cleanUsername, userId]
      );

      if (existing.length > 0) {
        await connection.rollback();
        return res.status(409).json({
          success: false,
          message: 'This username is already taken'
        });
      }

      await connection.query('UPDATE users SET username = ? WHERE id = ?', [cleanUsername, userId]);
      updatedUsername = cleanUsername;
    }

    // Update users table
    await connection.query('UPDATE users SET full_name = ? WHERE id = ?', [trimmedName, userId]);

    // Update user_profiles table
    await connection.query(
      'UPDATE user_profiles SET bio = ? WHERE user_id = ?',
      [trimmedBio, userId]
    );

    await connection.commit();

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: userId,
        full_name: trimmedName,
        username: updatedUsername,
        bio: trimmedBio
      }
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
};

/**
 * 5. Upload Profile Picture
 * POST /api/users/me/avatar
 */
const uploadAvatar = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file provided or file rejected. Only JPG, PNG, and WEBP under 5MB are allowed.'
      });
    }

    const userId = req.user.id;
    // Form relative path
    const avatarUrl = `/uploads/avatars/${req.file.filename}`;

    await pool.query(
      'UPDATE user_profiles SET profile_picture = ? WHERE user_id = ?',
      [avatarUrl, userId]
    );

    return res.status(200).json({
      success: true,
      message: 'Profile picture uploaded successfully',
      avatar_url: avatarUrl
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 6. Get User Settings
 * GET /api/users/settings
 */
const getUserSettings = async (req, res, next) => {
  try {
    const userId = req.user.id;

    let [rows] = await pool.query(
      'SELECT theme, show_last_seen, show_online_status, show_read_receipts, allow_username_search, profile_visibility, allow_chat_requests, call_permissions FROM user_settings WHERE user_id = ? LIMIT 1',
      [userId]
    );

    if (rows.length === 0) {
      await pool.query(
        'INSERT INTO user_settings (user_id) VALUES (?) ON DUPLICATE KEY UPDATE updated_at = NOW()',
        [userId]
      );
      [rows] = await pool.query(
        'SELECT theme, show_last_seen, show_online_status, show_read_receipts, allow_username_search, profile_visibility, allow_chat_requests, call_permissions FROM user_settings WHERE user_id = ? LIMIT 1',
        [userId]
      );
    }

    const s = rows[0] || {};
    return res.status(200).json({
      success: true,
      settings: {
        theme: s.theme || 'dark',
        show_last_seen: Boolean(s.show_last_seen !== 0),
        show_online_status: Boolean(s.show_online_status !== 0),
        show_read_receipts: Boolean(s.show_read_receipts !== 0),
        allow_username_search: Boolean(s.allow_username_search !== 0),
        profile_visibility: s.profile_visibility || 'public',
        allow_chat_requests: s.allow_chat_requests || 'everyone',
        call_permissions: s.call_permissions || 'everyone'
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 7. Update User Settings
 * PUT /api/users/settings
 */
const updateUserSettings = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const {
      theme = 'dark',
      show_last_seen = true,
      show_online_status = true,
      show_read_receipts = true,
      allow_username_search = true,
      profile_visibility = 'public',
      allow_chat_requests = 'everyone',
      call_permissions = 'everyone'
    } = req.body;

    const validThemes = ['dark', 'light', 'system'];
    const validVis = ['public', 'contacts_only', 'private'];
    const validRequests = ['everyone', 'nobody'];
    const validCalls = ['everyone', 'contacts_only', 'nobody'];

    const safeTheme = validThemes.includes(theme) ? theme : 'dark';
    const safeVis = validVis.includes(profile_visibility) ? profile_visibility : 'public';
    const safeReq = validRequests.includes(allow_chat_requests) ? allow_chat_requests : 'everyone';
    const safeCalls = validCalls.includes(call_permissions) ? call_permissions : 'everyone';

    await pool.query(
      `INSERT INTO user_settings 
       (user_id, theme, show_last_seen, show_online_status, show_read_receipts, allow_username_search, profile_visibility, allow_chat_requests, call_permissions, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE
         theme = VALUES(theme),
         show_last_seen = VALUES(show_last_seen),
         show_online_status = VALUES(show_online_status),
         show_read_receipts = VALUES(show_read_receipts),
         allow_username_search = VALUES(allow_username_search),
         profile_visibility = VALUES(profile_visibility),
         allow_chat_requests = VALUES(allow_chat_requests),
         call_permissions = VALUES(call_permissions),
         updated_at = NOW()`,
      [
        userId,
        safeTheme,
        show_last_seen ? 1 : 0,
        show_online_status ? 1 : 0,
        show_read_receipts ? 1 : 0,
        allow_username_search ? 1 : 0,
        safeVis,
        safeReq,
        safeCalls
      ]
    );

    return res.status(200).json({
      success: true,
      message: 'User settings updated successfully',
      settings: {
        theme: safeTheme,
        show_last_seen: Boolean(show_last_seen),
        show_online_status: Boolean(show_online_status),
        show_read_receipts: Boolean(show_read_receipts),
        allow_username_search: Boolean(allow_username_search),
        profile_visibility: safeVis,
        allow_chat_requests: safeReq,
        call_permissions: safeCalls
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 8. Get Blocked Users
 * GET /api/users/blocked
 */
const getBlockedUsers = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const [rows] = await pool.query(
      `SELECT bu.id as block_id, bu.created_at as blocked_at,
              u.id, u.username, u.full_name, p.profile_picture
       FROM blocked_users bu
       JOIN users u ON bu.blocked_user_id = u.id
       LEFT JOIN user_profiles p ON u.id = p.user_id
       WHERE bu.blocker_id = ?
       ORDER BY bu.created_at DESC`,
      [userId]
    );

    return res.status(200).json({
      success: true,
      blockedUsers: rows
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 9. Block User
 * POST /api/users/block/:targetUserId
 */
const blockUser = async (req, res, next) => {
  try {
    const blockerId = req.user.id;
    const targetUserId = parseInt(req.params.targetUserId, 10);

    if (!targetUserId || isNaN(targetUserId)) {
      return res.status(400).json({ success: false, message: 'Invalid target user ID' });
    }

    if (blockerId === targetUserId) {
      return res.status(400).json({ success: false, message: 'Cannot block yourself' });
    }

    // Verify target user exists
    const [targetRows] = await pool.query('SELECT id, username FROM users WHERE id = ? LIMIT 1', [targetUserId]);
    if (targetRows.length === 0) {
      return res.status(404).json({ success: false, message: 'User to block not found' });
    }

    await pool.query(
      `INSERT INTO blocked_users (blocker_id, blocked_user_id, created_at)
       VALUES (?, ?, NOW())
       ON DUPLICATE KEY UPDATE created_at = NOW()`,
      [blockerId, targetUserId]
    );

    return res.status(200).json({
      success: true,
      message: `User @${targetRows[0].username} has been blocked`
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 10. Unblock User
 * DELETE /api/users/block/:targetUserId
 */
const unblockUser = async (req, res, next) => {
  try {
    const blockerId = req.user.id;
    const targetUserId = parseInt(req.params.targetUserId, 10);

    if (!targetUserId || isNaN(targetUserId)) {
      return res.status(400).json({ success: false, message: 'Invalid target user ID' });
    }

    await pool.query(
      'DELETE FROM blocked_users WHERE blocker_id = ? AND blocked_user_id = ?',
      [blockerId, targetUserId]
    );

    return res.status(200).json({
      success: true,
      message: 'User unblocked successfully'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  searchUsers,
  getSuggestions,
  getUserProfile,
  updateOwnProfile,
  uploadAvatar,
  getUserSettings,
  updateUserSettings,
  getBlockedUsers,
  blockUser,
  unblockUser
};

