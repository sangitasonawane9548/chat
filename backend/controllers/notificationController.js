const { pool } = require('../config/database');

/**
 * Get User Notifications & Unread Count
 * GET /api/notifications
 */
const getNotifications = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const [notifications] = await pool.query(
      `SELECT id, notification_type, title, description, reference_id, is_read, created_at
       FROM notifications
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 40`,
      [userId]
    );

    const [unreadCountResult] = await pool.query(
      'SELECT COUNT(*) AS unread_count FROM notifications WHERE user_id = ? AND is_read = 0',
      [userId]
    );

    return res.status(200).json({
      success: true,
      notifications,
      unreadCount: unreadCountResult[0]?.unread_count || 0
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Mark a Notification as Read
 * PATCH /api/notifications/:id/read
 */
const markAsRead = async (req, res, next) => {
  try {
    const notificationId = parseInt(req.params.id, 10);
    const userId = req.user.id;

    await pool.query(
      'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
      [notificationId, userId]
    );

    return res.status(200).json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Mark All Notifications as Read
 * PATCH /api/notifications/read-all
 */
const markAllAsRead = async (req, res, next) => {
  try {
    const userId = req.user.id;

    await pool.query(
      'UPDATE notifications SET is_read = 1 WHERE user_id = ?',
      [userId]
    );

    return res.status(200).json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getNotifications,
  markAsRead,
  markAllAsRead
};

