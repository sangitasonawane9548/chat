const path = require('path');
const fs = require('fs');
const { pool } = require('../config/database');
const { getIO, emitToUser, emitToConversation, isUserOnline } = require('../config/socket');
const storageService = require('../services/storageService');

/**
 * 1. Upload Media Attachment & Create Message
 * POST /api/conversations/:id/attachments
 */
const uploadAttachment = async (req, res, next) => {
  try {
    const conversationId = parseInt(req.params.id, 10);
    const senderId = req.user.id;
    const {
      content = '',
      caption = '',
      replyToMessageId = null,
      clientMessageId = null,
      durationSeconds = null
    } = req.body;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    // Verify conversation membership
    const [membership] = await pool.query(
      'SELECT id FROM conversation_members WHERE conversation_id = ? AND user_id = ?',
      [conversationId, senderId]
    );

    if (membership.length === 0) {
      // Remove uploaded file if user not member
      try {
        fs.unlinkSync(req.file.path);
      } catch (_) {}

      return res.status(403).json({
        success: false,
        message: 'You are not authorized to send messages in this conversation'
      });
    }

    // Determine message type and attachment type
    const category = req.file.category || 'document';
    let messageType = 'file';
    let attachmentType = 'document';

    if (category === 'image') {
      messageType = 'image';
      attachmentType = 'image';
    } else if (category === 'video') {
      messageType = 'video';
      attachmentType = 'video';
    } else if (category === 'audio') {
      messageType = 'audio';
      attachmentType = 'audio';
    } else {
      messageType = 'file';
      attachmentType = 'document';
    }

    const messageContent = (caption || content || req.file.originalname).trim();
    const duration = durationSeconds ? parseInt(durationSeconds, 10) : null;

    // Check recipients
    const [recipients] = await pool.query(
      'SELECT user_id FROM conversation_members WHERE conversation_id = ? AND user_id != ? AND (status IS NULL OR status = "active")',
      [conversationId, senderId]
    );

    // Insert message into MySQL
    const [msgResult] = await pool.query(
      `INSERT INTO messages 
       (conversation_id, sender_id, message_type, message_content, reply_to_message_id, client_message_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [conversationId, senderId, messageType, messageContent, replyToMessageId || null, clientMessageId || null]
    );

    const messageId = msgResult.insertId;
    const storageFilename = req.file.filename;
    const originalFilename = req.file.originalname;
    const fileUrl = storageService.getFileUrl(storageFilename, messageId);

    // Insert attachment row into message_attachments
    const [attResult] = await pool.query(
      `INSERT INTO message_attachments
       (message_id, uploaded_by, original_filename, storage_filename, file_name, file_url, file_type, file_size, attachment_type, duration_seconds)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        messageId,
        senderId,
        originalFilename,
        storageFilename,
        originalFilename,
        fileUrl,
        req.file.mimetype,
        req.file.size,
        attachmentType,
        duration
      ]
    );

    const attachmentId = attResult.insertId;

    // Insert delivery receipts for all active recipients
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

    // If replyToMessageId present, fetch quoted message details
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

    // Structure attachment payload
    const attachmentPayload = {
      id: attachmentId,
      message_id: messageId,
      uploaded_by: senderId,
      original_filename: originalFilename,
      storage_filename: storageFilename,
      file_name: originalFilename,
      file_url: fileUrl,
      file_type: req.file.mimetype,
      file_size: req.file.size,
      attachment_type: attachmentType,
      duration_seconds: duration,
      thumbnail_url: null,
      created_at: new Date()
    };

    // Full message payload matching client interface
    const messagePayload = {
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
      message_content: messageContent,
      reply_to_message_id: replyToMessageId ? parseInt(replyToMessageId, 10) : null,
      reply_to: replyToPreview,
      forwarded_from_message_id: null,
      is_forwarded: false,
      client_message_id: clientMessageId,
      is_edited: false,
      deleted_for_everyone: false,
      status: anyRecipientOnline ? 'delivered' : 'sent',
      delivered_at: deliveredAt,
      read_at: null,
      created_at: new Date(),
      updated_at: new Date(),
      attachments: [attachmentPayload],
      reactions: []
    };

    // Broadcast via Socket.IO
    emitToConversation(conversationId, 'new_message', messagePayload);
    for (const rec of recipients) {
      emitToUser(rec.user_id, 'new_message', messagePayload);
      emitToUser(rec.user_id, 'conversation_updated', {
        conversationId,
        lastMessage: messagePayload
      });
    }
    if (anyRecipientOnline) {
      emitToUser(senderId, 'message_delivered', {
        messageId,
        conversationId,
        deliveredAt: new Date()
      });
    }

    return res.status(201).json({
      success: true,
      message: messagePayload
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 2. Get / View Attachment File (Authorized Stream)
 * GET /api/attachments/:id
 */
const getAttachmentFile = async (req, res, next) => {
  try {
    const attachmentId = parseInt(req.params.id, 10);
    const userId = req.user.id;

    // Query attachment with conversation membership verification
    const [rows] = await pool.query(
      `SELECT a.id, a.storage_filename, a.original_filename, a.file_type, a.file_size,
              m.conversation_id
       FROM message_attachments a
       JOIN messages m ON a.message_id = m.id
       WHERE a.id = ?`,
      [attachmentId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Attachment not found'
      });
    }

    const attachment = rows[0];

    // Check membership
    const [membership] = await pool.query(
      'SELECT id FROM conversation_members WHERE conversation_id = ? AND user_id = ?',
      [attachment.conversation_id, userId]
    );

    if (membership.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to access this attachment'
      });
    }

    const filePath = storageService.getAbsolutePath(attachment.storage_filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'File does not exist on server storage'
      });
    }

    res.setHeader('Content-Type', attachment.file_type || 'application/octet-stream');
    return res.sendFile(filePath);
  } catch (error) {
    next(error);
  }
};

