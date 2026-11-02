const { pool } = require('../config/database');
const { emitToUser } = require('../config/socket');

/**
 * Send a notification to a user with MySQL persistence and real-time Socket.IO dispatch
 * @param {Object} params
 * @param {number} params.userId
 * @param {string} params.type - 'message' | 'call' | 'missed_call' | 'chat_request' | 'group' | 'status' | 'system'
 * @param {string} params.title
 * @param {string} params.description
 * @param {number|null} [params.referenceId]
 */
const sendNotification = async ({ userId, type, title, description, referenceId = null }) => {
  try {
    const [result] = await pool.query(
      `INSERT INTO notifications (user_id, notification_type, title, description, reference_id, is_read, created_at)
       VALUES (?, ?, ?, ?, ?, 0, NOW())`,
      [userId, type, title, description, referenceId]
    );

    const notificationId = result.insertId;

    const [unreadCountResult] = await pool.query(
      'SELECT COUNT(*) AS unread_count FROM notifications WHERE user_id = ? AND is_read = 0',
      [userId]
    );

    const notificationPayload = {
      id: notificationId,
      user_id: userId,
      notification_type: type,
      title,
      description,
      reference_id: referenceId,
      is_read: 0,
      created_at: new Date()
    };

    // Emit real-time notification to the target user's personal room
    emitToUser(userId, 'new_notification', {
      notification: notificationPayload,
      unreadCount: unreadCountResult[0]?.unread_count || 1
    });

    return notificationPayload;
  } catch (error) {
    console.error('[NotificationService] Error creating notification:', error.message);
    return null;
  }
};

/**
 * Send a missed call notification
 */
const sendMissedCallNotification = async ({ callerId, receiverId, callType = 'audio', callerName = 'Someone' }) => {
  return sendNotification({
    userId: receiverId,
    type: 'missed_call',
    title: `Missed ${callType === 'video' ? 'Video' : 'Audio'} Call`,
    description: `You missed a ${callType} call from ${callerName}`,
    referenceId: callerId
  });
};

/**
 * Send a status interaction notification
 */
const sendStatusNotification = async ({ statusOwnerId, actorName, interactionType = 'reaction', emoji = '❤️', statusId }) => {
  const desc = interactionType === 'reaction'
    ? `${actorName} reacted ${emoji} to your status update`
    : `${actorName} replied to your status update`;

  return sendNotification({
    userId: statusOwnerId,
    type: 'status',
    title: 'Status Update',
    description: desc,
    referenceId: statusId
  });
};

module.exports = {
  sendNotification,
  sendMissedCallNotification,
  sendStatusNotification
};

