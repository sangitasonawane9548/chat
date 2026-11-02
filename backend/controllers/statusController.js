const { pool } = require('../config/database');
const { emitToUser } = require('../config/socket');
const statusService = require('../services/statusService');

const ALLOWED_EMOJIS = ['❤️', '😂', '😍', '😮', '👍', '😢', '🔥'];

/**
 * 1. Create a Text Status
 * POST /api/statuses/text
 */
const createTextStatus = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const {
      textContent,
      backgroundColor = '#0B0D12',
      textColor = '#FFFFFF',
      fontSize = 'medium',
      textAlignment = 'center'
    } = req.body;

    if (!textContent || typeof textContent !== 'string' || textContent.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Status text content cannot be empty'
      });
    }

    if (textContent.trim().length > 1000) {
      return res.status(400).json({
        success: false,
        message: 'Text status cannot exceed 1000 characters'
      });
    }

    // Insert status with 24-hour expiration
    const [result] = await pool.query(
      `INSERT INTO statuses 
       (user_id, status_type, text_content, background_color, text_color, font_size, text_alignment, created_at, expires_at)
       VALUES (?, 'text', ?, ?, ?, ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL 24 HOUR))`,
      [
        userId,
        textContent.trim(),
        backgroundColor.trim(),
        textColor.trim(),
        fontSize.trim(),
        textAlignment.trim()
      ]
    );

    const statusId = result.insertId;

    const [rows] = await pool.query('SELECT * FROM statuses WHERE id = ?', [statusId]);
    const createdStatus = rows[0];

    const statusPayload = {
      id: createdStatus.id,
      user_id: userId,
      user: {
        id: userId,
        username: req.user.username,
        full_name: req.user.full_name,
        profile_picture: req.user.profile_picture
      },
      status_type: 'text',
      text_content: createdStatus.text_content,
      media_url: null,
      caption: null,
      background_color: createdStatus.background_color,
      text_color: createdStatus.text_color,
      font_size: createdStatus.font_size,
      text_alignment: createdStatus.text_alignment,
      created_at: createdStatus.created_at,
      expires_at: createdStatus.expires_at,
      views_count: 0,
      reactions: []
    };

    // Broadcast to eligible viewers
    try {
      const eligibleViewerIds = await statusService.getEligibleViewerIds(userId);
      for (const viewerId of eligibleViewerIds) {
        emitToUser(viewerId, 'status:new', {
          status: statusPayload,
          user: statusPayload.user
        });
      }
    } catch (socketErr) {
      console.error('[StatusController] Socket broadcast error:', socketErr.message);
    }

    return res.status(201).json({
      success: true,
      message: 'Status published successfully',
      status: statusPayload
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 2. Create Media Status (Image or Video)
 * POST /api/statuses/media
 */
const createMediaStatus = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { caption = '', backgroundColor = '#0B0D12', textColor = '#FFFFFF' } = req.body;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No media file uploaded'
      });
    }

    const statusType = req.file.statusType || (req.file.mimetype?.startsWith('video/') ? 'video' : 'image');
    const mediaUrl = `/uploads/statuses/${req.file.filename}`;
    const cleanCaption = caption ? caption.trim() : null;

    const [result] = await pool.query(
      `INSERT INTO statuses 
       (user_id, status_type, media_url, caption, background_color, text_color, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL 24 HOUR))`,
      [userId, statusType, mediaUrl, cleanCaption, backgroundColor, textColor]
    );

    const statusId = result.insertId;

    const [rows] = await pool.query('SELECT * FROM statuses WHERE id = ?', [statusId]);
    const createdStatus = rows[0];

    const statusPayload = {
      id: createdStatus.id,
      user_id: userId,
      user: {
        id: userId,
        username: req.user.username,
        full_name: req.user.full_name,
        profile_picture: req.user.profile_picture
      },
      status_type: statusType,
      text_content: null,
      media_url: mediaUrl,
      caption: cleanCaption,
      background_color: createdStatus.background_color,
      text_color: createdStatus.text_color,
      created_at: createdStatus.created_at,
      expires_at: createdStatus.expires_at,
      views_count: 0,
      reactions: []
    };

    // Broadcast to eligible viewers
    try {
      const eligibleViewerIds = await statusService.getEligibleViewerIds(userId);
      for (const viewerId of eligibleViewerIds) {
        emitToUser(viewerId, 'status:new', {
          status: statusPayload,
          user: statusPayload.user
        });
      }
    } catch (socketErr) {
      console.error('[StatusController] Socket broadcast error:', socketErr.message);
    }

    return res.status(201).json({
      success: true,
      message: `${statusType === 'video' ? 'Video' : 'Image'} status published successfully`,
      status: statusPayload
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 3. Get Authenticated User's Own Active Statuses
 * GET /api/statuses/me
 */
const getMyStatuses = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const [statuses] = await pool.query(
      `SELECT s.*,
              (SELECT COUNT(*) FROM status_views WHERE status_id = s.id) as views_count,
              TIMESTAMPDIFF(SECOND, NOW(), s.expires_at) as remaining_seconds
       FROM statuses s
       WHERE s.user_id = ? AND s.expires_at > NOW() AND s.deleted_at IS NULL
       ORDER BY s.created_at ASC`,
      [userId]
    );

    // Fetch reactions for each status
    const statusIds = statuses.map((s) => s.id);
    let reactionsMap = {};

    if (statusIds.length > 0) {
      const [reactionRows] = await pool.query(
        `SELECT sr.status_id, sr.user_id, sr.emoji, sr.created_at,
                u.username, u.full_name, p.profile_picture
         FROM status_reactions sr
         JOIN users u ON sr.user_id = u.id
         JOIN user_profiles p ON u.id = p.user_id
         WHERE sr.status_id IN (?)
         ORDER BY sr.created_at ASC`,
        [statusIds]
      );

      for (const r of reactionRows) {
        if (!reactionsMap[r.status_id]) reactionsMap[r.status_id] = [];
        reactionsMap[r.status_id].push({
          user_id: r.user_id,
          username: r.username,
          full_name: r.full_name,
          profile_picture: r.profile_picture,
          emoji: r.emoji,
          created_at: r.created_at
        });
      }
    }

    const formattedStatuses = statuses.map((s) => ({
      id: s.id,
      user_id: s.user_id,
      status_type: s.status_type,
      text_content: s.text_content,
      media_url: s.media_url,
      caption: s.caption,
      background_color: s.background_color,
      text_color: s.text_color,
      font_size: s.font_size,
      text_alignment: s.text_alignment,
      created_at: s.created_at,
      expires_at: s.expires_at,
      remaining_seconds: Math.max(0, s.remaining_seconds || 0),
      views_count: s.views_count || 0,
      reactions: reactionsMap[s.id] || []
    }));

    const totalViews = formattedStatuses.reduce((acc, curr) => acc + curr.views_count, 0);

    return res.status(200).json({
      success: true,
      user: {
        id: userId,
        username: req.user.username,
        full_name: req.user.full_name,
        profile_picture: req.user.profile_picture
      },
      statuses: formattedStatuses,
      total_views: totalViews
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 4. Get Status Feed (Grouped into Recent, Viewed, and Muted Updates)
 * GET /api/statuses/feed
 */
const getFeedStatuses = async (req, res, next) => {
  try {
    const currentUserId = req.user.id;

    // 1. Get contact IDs
    const contactIds = await statusService.getUserContactIds(currentUserId);
    if (contactIds.length === 0) {
      return res.status(200).json({
        success: true,
        recent: [],
        viewed: [],
        muted: []
      });
    }

    // 2. Fetch all active statuses from contacts
    const [allStatuses] = await pool.query(
      `SELECT s.*,
              u.id as owner_id, u.username as owner_username, u.full_name as owner_full_name,
              p.profile_picture as owner_profile_picture,
              (SELECT COUNT(*) FROM status_views sv WHERE sv.status_id = s.id AND sv.viewer_id = ?) as is_viewed_by_me,
              (SELECT emoji FROM status_reactions sr WHERE sr.status_id = s.id AND sr.user_id = ?) as my_reaction,
              TIMESTAMPDIFF(SECOND, NOW(), s.expires_at) as remaining_seconds
       FROM statuses s
       JOIN users u ON s.user_id = u.id
       JOIN user_profiles p ON u.id = p.user_id
       WHERE s.user_id IN (?) AND s.expires_at > NOW() AND s.deleted_at IS NULL
       ORDER BY s.created_at ASC`,
      [currentUserId, currentUserId, contactIds]
    );

    // 3. Filter by privacy settings for each status owner
    const permittedStatuses = [];
    const privacyCache = {};

    for (const status of allStatuses) {
      if (privacyCache[status.user_id] === undefined) {
        privacyCache[status.user_id] = await statusService.canUserViewStatus(currentUserId, status.user_id);
      }
      if (privacyCache[status.user_id]) {
        permittedStatuses.push(status);
      }
    }

    // 4. Check muted users
    const [mutedRows] = await pool.query(
      'SELECT muted_user_id FROM status_mutes WHERE user_id = ?',
      [currentUserId]
    );
    const mutedSet = new Set(mutedRows.map((r) => r.muted_user_id));

    // 5. Group statuses by user
    const userGroups = {};
    for (const s of permittedStatuses) {
      if (!userGroups[s.user_id]) {
        userGroups[s.user_id] = {
          id: s.owner_id,
          user_id: s.owner_id,
          username: s.owner_username,
          full_name: s.owner_full_name,
          profile_picture_url: s.owner_profile_picture,
          profile_picture: s.owner_profile_picture,
          user: {
            id: s.owner_id,
            username: s.owner_username,
            full_name: s.owner_full_name,
            profile_picture: s.owner_profile_picture
          },
          statuses: [],
          status_count: 0,
          all_viewed: true,
          is_muted: mutedSet.has(s.user_id),
          latest_updated_at: s.created_at,
          latest_status_at: s.created_at
        };
      }

      const viewed = Number(s.is_viewed_by_me) > 0;
      if (!viewed) {
        userGroups[s.user_id].all_viewed = false;
      }

      userGroups[s.user_id].status_count += 1;
      userGroups[s.user_id].latest_updated_at = s.created_at;
      userGroups[s.user_id].latest_status_at = s.created_at;

      userGroups[s.user_id].statuses.push({
        id: s.id,
        user_id: s.user_id,
        status_type: s.status_type,
        text_content: s.text_content,
        media_url: s.media_url,
        caption: s.caption,
        background_color: s.background_color,
        text_color: s.text_color,
        font_size: s.font_size,
        text_alignment: s.text_alignment,
        created_at: s.created_at,
        expires_at: s.expires_at,
        remaining_seconds: Math.max(0, s.remaining_seconds || 0),
        is_viewed: viewed,
        viewed_by_me: viewed,
        my_reaction: s.my_reaction || null
      });
    }

    // 6. Partition into recent, viewed, and muted
    const recent = [];
    const viewed = [];
    const muted = [];

    for (const group of Object.values(userGroups)) {
      if (group.is_muted) {
        muted.push(group);
      } else if (group.all_viewed) {
        viewed.push(group);
      } else {
        recent.push(group);
      }
    }

    // Sort by latest update timestamp
    const sortByLatest = (a, b) => new Date(b.latest_updated_at).getTime() - new Date(a.latest_updated_at).getTime();
    recent.sort(sortByLatest);
    viewed.sort(sortByLatest);
    muted.sort(sortByLatest);

    return res.status(200).json({
      success: true,
      feed: {
        recent,
        viewed,
        muted
      },
      recent,
      viewed,
      muted
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 5. Get Single Status Details
 * GET /api/statuses/:id
 */
const getStatusDetails = async (req, res, next) => {
  try {
    const statusId = parseInt(req.params.id, 10);
    const currentUserId = req.user.id;

    const [rows] = await pool.query(
      `SELECT s.*,
              u.id as owner_id, u.username as owner_username, u.full_name as owner_full_name,
              p.profile_picture as owner_profile_picture,
              (SELECT COUNT(*) FROM status_views sv WHERE sv.status_id = s.id) as views_count,
              (SELECT emoji FROM status_reactions sr WHERE sr.status_id = s.id AND sr.user_id = ?) as my_reaction,
              TIMESTAMPDIFF(SECOND, NOW(), s.expires_at) as remaining_seconds
       FROM statuses s
       JOIN users u ON s.user_id = u.id
       JOIN user_profiles p ON u.id = p.user_id
       WHERE s.id = ? AND s.expires_at > NOW() AND s.deleted_at IS NULL
       LIMIT 1`,
      [currentUserId, statusId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Status not found or expired'
      });
    }

    const status = rows[0];

    // Check authorization
    const canView = await statusService.canUserViewStatus(currentUserId, status.user_id);
    if (!canView) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to view this status'
      });
    }

    return res.status(200).json({
      success: true,
      status: {
        id: status.id,
        user_id: status.user_id,
        user: {
          id: status.owner_id,
          username: status.owner_username,
          full_name: status.owner_full_name,
          profile_picture: status.owner_profile_picture
        },
        status_type: status.status_type,
        text_content: status.text_content,
        media_url: status.media_url,
        caption: status.caption,
        background_color: status.background_color,
        text_color: status.text_color,
        font_size: status.font_size,
        text_alignment: status.text_alignment,
        created_at: status.created_at,
        expires_at: status.expires_at,
        remaining_seconds: Math.max(0, status.remaining_seconds || 0),
        views_count: status.views_count,
        my_reaction: status.my_reaction || null
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 6. Record Status View
 * POST /api/statuses/:id/views
 */
const recordStatusView = async (req, res, next) => {
  try {
    const statusId = parseInt(req.params.id, 10);
    const viewerId = req.user.id;

    const [statusRows] = await pool.query(
      'SELECT id, user_id FROM statuses WHERE id = ? AND expires_at > NOW() AND deleted_at IS NULL LIMIT 1',
      [statusId]
    );

    if (statusRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Status not found or expired'
      });
    }

    const status = statusRows[0];

    // Verify viewer has access
    const canView = await statusService.canUserViewStatus(viewerId, status.user_id);
    if (!canView) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to view this status'
      });
    }

    // Do not record self views
    if (viewerId === status.user_id) {
      return res.status(200).json({ success: true, message: 'Owner view not tracked' });
    }

    // Check if view already exists
    const [existingView] = await pool.query(
      'SELECT id FROM status_views WHERE status_id = ? AND viewer_id = ? LIMIT 1',
      [statusId, viewerId]
    );

    const alreadyViewed = existingView.length > 0;
    if (alreadyViewed) {
      await pool.query(
        'UPDATE status_views SET viewed_at = NOW() WHERE id = ?',
        [existingView[0].id]
      );
    } else {
      await pool.query(
        'INSERT INTO status_views (status_id, viewer_id, viewed_at) VALUES (?, ?, NOW())',
        [statusId, viewerId]
      );
    }

    const viewedAt = new Date();

    // Notify status owner in real-time
    emitToUser(status.user_id, 'status:viewed', {
      statusId,
      viewer: {
        id: viewerId,
        username: req.user.username,
        full_name: req.user.full_name,
        profile_picture: req.user.profile_picture
      },
      viewedAt
    });

    return res.status(200).json({
      success: true,
      alreadyViewed,
      message: alreadyViewed ? 'Status view updated' : 'Status view recorded',
      viewed_at: viewedAt
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 7. Get Status Viewers List (Status Owner ONLY)
 * GET /api/statuses/:id/viewers
 */
const getStatusViewers = async (req, res, next) => {
  try {
    const statusId = parseInt(req.params.id, 10);
    const userId = req.user.id;

    const [statusRows] = await pool.query(
      'SELECT id, user_id FROM statuses WHERE id = ? AND deleted_at IS NULL LIMIT 1',
      [statusId]
    );

    if (statusRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Status not found'
      });
    }

    const status = statusRows[0];

    // STRICT OWNER CHECK
    if (status.user_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Only the status owner can access the viewers list'
      });
    }

    // Fetch viewers with profile information
    const [viewers] = await pool.query(
      `SELECT sv.viewed_at, u.id, u.username, u.full_name, p.profile_picture
       FROM status_views sv
       JOIN users u ON sv.viewer_id = u.id
       JOIN user_profiles p ON u.id = p.user_id
       WHERE sv.status_id = ?
       ORDER BY sv.viewed_at DESC`,
      [statusId]
    );

    return res.status(200).json({
      success: true,
      statusId,
      total_views: viewers.length,
      viewers: viewers.map((v) => ({
        id: v.id,
        user_id: v.id,
        viewer_id: v.id,
        username: v.username,
        full_name: v.full_name,
        profile_picture: v.profile_picture,
        viewed_at: v.viewed_at
      }))
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 8. Add or Toggle Emoji Reaction
 * POST /api/statuses/:id/reactions
 */
const toggleStatusReaction = async (req, res, next) => {
  try {
    const statusId = parseInt(req.params.id, 10);
    const userId = req.user.id;
    const { emoji } = req.body;

    if (!emoji || !ALLOWED_EMOJIS.includes(emoji)) {
      return res.status(400).json({
        success: false,
        message: `Invalid reaction. Allowed emojis are: ${ALLOWED_EMOJIS.join(' ')}`
      });
    }

    const [statusRows] = await pool.query(
      'SELECT id, user_id FROM statuses WHERE id = ? AND expires_at > NOW() AND deleted_at IS NULL LIMIT 1',
      [statusId]
    );

    if (statusRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Status not found or expired'
      });
    }

    const status = statusRows[0];

    const canView = await statusService.canUserViewStatus(userId, status.user_id);
    if (!canView) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to react to this status'
      });
    }

    // Check existing reaction
    const [existing] = await pool.query(
      'SELECT id, emoji FROM status_reactions WHERE status_id = ? AND user_id = ? LIMIT 1',
      [statusId, userId]
    );

    let action = 'added';
    if (existing.length > 0) {
      if (existing[0].emoji === emoji) {
        // Remove reaction (toggle off)
        await pool.query('DELETE FROM status_reactions WHERE id = ?', [existing[0].id]);
        action = 'removed';
      } else {
        // Change emoji
        await pool.query('UPDATE status_reactions SET emoji = ?, created_at = NOW() WHERE id = ?', [emoji, existing[0].id]);
        action = 'updated';
      }
    } else {
      // Add reaction
      await pool.query(
        'INSERT INTO status_reactions (status_id, user_id, emoji, created_at) VALUES (?, ?, ?, NOW())',
        [statusId, userId, emoji]
      );
    }

    // Notify status owner
    emitToUser(status.user_id, 'status:reaction', {
      statusId,
      user: {
        id: userId,
        username: req.user.username,
        full_name: req.user.full_name,
        profile_picture: req.user.profile_picture
      },
      emoji: action === 'removed' ? null : emoji,
      action
    });

    // Centralized notification on new reaction
    if (action === 'added' && status.user_id !== userId) {
      try {
        const { sendStatusNotification } = require('../services/notificationService');
        sendStatusNotification({
          statusOwnerId: status.user_id,
          actorName: req.user.full_name || req.user.username,
          interactionType: 'reaction',
          emoji,
          statusId
        }).catch(() => {});
      } catch (_) {}
    }

    return res.status(200).json({
      success: true,
      action,
      emoji: action === 'removed' ? null : emoji
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 9. Reply to Status via Existing 1-to-1 Messaging
 * POST /api/statuses/:id/reply
 */
const replyToStatus = async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const statusId = parseInt(req.params.id, 10);
    const senderId = req.user.id;
    const rawContent = req.body.content || req.body.text || req.body.message;

    if (!rawContent || typeof rawContent !== 'string' || rawContent.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Reply message cannot be empty'
      });
    }

    const content = rawContent.trim();

    const [statusRows] = await connection.query(
      'SELECT id, user_id, status_type, text_content, media_url, caption FROM statuses WHERE id = ? AND expires_at > NOW() AND deleted_at IS NULL LIMIT 1',
      [statusId]
    );

    if (statusRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Status not found or expired'
      });
    }

    const status = statusRows[0];
    const receiverId = status.user_id;

    if (senderId === receiverId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot reply to your own status'
      });
    }

    // Verify view permission
    const canView = await statusService.canUserViewStatus(senderId, receiverId, connection);
    if (!canView) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to reply to this status'
      });
    }

    await connection.beginTransaction();

    // Find or create direct conversation between sender and receiver
    const [existingConv] = await connection.query(
      `SELECT c.id 
       FROM conversations c
       JOIN conversation_members cm1 ON c.id = cm1.conversation_id AND cm1.user_id = ?
       JOIN conversation_members cm2 ON c.id = cm2.conversation_id AND cm2.user_id = ?
       WHERE c.conversation_type = 'direct'
       LIMIT 1`,
      [senderId, receiverId]
    );

    let conversationId;
    if (existingConv.length > 0) {
      conversationId = existingConv[0].id;
    } else {
      const [convRes] = await connection.query(
        'INSERT INTO conversations (conversation_type) VALUES ("direct")'
      );
      conversationId = convRes.insertId;
      await connection.query(
        'INSERT INTO conversation_members (conversation_id, user_id) VALUES (?, ?), (?, ?)',
        [conversationId, senderId, conversationId, receiverId]
      );
    }

    // Compose formatted reply text referencing the status
    let statusSummary = status.status_type === 'text'
      ? `"${(status.text_content || '').substring(0, 60)}..."`
      : status.status_type === 'video'
      ? '🎥 Video Status'
      : '📷 Photo Status';

    const formattedMessageContent = `[Replying to Status: ${statusSummary}]\n${content.trim()}`;

    // Insert message into messages table
    const [msgRes] = await connection.query(
      `INSERT INTO messages 
       (conversation_id, sender_id, message_type, message_content, created_at, updated_at)
       VALUES (?, ?, 'text', ?, NOW(), NOW())`,
      [conversationId, senderId, formattedMessageContent]
    );

    const messageId = msgRes.insertId;

    // Delivery receipt
    await connection.query(
      'INSERT INTO message_receipts (message_id, user_id, delivered_at) VALUES (?, ?, NOW())',
      [messageId, receiverId]
    );

    // Update conversation timestamp
    await connection.query(
      'UPDATE conversations SET updated_at = NOW() WHERE id = ?',
      [conversationId]
    );

    await connection.commit();

    const formattedMessage = {
      id: messageId,
      conversation_id: conversationId,
      sender_id: senderId,
      sender: {
        id: req.user.id,
        username: req.user.username,
        full_name: req.user.full_name,
        profile_picture: req.user.profile_picture
      },
      message_type: 'text',
      message_content: formattedMessageContent,
      created_at: new Date(),
      status: 'delivered'
    };

    // Emit Socket.IO event to recipient and conversation room
    emitToUser(receiverId, 'new_message', formattedMessage);
    emitToUser(receiverId, 'conversation_updated', {
      conversationId,
      lastMessage: formattedMessage
    });

    // Centralized notification on status reply
    try {
      const { sendStatusNotification } = require('../services/notificationService');
      sendStatusNotification({
        statusOwnerId: receiverId,
        actorName: req.user.full_name || req.user.username,
        interactionType: 'reply',
        statusId
      }).catch(() => {});
    } catch (_) {}

    return res.status(201).json({
      success: true,
      conversationId,
      conversation_id: conversationId,
      message: formattedMessage,
      sentMessage: formattedMessage
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
};

/**
 * 10. Delete Status
 * DELETE /api/statuses/:id
 */
const deleteStatus = async (req, res, next) => {
  try {
    const statusId = parseInt(req.params.id, 10);
    const userId = req.user.id;

    const [rows] = await pool.query(
      'SELECT id, user_id, media_url FROM statuses WHERE id = ? AND deleted_at IS NULL LIMIT 1',
      [statusId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Status not found'
      });
    }

    const status = rows[0];

    // STRICT OWNER VALIDATION
    if (status.user_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own statuses'
      });
    }

    // Soft delete
    await pool.query('UPDATE statuses SET deleted_at = NOW() WHERE id = ?', [statusId]);

    // Broadcast status:deleted to eligible viewers
    try {
      const eligibleViewerIds = await statusService.getEligibleViewerIds(userId);
      for (const vId of eligibleViewerIds) {
        emitToUser(vId, 'status:deleted', {
          statusId,
          userId
        });
      }
    } catch (_) {}

    return res.status(200).json({
      success: true,
      message: 'Status deleted successfully',
      statusId
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 11. Get Status Privacy Configuration
 * GET /api/statuses/privacy
 */
const getStatusPrivacy = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const [privacyRows] = await pool.query(
      'SELECT privacy_type FROM status_privacy WHERE user_id = ? LIMIT 1',
      [userId]
    );
    const privacyType = privacyRows[0]?.privacy_type || 'contacts';

    const [exclusions] = await pool.query(
      'SELECT excluded_user_id FROM status_privacy_exclusions WHERE user_id = ?',
      [userId]
    );
    const [allowed] = await pool.query(
      'SELECT allowed_user_id FROM status_privacy_allowed_users WHERE user_id = ?',
      [userId]
    );

    return res.status(200).json({
      success: true,
      privacy: {
        privacy_type: privacyType,
        excluded_user_ids: exclusions.map((r) => r.excluded_user_id),
        allowed_user_ids: allowed.map((r) => r.allowed_user_id)
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 12. Update Status Privacy Configuration
 * PUT /api/statuses/privacy
 */
const updateStatusPrivacy = async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const userId = req.user.id;
    const { privacyType, excludedUserIds = [], allowedUserIds = [] } = req.body;

    if (!['contacts', 'contacts_except', 'only_share_with'].includes(privacyType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid privacyType. Must be "contacts", "contacts_except", or "only_share_with".'
      });
    }

    await connection.beginTransaction();

    // Upsert status_privacy
    await connection.query(
      `INSERT INTO status_privacy (user_id, privacy_type, updated_at)
       VALUES (?, ?, NOW())
       ON DUPLICATE KEY UPDATE privacy_type = ?, updated_at = NOW()`,
      [userId, privacyType, privacyType]
    );

    // Update exclusions
    await connection.query('DELETE FROM status_privacy_exclusions WHERE user_id = ?', [userId]);
    if (privacyType === 'contacts_except' && Array.isArray(excludedUserIds) && excludedUserIds.length > 0) {
      for (const excId of excludedUserIds) {
        await connection.query(
          'INSERT IGNORE INTO status_privacy_exclusions (user_id, excluded_user_id) VALUES (?, ?)',
          [userId, excId]
        );
      }
    }

    // Update allowed users
    await connection.query('DELETE FROM status_privacy_allowed_users WHERE user_id = ?', [userId]);
    if (privacyType === 'only_share_with' && Array.isArray(allowedUserIds) && allowedUserIds.length > 0) {
      for (const allowId of allowedUserIds) {
        await connection.query(
          'INSERT IGNORE INTO status_privacy_allowed_users (user_id, allowed_user_id) VALUES (?, ?)',
          [userId, allowId]
        );
      }
    }

    await connection.commit();

    emitToUser(userId, 'status:privacy_updated', {
      privacyType,
      excludedUserIds,
      allowedUserIds
    });

    return res.status(200).json({
      success: true,
      message: 'Status privacy settings updated successfully',
      privacy: {
        privacy_type: privacyType,
        excluded_user_ids: excludedUserIds,
        allowed_user_ids: allowedUserIds
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
 * 13. Mute or Unmute a User's Statuses
 * POST /api/statuses/mute/:userId
 */
const toggleMuteUser = async (req, res, next) => {
  try {
    const currentUserId = req.user.id;
    const targetUserId = parseInt(req.params.userId, 10);

    if (currentUserId === targetUserId) {
      return res.status(400).json({ success: false, message: 'Cannot mute yourself' });
    }

    const [existing] = await pool.query(
      'SELECT id FROM status_mutes WHERE user_id = ? AND muted_user_id = ? LIMIT 1',
      [currentUserId, targetUserId]
    );

    let isMuted = false;
    if (existing.length > 0) {
      await pool.query('DELETE FROM status_mutes WHERE id = ?', [existing[0].id]);
      isMuted = false;
    } else {
      await pool.query(
        'INSERT INTO status_mutes (user_id, muted_user_id, created_at) VALUES (?, ?, NOW())',
        [currentUserId, targetUserId]
      );
      isMuted = true;
    }

    return res.status(200).json({
      success: true,
      isMuted,
      message: isMuted ? 'User statuses muted' : 'User statuses unmuted'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createTextStatus,
  createMediaStatus,
  getMyStatuses,
  getFeedStatuses,
  getStatusDetails,
  recordStatusView,
  getStatusViewers,
  toggleStatusReaction,
  replyToStatus,
  deleteStatus,
  getStatusPrivacy,
  updateStatusPrivacy,
  toggleMuteUser
};