/**
 * 3. Download Attachment File with Original Filename
 * GET /api/attachments/:id/download
 */
const downloadAttachmentFile = async (req, res, next) => {
  try {
    const attachmentId = parseInt(req.params.id, 10);
    const userId = req.user.id;

    const [rows] = await pool.query(
      `SELECT a.id, a.storage_filename, a.original_filename, a.file_name, a.file_type,
              m.conversation_id
       FROM message_attachments a
       JOIN messages m ON a.message_id = m.id
       WHERE a.id = ?`,
      [attachmentId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Attachment not found'
      });
    }

    const attachment = rows[0];

    // Verify membership
    const [membership] = await pool.query(
      'SELECT id FROM conversation_members WHERE conversation_id = ? AND user_id = ?',
      [attachment.conversation_id, userId]
    );

    if (membership.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to download this attachment'
      });
    }

    const filePath = storageService.getAbsolutePath(attachment.storage_filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'File does not exist on server storage'
      });
    }

    const downloadName = attachment.original_filename || attachment.file_name || 'download';
    return res.download(filePath, downloadName);
  } catch (error) {
    next(error);
  }
};

/**
 * Helper: Helper to fetch grouped reactions for a message
 */
const getMessageReactionsSummary = async (messageId, currentUserId) => {
  const [rows] = await pool.query(
    `SELECT mr.reaction, mr.user_id, u.username, u.full_name
     FROM message_reactions mr
     JOIN users u ON mr.user_id = u.id
     WHERE mr.message_id = ?
     ORDER BY mr.created_at ASC`,
    [messageId]
  );

  const reactionMap = {};
  for (const r of rows) {
    if (!reactionMap[r.reaction]) {
      reactionMap[r.reaction] = {
        reaction: r.reaction,
        count: 0,
        users: [],
        hasReacted: false
      };
    }
    reactionMap[r.reaction].count += 1;
    reactionMap[r.reaction].users.push({
      id: r.user_id,
      username: r.username,
      full_name: r.full_name
    });
    if (r.user_id === currentUserId) {
      reactionMap[r.reaction].hasReacted = true;
    }
  }

  return Object.values(reactionMap);
};

/**
 * 4. Add or Toggle Emoji Reaction on Message
 * POST /api/messages/:id/reactions
 */
