const { pool } = require('../config/database');

/**
 * Report Controller
 * Handles user-submitted reports for users, groups, messages, and statuses.
 */

exports.createReport = async (req, res, next) => {
  try {
    const reporterId = req.user.id;
    const {
      reported_user_id,
      group_id,
      message_id,
      status_id,
      reason,
      description
    } = req.body;

    // Validate reason
    if (!reason || !reason.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Reason for reporting is required.'
      });
    }

    // Validate target
    if (!reported_user_id && !group_id && !message_id && !status_id) {
      return res.status(400).json({
        success: false,
        message: 'At least one report target (user, group, message, or status) must be specified.'
      });
    }

    // Prevent reporting oneself
    if (reported_user_id && Number(reported_user_id) === Number(reporterId)) {
      return res.status(400).json({
        success: false,
        message: 'You cannot report your own account.'
      });
    }

    // Check if target user exists if provided
    let reportedUsername = 'Target';
    if (reported_user_id) {
      const [uRows] = await pool.query('SELECT username FROM users WHERE id = ?', [reported_user_id]);
      if (uRows.length > 0) {
        reportedUsername = `@${uRows[0].username}`;
      }
    }

    // Insert report
    const [result] = await pool.query(
      `INSERT INTO user_reports 
        (reporter_id, reported_user_id, group_id, message_id, status_id, reason, description, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        reporterId,
        reported_user_id || null,
        group_id || null,
        message_id || null,
        status_id || null,
        reason.trim(),
        description ? description.trim() : null
      ]
    );

    const reportId = result.insertId;

    // Create Admin Notification alert
    try {
      const notifTitle = `New Report #${reportId}: ${reason.trim()}`;
      const notifMessage = `User @${req.user.username} submitted a report against ${reportedUsername}. Reason: ${reason.trim()}`;
      await pool.query(
        `INSERT INTO admin_notifications (title, message, notification_type, reference_id)
         VALUES (?, ?, 'report_submitted', ?)`,
        [notifTitle, notifMessage, String(reportId)]
      );
    } catch (notifErr) {
      console.warn('[ReportController] Failed to dispatch admin notification:', notifErr.message);
    }

    return res.status(201).json({
      success: true,
      message: 'Report submitted successfully. Our safety and moderation team will review it.',
      reportId
    });
  } catch (error) {
    next(error);
  }
};

exports.getMySubmittedReports = async (req, res, next) => {
  try {
    const reporterId = req.user.id;
    const [reports] = await pool.query(
      `SELECT id, reported_user_id, group_id, message_id, status_id, reason, status, created_at
       FROM user_reports
       WHERE reporter_id = ?
       ORDER BY created_at DESC
       LIMIT 50`,
      [reporterId]
    );

    return res.status(200).json({
      success: true,
      reports
    });
  } catch (error) {
    next(error);
  }
};

