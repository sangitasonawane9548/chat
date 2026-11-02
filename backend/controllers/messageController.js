const { pool } = require('../config/database');
const { getIO, emitToUser, emitToConversation, isUserOnline } = require('../config/socket');

/**
 * 1. Get All Conversations for Authenticated User
 * GET /api/conversations
 */
const getConversations = async (req, res, next) => {
  try {
    const currentUserId = req.user.id;

    // Get all conversations user belongs to
    const [memberships] = await pool.query(
      `SELECT cm.conversation_id, cm.cleared_at, cm.cleared_message_id, cm.archived_at, cm.muted_until,
              c.conversation_type, c.created_at, c.updated_at
       FROM conversation_members cm
       JOIN conversations c ON cm.conversation_id = c.id
       WHERE cm.user_id = ?
       ORDER BY c.updated_at DESC`,
      [currentUserId]
    );

    const conversations = await Promise.all(
      memberships.map(async (row) => {
        const conversationId = row.conversation_id;
        const clearedMessageId = row.cleared_message_id;

        // Fetch other participant in 1-on-1 direct conversation or group metadata
        let participant = null;
        let group = null;
        if (row.conversation_type === 'direct') {
          const [otherMembers] = await pool.query(
            `SELECT u.id, u.full_name, u.username, p.profile_picture, p.is_online, p.last_seen, p.bio,
                    COALESCE(s.show_online_status, 1) as show_online_status
             FROM conversation_members cm
             JOIN users u ON cm.user_id = u.id
             JOIN user_profiles p ON u.id = p.user_id
             LEFT JOIN user_settings s ON u.id = s.user_id
             WHERE cm.conversation_id = ? AND cm.user_id != ?
             LIMIT 1`,
            [conversationId, currentUserId]
          );

          if (otherMembers.length > 0) {
            const om = otherMembers[0];
            const allowsPresence = om.show_online_status == 1;
            const activeOnline = isUserOnline(om.id);

            participant = {
              id: om.id,
              full_name: om.full_name,
              username: om.username,
              profile_picture: om.profile_picture,
              bio: om.bio,
              is_online: allowsPresence ? (Boolean(om.is_online) || activeOnline) : false,
              last_seen: allowsPresence ? om.last_seen : null,
              show_online_status: allowsPresence
            };
          }
        } else if (row.conversation_type === 'group') {
          const [groupRows] = await pool.query(
            `SELECT g.id, g.conversation_id, g.name, g.description, g.profile_image, g.created_by,
                    (SELECT COUNT(*) FROM group_members WHERE group_id = g.id AND status = 'active') as members_count
             FROM \`groups\` g
             WHERE g.conversation_id = ?
             LIMIT 1`,
            [conversationId]
          );

          if (groupRows.length > 0) {
            const grp = groupRows[0];
            group = {
              id: grp.id,
              conversation_id: grp.conversation_id,
              name: grp.name,
              description: grp.description,
              profile_image: grp.profile_image,
              created_by: grp.created_by,
              members_count: grp.members_count
            };
            participant = {
              id: null,
              full_name: grp.name,
              username: grp.name,
              profile_picture: grp.profile_image,
              bio: grp.description,
              is_group: true,
              members_count: grp.members_count
            };
          }
        }

        // Fetch last message (respecting delete for me, cleared_message_id)
        const [lastMsgRows] = await pool.query(
          `SELECT m.id, m.sender_id, m.message_type, m.message_content, m.created_at,
                  m.is_edited, m.deleted_for_everyone,
                  u.username AS sender_username, u.full_name AS sender_full_name,
                  mr.delivered_at, mr.read_at
           FROM messages m
           JOIN users u ON m.sender_id = u.id
           LEFT JOIN message_user_deletions mud ON m.id = mud.message_id AND mud.user_id = ?
           LEFT JOIN message_receipts mr ON m.id = mr.message_id AND mr.user_id != m.sender_id
           WHERE m.conversation_id = ?
             AND mud.id IS NULL
             AND (? IS NULL OR m.id > ?)
           ORDER BY m.id DESC
           LIMIT 1`,
          [currentUserId, conversationId, clearedMessageId, clearedMessageId]
        );

        let lastMessage = null;
        if (lastMsgRows.length > 0) {
          const m = lastMsgRows[0];
          let status = 'received';
          if (m.sender_id === currentUserId) {
            if (m.read_at) status = 'read';
            else if (m.delivered_at) status = 'delivered';
            else status = 'sent';
          }

          let contentPreview = m.deleted_for_everyone ? 'This message was deleted' : m.message_content;
          if (!m.deleted_for_everyone) {
            if (m.message_type === 'image') contentPreview = contentPreview || '📷 Photo';
            else if (m.message_type === 'audio') contentPreview = contentPreview || '🎤 Voice message';
            else if (m.message_type === 'video') contentPreview = contentPreview || '🎥 Video';
            else if (m.message_type === 'file') contentPreview = contentPreview || '📎 Document';
          }

          lastMessage = {
            id: m.id,
            sender_id: m.sender_id,
            message_type: m.message_type,
            message_content: contentPreview,
            created_at: m.created_at,
            is_edited: Boolean(m.is_edited),
            deleted_for_everyone: Boolean(m.deleted_for_everyone),
            sender_username: m.sender_username,
            sender_full_name: m.sender_full_name,
            status
          };
        }

        // Calculate unread count
        const [unreadRows] = await pool.query(
          `SELECT COUNT(*) as unread_count
           FROM messages m
           LEFT JOIN message_receipts mr ON m.id = mr.message_id AND mr.user_id = ?
           LEFT JOIN message_user_deletions mud ON m.id = mud.message_id AND mud.user_id = ?
           WHERE m.conversation_id = ?
             AND m.sender_id != ?
             AND (mr.read_at IS NULL OR mr.id IS NULL)
             AND mud.id IS NULL
             AND (? IS NULL OR m.id > ?)`,
          [currentUserId, currentUserId, conversationId, currentUserId, clearedMessageId, clearedMessageId]
        );

        const unreadCount = unreadRows[0]?.unread_count || 0;

        return {
          id: conversationId,
          conversation_type: row.conversation_type,
          created_at: row.created_at,
          updated_at: row.updated_at,
          participant,
          group,
          last_message: lastMessage,
          unread_count: unreadCount,
          is_archived: Boolean(row.archived_at),
          is_muted: row.muted_until ? new Date(row.muted_until) > new Date() : false
        };
      })
    );

    // Sort conversations so that active conversations with latest messages appear first
    conversations.sort((a, b) => {
      const timeA = a.last_message ? new Date(a.last_message.created_at).getTime() : new Date(a.updated_at).getTime();
      const timeB = b.last_message ? new Date(b.last_message.created_at).getTime() : new Date(b.updated_at).getTime();
      return timeB - timeA;
    });

    return res.status(200).json({
      success: true,
      conversations
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 2. Get Single Conversation Details
 * GET /api/conversations/:id
 */
const getConversationById = async (req, res, next) => {
  try {
    const conversationId = parseInt(req.params.id, 10);
    const currentUserId = req.user.id;

    const [memberships] = await pool.query(
      `SELECT cm.conversation_id, cm.cleared_at, cm.cleared_message_id, cm.archived_at, c.conversation_type, c.created_at, c.updated_at
       FROM conversation_members cm
       JOIN conversations c ON cm.conversation_id = c.id
       WHERE cm.conversation_id = ? AND cm.user_id = ?`,
      [conversationId, currentUserId]
    );

    if (memberships.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'You are not a member of this conversation'
      });
    }

    const row = memberships[0];
    let participant = null;
    let group = null;

    if (row.conversation_type === 'direct') {
      const [otherMembers] = await pool.query(
        `SELECT u.id, u.full_name, u.username, p.profile_picture, p.is_online, p.last_seen, p.bio,
                COALESCE(s.show_online_status, 1) as show_online_status
         FROM conversation_members cm
         JOIN users u ON cm.user_id = u.id
         JOIN user_profiles p ON u.id = p.user_id
         LEFT JOIN user_settings s ON u.id = s.user_id
         WHERE cm.conversation_id = ? AND cm.user_id != ?
         LIMIT 1`,
        [conversationId, currentUserId]
      );

      if (otherMembers.length > 0) {
        const om = otherMembers[0];
        const allowsPresence = om.show_online_status == 1;
        const activeOnline = isUserOnline(om.id);

        participant = {
          id: om.id,
          full_name: om.full_name,
          username: om.username,
          profile_picture: om.profile_picture,
          bio: om.bio,
          is_online: allowsPresence ? (Boolean(om.is_online) || activeOnline) : false,
          last_seen: allowsPresence ? om.last_seen : null,
          show_online_status: allowsPresence
        };
      }
    } else if (row.conversation_type === 'group') {
      const [groupRows] = await pool.query(
        `SELECT g.id, g.conversation_id, g.name, g.description, g.profile_image, g.created_by,
                (SELECT COUNT(*) FROM group_members WHERE group_id = g.id AND status = 'active') as members_count
         FROM \`groups\` g
         WHERE g.conversation_id = ?
         LIMIT 1`,
        [conversationId]
      );

      if (groupRows.length > 0) {
        const grp = groupRows[0];
        group = {
          id: grp.id,
          conversation_id: grp.conversation_id,
          name: grp.name,
          description: grp.description,
          profile_image: grp.profile_image,
          created_by: grp.created_by,
          members_count: grp.members_count
        };
        participant = {
          id: null,
          full_name: grp.name,
          username: grp.name,
          profile_picture: grp.profile_image,
          bio: grp.description,
          is_group: true,
          members_count: grp.members_count
        };
      }
    }

    return res.status(200).json({
      success: true,
      conversation: {
        id: conversationId,
        conversation_type: row.conversation_type,
        created_at: row.created_at,
        updated_at: row.updated_at,
        participant,
        group
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 3. Get Conversation Messages with Cursor Pagination
 * GET /api/conversations/:id/messages
 */
const getConversationMessages = async (req, res, next) => {
  try {
    const conversationId = parseInt(req.params.id, 10);
    const currentUserId = req.user.id;
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 100);
    const before = req.query.before ? parseInt(req.query.before, 10) : null;

    // Verify membership
    const [membership] = await pool.query(
      'SELECT cleared_message_id FROM conversation_members WHERE conversation_id = ? AND user_id = ?',
      [conversationId, currentUserId]
    );

    if (membership.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to view messages in this conversation'
      });
    }

    const clearedMessageId = membership[0].cleared_message_id;

    // Fetch messages
    const [rows] = await pool.query(
      `SELECT 
         m.id,
         m.conversation_id,
         m.sender_id,
         m.message_type,
         m.message_content,
         m.reply_to_message_id,
         m.forwarded_from_message_id,
         m.client_message_id,
         m.is_edited,
         m.deleted_for_everyone,
         m.created_at,
         m.updated_at,
         u.username AS sender_username,
         u.full_name AS sender_full_name,
         p.profile_picture AS sender_profile_picture,
         mr.delivered_at,
         mr.read_at
       FROM messages m
       JOIN users u ON m.sender_id = u.id
       JOIN user_profiles p ON u.id = p.user_id
       LEFT JOIN message_user_deletions mud ON m.id = mud.message_id AND mud.user_id = ?
       LEFT JOIN message_receipts mr ON m.id = mr.message_id AND mr.user_id != m.sender_id
       WHERE m.conversation_id = ?
         AND mud.id IS NULL
         AND (? IS NULL OR m.id > ?)
         AND (? IS NULL OR m.id < ?)
       ORDER BY m.id DESC
       LIMIT ?`,
      [currentUserId, conversationId, clearedMessageId, clearedMessageId, before, before, limit + 1]
    );

    const hasMore = rows.length > limit;
    const messageRows = hasMore ? rows.slice(0, limit) : rows;

    const messageIds = messageRows.map((m) => m.id);
    const attachmentsMap = {};
    const reactionsMap = {};
    const replyMap = {};

    if (messageIds.length > 0) {
      // 1. Fetch attachments
      const [attachments] = await pool.query(
        `SELECT id, message_id, uploaded_by, original_filename, storage_filename,
                file_name, file_url, file_type, file_size, attachment_type, duration_seconds, thumbnail_url, created_at
         FROM message_attachments
         WHERE message_id IN (?)`,
        [messageIds]
      );
      for (const att of attachments) {
        if (!attachmentsMap[att.message_id]) attachmentsMap[att.message_id] = [];
        attachmentsMap[att.message_id].push(att);
      }

      // 2. Fetch reactions
      const [reactions] = await pool.query(
        `SELECT mr.message_id, mr.reaction, mr.user_id, u.username, u.full_name
         FROM message_reactions mr
         JOIN users u ON mr.user_id = u.id
         WHERE mr.message_id IN (?)
         ORDER BY mr.created_at ASC`,
        [messageIds]
      );
      for (const r of reactions) {
        if (!reactionsMap[r.message_id]) reactionsMap[r.message_id] = {};
        if (!reactionsMap[r.message_id][r.reaction]) {
          reactionsMap[r.message_id][r.reaction] = {
            reaction: r.reaction,
            count: 0,
            users: [],
            hasReacted: false
          };
        }
        reactionsMap[r.message_id][r.reaction].count += 1;
        reactionsMap[r.message_id][r.reaction].users.push({
          id: r.user_id,
          username: r.username,
          full_name: r.full_name
        });
        if (r.user_id === currentUserId) {
          reactionsMap[r.message_id][r.reaction].hasReacted = true;
        }
      }

      // 3. Fetch quoted reply previews
      const replyIds = messageRows
        .map((m) => m.reply_to_message_id)
        .filter((id) => id !== null && id !== undefined);

      if (replyIds.length > 0) {
        const [replyRows] = await pool.query(
          `SELECT m.id, m.sender_id, m.message_type, m.message_content, m.deleted_for_everyone,
                  u.username AS sender_username
           FROM messages m
           JOIN users u ON m.sender_id = u.id
           WHERE m.id IN (?)`,
          [replyIds]
        );
        for (const rm of replyRows) {
          replyMap[rm.id] = {
            id: rm.id,
            sender_id: rm.sender_id,
            sender_username: rm.sender_username,
            message_type: rm.message_type,
            message_content: rm.deleted_for_everyone ? 'This message was deleted' : rm.message_content,
            deleted_for_everyone: Boolean(rm.deleted_for_everyone)
          };
        }
      }
    }

    const messages = messageRows.map((m) => {
      let status = 'received';
      if (m.sender_id === currentUserId) {
        if (m.read_at) status = 'read';
        else if (m.delivered_at) status = 'delivered';
        else status = 'sent';
      }

      const rawReactions = reactionsMap[m.id] ? Object.values(reactionsMap[m.id]) : [];

      return {
        id: m.id,
        conversation_id: m.conversation_id,
        sender_id: m.sender_id,
        sender: {
          id: m.sender_id,
          username: m.sender_username,
          full_name: m.sender_full_name,
          profile_picture: m.sender_profile_picture
        },
        message_type: m.message_type,
        message_content: m.deleted_for_everyone ? 'This message was deleted' : m.message_content,
        reply_to_message_id: m.reply_to_message_id,
        reply_to: m.reply_to_message_id ? (replyMap[m.reply_to_message_id] || null) : null,
        forwarded_from_message_id: m.forwarded_from_message_id || null,
        is_forwarded: Boolean(m.forwarded_from_message_id),
        client_message_id: m.client_message_id,
        is_edited: Boolean(m.is_edited),
        deleted_for_everyone: Boolean(m.deleted_for_everyone),
        status,
        delivered_at: m.delivered_at,
        read_at: m.read_at,
        created_at: m.created_at,
        updated_at: m.updated_at,
        attachments: attachmentsMap[m.id] || [],
        reactions: rawReactions
      };
    });

    // Return in chronological order (oldest to newest)
    messages.reverse();

    return res.status(200).json({
      success: true,
      messages,
      hasMore
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 4. Send a Message in Conversation
 * POST /api/conversations/:id/messages
 */
const sendMessage = async (req, res, next) => {
  try {
    const conversationId = parseInt(req.params.id, 10);
    const senderId = req.user.id;
    const { content, clientMessageId, messageType = 'text', replyToMessageId = null } = req.body;

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Message content cannot be empty'
      });
    }

    if (content.length > 5000) {
      return res.status(400).json({
        success: false,
        message: 'Message content cannot exceed 5000 characters'
      });
    }

    // Verify membership
    const [membership] = await pool.query(
      'SELECT id FROM conversation_members WHERE conversation_id = ? AND user_id = ?',
      [conversationId, senderId]
    );

    if (membership.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to send messages in this conversation'
      });
    }

    // Check if sender account is suspended
    if (req.user?.account_status === 'suspended') {
      return res.status(403).json({
        success: false,
        message: 'Your account is suspended. You cannot send messages.'
      });
    }

    // Check if group conversation is suspended by administrator
    const [groupCheck] = await pool.query(
      'SELECT id, status FROM `groups` WHERE conversation_id = ?',
      [conversationId]
    );
    if (groupCheck.length > 0 && groupCheck[0].status === 'suspended') {
      return res.status(403).json({
        success: false,
        message: 'This group has been suspended by administration. Sending messages is disabled.'
      });
    }

    // Idempotency check via clientMessageId
    if (clientMessageId) {
      const [existing] = await pool.query(
        `SELECT m.id, m.conversation_id, m.sender_id, m.message_type, m.message_content,
                m.client_message_id, m.is_edited, m.deleted_for_everyone, m.created_at, m.updated_at,
                u.username AS sender_username, u.full_name AS sender_full_name,
                p.profile_picture AS sender_profile_picture,
                mr.delivered_at, mr.read_at
         FROM messages m
         JOIN users u ON m.sender_id = u.id
         JOIN user_profiles p ON u.id = p.user_id
         LEFT JOIN message_receipts mr ON m.id = mr.message_id AND mr.user_id != m.sender_id
         WHERE m.conversation_id = ? AND m.client_message_id = ?
         LIMIT 1`,
        [conversationId, clientMessageId]
      );

      if (existing.length > 0) {
        const m = existing[0];
        let status = 'sent';
        if (m.read_at) status = 'read';
        else if (m.delivered_at) status = 'delivered';

        return res.status(200).json({
          success: true,
          message: {
            id: m.id,
            conversation_id: m.conversation_id,
            sender_id: m.sender_id,
            sender: {
              id: m.sender_id,
              username: m.sender_username,
              full_name: m.sender_full_name,
              profile_picture: m.sender_profile_picture
            },
            message_type: m.message_type,
            message_content: m.deleted_for_everyone ? 'This message was deleted' : m.message_content,
            reply_to_message_id: m.reply_to_message_id,
            client_message_id: m.client_message_id,
            is_edited: Boolean(m.is_edited),
            deleted_for_everyone: Boolean(m.deleted_for_everyone),
            status,
            delivered_at: m.delivered_at,
            read_at: m.read_at,
            created_at: m.created_at,
            updated_at: m.updated_at
          }
        });
      }
    }

    // Identify recipient(s) in conversation
    const [recipients] = await pool.query(
      'SELECT user_id FROM conversation_members WHERE conversation_id = ? AND user_id != ? AND (status IS NULL OR status = "active")',
      [conversationId, senderId]
    );

    // Insert message
    const [insertResult] = await pool.query(
      `INSERT INTO messages 
       (conversation_id, sender_id, message_type, message_content, reply_to_message_id, client_message_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [conversationId, senderId, messageType, content.trim(), replyToMessageId || null, clientMessageId || null]
    );

    const messageId = insertResult.insertId;

    // Create delivery receipt for all active recipients
    let anyRecipientOnline = false;
    for (const rec of recipients) {
      const isOnline = isUserOnline(rec.user_id);
      if (isOnline) anyRecipientOnline = true;
      const recDeliveredAt = isOnline ? new Date() : null;
      await pool.query(
        `INSERT INTO message_receipts (message_id, user_id, delivered_at)
         VALUES (?, ?, ?)`,
        [messageId, rec.user_id, recDeliveredAt]
      );
    }

    const deliveredAt = anyRecipientOnline ? new Date() : null;

    // Update conversation timestamp
    await pool.query(
      'UPDATE conversations SET updated_at = NOW() WHERE id = ?',
      [conversationId]
    );

    // Update sender's last read status
    await pool.query(
      `UPDATE conversation_members 
       SET last_read_message_id = ?, last_read_at = NOW()
       WHERE conversation_id = ? AND user_id = ?`,
      [messageId, conversationId, senderId]
    );

    // If replyToMessageId is present, fetch quoted message details
    let replyToPreview = null;
    if (replyToMessageId) {
      const [replyRows] = await pool.query(
        `SELECT m.id, m.sender_id, m.message_type, m.message_content, m.deleted_for_everyone,
                u.username AS sender_username
         FROM messages m
         JOIN users u ON m.sender_id = u.id
         WHERE m.id = ?`,
        [replyToMessageId]
      );
      if (replyRows.length > 0) {
        const rm = replyRows[0];
        replyToPreview = {
          id: rm.id,
          sender_id: rm.sender_id,
          sender_username: rm.sender_username,
          message_type: rm.message_type,
          message_content: rm.deleted_for_everyone ? 'This message was deleted' : rm.message_content,
          deleted_for_everyone: Boolean(rm.deleted_for_everyone)
        };
      }
    }

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
      message_type: messageType,
      message_content: content.trim(),
      reply_to_message_id: replyToMessageId || null,
      reply_to: replyToPreview,
      forwarded_from_message_id: null,
      is_forwarded: false,
      client_message_id: clientMessageId || null,
      is_edited: false,
      deleted_for_everyone: false,
      status: deliveredAt ? 'delivered' : 'sent',
      delivered_at: deliveredAt,
      read_at: null,
      created_at: new Date(),
      updated_at: new Date(),
      attachments: [],
      reactions: []
    };

    // Emit real-time events via Socket.IO
    try {
      // 1. Emit to conversation room (for all active users in chat)
      emitToConversation(conversationId, 'new_message', formattedMessage);

      // 2. Emit to each recipient's user room (for sidebar update/sound/badge)
      for (const rec of recipients) {
        emitToUser(rec.user_id, 'new_message', formattedMessage);
        emitToUser(rec.user_id, 'conversation_updated', {
          conversationId,
          lastMessage: formattedMessage
        });
      }

      // 3. If any recipient is online, notify sender of delivery
      if (anyRecipientOnline) {
        emitToUser(senderId, 'message_delivered', {
          messageId,
          conversationId,
          deliveredAt: new Date()
        });
      }
    } catch (socketErr) {
      console.error('[MessageController] Socket emission warning:', socketErr.message);
    }

    return res.status(201).json({
      success: true,
      message: formattedMessage
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 5. Edit Message (Sender only, within 15 mins)
 * PATCH /api/messages/:id
 */
const editMessage = async (req, res, next) => {
  try {
    const messageId = parseInt(req.params.id, 10);
    const currentUserId = req.user.id;
    const { content } = req.body;

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Message content cannot be empty'
      });
    }

    if (content.length > 5000) {
      return res.status(400).json({
        success: false,
        message: 'Message content cannot exceed 5000 characters'
      });
    }

    const [rows] = await pool.query(
      'SELECT id, conversation_id, sender_id, message_content, deleted_for_everyone, created_at FROM messages WHERE id = ?',
      [messageId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    const message = rows[0];

    if (message.sender_id !== currentUserId) {
      return res.status(403).json({
        success: false,
        message: 'You can only edit your own messages'
      });
    }

    if (message.deleted_for_everyone) {
      return res.status(400).json({
        success: false,
        message: 'Cannot edit a deleted message'
      });
    }

    // 15-minute time window check
    const messageAgeMinutes = (Date.now() - new Date(message.created_at).getTime()) / (1000 * 60);
    if (messageAgeMinutes > 15) {
      return res.status(400).json({
        success: false,
        message: 'Messages can only be edited within 15 minutes of sending'
      });
    }

    await pool.query(
      'UPDATE messages SET message_content = ?, is_edited = 1, updated_at = NOW() WHERE id = ?',
      [content.trim(), messageId]
    );

    const updatedTimestamp = new Date();

    const payload = {
      messageId,
      conversationId: message.conversation_id,
      content: content.trim(),
      is_edited: true,
      updated_at: updatedTimestamp
    };

    // Emit real-time edit event to conversation room and to each member directly
    emitToConversation(message.conversation_id, 'message_edited', payload);
    const [otherMembers] = await pool.query(
      'SELECT user_id FROM conversation_members WHERE conversation_id = ? AND user_id != ?',
      [message.conversation_id, currentUserId]
    );
    for (const om of otherMembers) {
      emitToUser(om.user_id, 'message_edited', payload);
    }

    return res.status(200).json({
      success: true,
      message: 'Message updated successfully',
      data: payload
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 6. Delete Message For Me (Hide locally for requesting user)
 * DELETE /api/messages/:id
 */
const deleteMessageForMe = async (req, res, next) => {
  try {
    const messageId = parseInt(req.params.id, 10);
    const currentUserId = req.user.id;

    // Verify message exists and user is a member of the conversation
    const [rows] = await pool.query(
      `SELECT m.id, m.conversation_id 
       FROM messages m
       JOIN conversation_members cm ON m.conversation_id = cm.conversation_id
       WHERE m.id = ? AND cm.user_id = ?`,
      [messageId, currentUserId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Message not found or you are not a member of this conversation'
      });
    }

    // Insert into message_user_deletions
    await pool.query(
      `INSERT INTO message_user_deletions (message_id, user_id)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE id=id`,
      [messageId, currentUserId]
    );

    return res.status(200).json({
      success: true,
      message: 'Message deleted for you',
      messageId,
      conversationId: rows[0].conversation_id
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 7. Delete Message For Everyone (Sender only, within 15 mins)
 * POST /api/messages/:id/delete-for-everyone
 */
const deleteMessageForEveryone = async (req, res, next) => {
  try {
    const messageId = parseInt(req.params.id, 10);
    const currentUserId = req.user.id;

    const [rows] = await pool.query(
      'SELECT id, conversation_id, sender_id, deleted_for_everyone, created_at FROM messages WHERE id = ?',
      [messageId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    const message = rows[0];

    if (message.sender_id !== currentUserId) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own messages for everyone'
      });
    }

    if (message.deleted_for_everyone) {
      return res.status(200).json({
        success: true,
        message: 'Message already deleted for everyone',
        messageId
      });
    }

    // 15-minute time window check
    const messageAgeMinutes = (Date.now() - new Date(message.created_at).getTime()) / (1000 * 60);
    if (messageAgeMinutes > 15) {
      return res.status(400).json({
        success: false,
        message: 'Messages can only be deleted for everyone within 15 minutes of sending'
      });
    }

    await pool.query(
      'UPDATE messages SET deleted_for_everyone = 1, message_content = "This message was deleted", updated_at = NOW() WHERE id = ?',
      [messageId]
    );

    const payload = {
      messageId,
      conversationId: message.conversation_id,
      deletedForEveryone: true
    };

    // Emit real-time delete event to conversation and to each member directly
    emitToConversation(message.conversation_id, 'message_deleted', payload);
    const [otherMembers] = await pool.query(
      'SELECT user_id FROM conversation_members WHERE conversation_id = ? AND user_id != ?',
      [message.conversation_id, currentUserId]
    );
    for (const om of otherMembers) {
      emitToUser(om.user_id, 'message_deleted', payload);
    }

    return res.status(200).json({
      success: true,
      message: 'Message deleted for everyone',
      messageId,
      conversationId: message.conversation_id
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 8. Mark Conversation Messages as Read
 * POST /api/conversations/:id/read
 */
const markConversationAsRead = async (req, res, next) => {
  try {
    const conversationId = parseInt(req.params.id, 10);
    const currentUserId = req.user.id;

    // Verify membership
    const [membership] = await pool.query(
      'SELECT id FROM conversation_members WHERE conversation_id = ? AND user_id = ?',
      [conversationId, currentUserId]
    );

    if (membership.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'You are not a member of this conversation'
      });
    }

    // Update receipts for messages sent by the other party
    await pool.query(
      `UPDATE message_receipts mr
       JOIN messages m ON mr.message_id = m.id
       SET mr.read_at = NOW(), mr.delivered_at = COALESCE(mr.delivered_at, NOW())
       WHERE m.conversation_id = ? AND mr.user_id = ? AND mr.read_at IS NULL`,
      [conversationId, currentUserId]
    );

    // Update conversation_members last_read_message_id
    await pool.query(
      `UPDATE conversation_members
       SET last_read_at = NOW(),
           last_read_message_id = (SELECT COALESCE(MAX(id), 0) FROM messages WHERE conversation_id = ?)
       WHERE conversation_id = ? AND user_id = ?`,
      [conversationId, conversationId, currentUserId]
    );

    const readAt = new Date();

    // Broadcast messages_read event
    emitToConversation(conversationId, 'messages_read', {
      conversationId,
      readerId: currentUserId,
      readAt
    });

    // Also notify other member specifically
    const [otherMembers] = await pool.query(
      'SELECT user_id FROM conversation_members WHERE conversation_id = ? AND user_id != ?',
      [conversationId, currentUserId]
    );
    if (otherMembers.length > 0) {
      emitToUser(otherMembers[0].user_id, 'messages_read', {
        conversationId,
        readerId: currentUserId,
        readAt
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Conversation marked as read'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 9. Search Messages in Conversation
 * GET /api/conversations/:id/search
 */
const searchConversationMessages = async (req, res, next) => {
  try {
    const conversationId = parseInt(req.params.id, 10);
    const currentUserId = req.user.id;
    const query = req.query.q ? req.query.q.trim() : '';

    if (!query) {
      return res.status(200).json({
        success: true,
        results: []
      });
    }

    // Verify membership
    const [membership] = await pool.query(
      'SELECT cleared_message_id FROM conversation_members WHERE conversation_id = ? AND user_id = ?',
      [conversationId, currentUserId]
    );

    if (membership.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'You are not a member of this conversation'
      });
    }

    const clearedMessageId = membership[0].cleared_message_id;

    const [rows] = await pool.query(
      `SELECT 
         m.id,
         m.conversation_id,
         m.sender_id,
         m.message_type,
         m.message_content,
         m.created_at,
         m.is_edited,
         u.username AS sender_username,
         u.full_name AS sender_full_name
       FROM messages m
       JOIN users u ON m.sender_id = u.id
       LEFT JOIN message_user_deletions mud ON m.id = mud.message_id AND mud.user_id = ?
       WHERE m.conversation_id = ?
         AND mud.id IS NULL
         AND m.deleted_for_everyone = 0
         AND (? IS NULL OR m.id > ?)
         AND m.message_content LIKE ?
       ORDER BY m.id DESC
       LIMIT 50`,
      [currentUserId, conversationId, clearedMessageId, clearedMessageId, `%${query}%`]
    );

    return res.status(200).json({
      success: true,
      results: rows
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 10. Clear Conversation History for Current User
 * POST /api/conversations/:id/clear
 */
const clearConversation = async (req, res, next) => {
  try {
    const conversationId = parseInt(req.params.id, 10);
    const currentUserId = req.user.id;

    const [membership] = await pool.query(
      'SELECT id FROM conversation_members WHERE conversation_id = ? AND user_id = ?',
      [conversationId, currentUserId]
    );

    if (membership.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'You are not a member of this conversation'
      });
    }

    const [maxMsg] = await pool.query(
      'SELECT COALESCE(MAX(id), 0) AS max_id FROM messages WHERE conversation_id = ?',
      [conversationId]
    );
    const clearedMessageId = maxMsg[0].max_id;

    await pool.query(
      'UPDATE conversation_members SET cleared_at = NOW(), cleared_message_id = ? WHERE conversation_id = ? AND user_id = ?',
      [clearedMessageId, conversationId, currentUserId]
    );

    return res.status(200).json({
      success: true,
      message: 'Conversation history cleared for you'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getConversations,
  getConversationById,
  getConversationMessages,
  sendMessage,
  editMessage,
  deleteMessageForMe,
  deleteMessageForEveryone,
  markConversationAsRead,
  searchConversationMessages,
  clearConversation
};