const toggleReaction = async (req, res, next) => {
  try {
    const messageId = parseInt(req.params.id, 10);
    const userId = req.user.id;
    const { reaction } = req.body;

    if (!reaction || typeof reaction !== 'string' || reaction.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Reaction emoji is required'
      });
    }

    const cleanReaction = reaction.trim();

    // Verify message exists and user is member of conversation
    const [msgRows] = await pool.query(
      `SELECT m.id, m.conversation_id, m.deleted_for_everyone
       FROM messages m
       WHERE m.id = ?`,
      [messageId]
    );

    if (msgRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    const msg = msgRows[0];
    if (msg.deleted_for_everyone) {
      return res.status(400).json({
        success: false,
        message: 'Cannot react to a deleted message'
      });
    }

    // Verify membership
    const [membership] = await pool.query(
      'SELECT id FROM conversation_members WHERE conversation_id = ? AND user_id = ?',
      [msg.conversation_id, userId]
    );

    if (membership.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to react to messages in this conversation'
      });
    }

    // Check if user already has this reaction
    const [existing] = await pool.query(
      'SELECT id FROM message_reactions WHERE message_id = ? AND user_id = ? AND reaction = ?',
      [messageId, userId, cleanReaction]
    );

    let action = 'added';
    if (existing.length > 0) {
      // Toggle off: remove reaction
      await pool.query(
        'DELETE FROM message_reactions WHERE id = ?',
        [existing[0].id]
      );
      action = 'removed';
    } else {
      // Add reaction
      await pool.query(
        'INSERT INTO message_reactions (message_id, user_id, reaction) VALUES (?, ?, ?)',
        [messageId, userId, cleanReaction]
      );
      action = 'added';
    }

    // Fetch updated reactions summary
    const reactions = await getMessageReactionsSummary(messageId, userId);

    // Broadcast via Socket.IO
    const updatePayload = {
      messageId,
      conversationId: msg.conversation_id,
      reaction: cleanReaction,
      action,
      userId,
      username: req.user.username,
      reactions
    };

    emitToConversation(msg.conversation_id, 'message_reaction_updated', updatePayload);

    // Also emit to members individually
    const [members] = await pool.query(
      'SELECT user_id FROM conversation_members WHERE conversation_id = ?',
      [msg.conversation_id]
    );
    for (const member of members) {
      emitToUser(member.user_id, 'message_reaction_updated', updatePayload);
    }

    return res.status(200).json({
      success: true,
      action,
      reaction: cleanReaction,
      reactions
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 5. Remove Emoji Reaction
 * DELETE /api/messages/:id/reactions
 */
const removeReaction = async (req, res, next) => {
  try {
    const messageId = parseInt(req.params.id, 10);
    const userId = req.user.id;
    const { reaction } = req.body || req.query;

    const [msgRows] = await pool.query(
      'SELECT id, conversation_id FROM messages WHERE id = ?',
      [messageId]
    );

    if (msgRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    const msg = msgRows[0];

    // Verify membership
    const [membership] = await pool.query(
      'SELECT id FROM conversation_members WHERE conversation_id = ? AND user_id = ?',
      [msg.conversation_id, userId]
    );

    if (membership.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to modify reactions in this conversation'
      });
    }

    if (reaction) {
      await pool.query(
        'DELETE FROM message_reactions WHERE message_id = ? AND user_id = ? AND reaction = ?',
        [messageId, userId, reaction]
      );
    } else {
      await pool.query(
        'DELETE FROM message_reactions WHERE message_id = ? AND user_id = ?',
        [messageId, userId]
      );
    }

    const reactions = await getMessageReactionsSummary(messageId, userId);

    const updatePayload = {
      messageId,
      conversationId: msg.conversation_id,
      reaction: reaction || null,
      action: 'removed',
      userId,
      username: req.user.username,
      reactions
    };

    emitToConversation(msg.conversation_id, 'message_reaction_updated', updatePayload);
    return res.status(200).json({
      success: true,
      action: 'removed',
      reactions
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 6. Forward Message to Another Conversation
 * POST /api/messages/:id/forward
 */
const forwardMessage = async (req, res, next) => {
  try {
    const messageId = parseInt(req.params.id, 10);
    const senderId = req.user.id;
    const { targetConversationId } = req.body;

    if (!targetConversationId) {
      return res.status(400).json({
        success: false,
        message: 'targetConversationId is required'
      });
    }

    const targetConvId = parseInt(targetConversationId, 10);

    // Fetch source message
    const [sourceRows] = await pool.query(
      `SELECT m.id, m.conversation_id, m.message_type, m.message_content, m.deleted_for_everyone
       FROM messages m
       WHERE m.id = ?`,
      [messageId]
    );

    if (sourceRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Source message not found'
      });
    }

    const sourceMsg = sourceRows[0];
    if (sourceMsg.deleted_for_everyone) {
      return res.status(400).json({
        success: false,
        message: 'Cannot forward a deleted message'
      });
    }

    // Verify membership in source conversation
    const [sourceMember] = await pool.query(
      'SELECT id FROM conversation_members WHERE conversation_id = ? AND user_id = ?',
      [sourceMsg.conversation_id, senderId]
    );

    if (sourceMember.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'You are not a member of the source conversation'
      });
    }

    // Verify membership in target conversation
    const [targetMember] = await pool.query(
      'SELECT id FROM conversation_members WHERE conversation_id = ? AND user_id = ?',
      [targetConvId, senderId]
    );

    if (targetMember.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to send messages in the destination conversation'
      });
    }

    // Identify target recipient
    const [recipients] = await pool.query(
      'SELECT user_id FROM conversation_members WHERE conversation_id = ? AND user_id != ?',
      [targetConvId, senderId]
    );

    const recipientId = recipients[0]?.user_id || null;
    const recipientOnline = recipientId ? isUserOnline(recipientId) : false;
    const deliveredAt = recipientOnline ? new Date() : null;

    // Insert forwarded message
    const [insertResult] = await pool.query(
      `INSERT INTO messages 
       (conversation_id, sender_id, message_type, message_content, forwarded_from_message_id)
       VALUES (?, ?, ?, ?, ?)`,
      [targetConvId, senderId, sourceMsg.message_type, sourceMsg.message_content, sourceMsg.id]
    );

    const newMsgId = insertResult.insertId;

    // If source message had attachments, copy attachment records
    const [sourceAttachments] = await pool.query(
      `SELECT original_filename, storage_filename, file_name, file_url, file_type, file_size, attachment_type, duration_seconds, thumbnail_url
       FROM message_attachments
       WHERE message_id = ?`,
      [sourceMsg.id]
    );

    const newAttachments = [];
    for (const sa of sourceAttachments) {
      const [newAttResult] = await pool.query(
        `INSERT INTO message_attachments
         (message_id, uploaded_by, original_filename, storage_filename, file_name, file_url, file_type, file_size, attachment_type, duration_seconds, thumbnail_url)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newMsgId,
          senderId,
          sa.original_filename || sa.file_name,
          sa.storage_filename,
          sa.file_name,
          sa.file_url,
          sa.file_type,
          sa.file_size,
          sa.attachment_type,
          sa.duration_seconds,
          sa.thumbnail_url
        ]
      );

      newAttachments.push({
        id: newAttResult.insertId,
        message_id: newMsgId,
        uploaded_by: senderId,
        original_filename: sa.original_filename || sa.file_name,
        storage_filename: sa.storage_filename,
        file_name: sa.file_name,
        file_url: sa.file_url,
        file_type: sa.file_type,
        file_size: sa.file_size,
        attachment_type: sa.attachment_type,
        duration_seconds: sa.duration_seconds,
        thumbnail_url: sa.thumbnail_url
      });
    }

    // Insert delivery receipt
    if (recipientId) {
      await pool.query(
        `INSERT INTO message_receipts (message_id, user_id, delivered_at)
         VALUES (?, ?, ?)`,
        [newMsgId, recipientId, deliveredAt]
      );
    }

    // Update conversation timestamp
    await pool.query(
      'UPDATE conversations SET updated_at = NOW() WHERE id = ?',
      [targetConvId]
    );

    // Full message payload
    const forwardedPayload = {
      id: newMsgId,
      conversation_id: targetConvId,
      sender_id: senderId,
      sender: {
        id: req.user.id,
        username: req.user.username,
        full_name: req.user.full_name,
        profile_picture: req.user.profile_picture
      },
      message_type: sourceMsg.message_type,
      message_content: sourceMsg.message_content,
      reply_to_message_id: null,
      reply_to: null,
      forwarded_from_message_id: sourceMsg.id,
      is_forwarded: true,
      client_message_id: null,
      is_edited: false,
      deleted_for_everyone: false,
      status: recipientOnline ? 'delivered' : 'sent',
      delivered_at: deliveredAt,
      read_at: null,
      created_at: new Date(),
      updated_at: new Date(),
      attachments: newAttachments,
      reactions: []
    };

    // Emit Socket.IO event to target conversation
    emitToConversation(targetConvId, 'new_message', forwardedPayload);
    if (recipientId) {
      emitToUser(recipientId, 'new_message', forwardedPayload);
    }

    return res.status(201).json({
      success: true,
      message: forwardedPayload
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  uploadAttachment,
  getAttachmentFile,
  downloadAttachmentFile,
  toggleReaction,
  removeReaction,
  forwardMessage,
  getMessageReactionsSummary
};

