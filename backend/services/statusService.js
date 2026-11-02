const { pool } = require('../config/database');
const path = require('path');
const fs = require('fs');

/**
 * Get all contact IDs for a given user.
 * Contacts are defined by:
 * 1. Accepted chat requests (bidirectional).
 * 2. Shared direct 1-to-1 conversations.
 * Excludes any blocked users (bidirectional).
 * 
 * @param {number} userId 
 * @param {import('mysql2/promise').PoolConnection|null} connection 
 * @returns {Promise<number[]>}
 */
const getUserContactIds = async (userId, connection = null) => {
  const conn = connection || pool;

  // 1. Accepted chat requests
  const [requestRows] = await conn.query(
    `SELECT CASE WHEN sender_id = ? THEN receiver_id ELSE sender_id END AS contact_id
     FROM chat_requests
     WHERE (sender_id = ? OR receiver_id = ?) AND status = 'accepted'`,
    [userId, userId, userId]
  );

  // 2. Direct conversation members
  const [convRows] = await conn.query(
    `SELECT DISTINCT cm2.user_id AS contact_id
     FROM conversation_members cm1
     JOIN conversation_members cm2 ON cm1.conversation_id = cm2.conversation_id
     JOIN conversations c ON cm1.conversation_id = c.id
     WHERE cm1.user_id = ? AND cm2.user_id != ? AND c.conversation_type = 'direct'`,
    [userId, userId]
  );

  // Combine and deduplicate
  const contactIdsSet = new Set([
    ...requestRows.map((r) => r.contact_id),
    ...convRows.map((r) => r.contact_id)
  ]);

  // 3. Remove blocked users
  const [blockedRows] = await conn.query(
    `SELECT CASE WHEN blocker_id = ? THEN blocked_user_id ELSE blocker_id END AS blocked_id
     FROM blocked_users
     WHERE blocker_id = ? OR blocked_user_id = ?`,
    [userId, userId, userId]
  );

  for (const b of blockedRows) {
    contactIdsSet.delete(b.blocked_id);
  }

  return Array.from(contactIdsSet).map((id) => parseInt(id, 10));
};

/**
 * Determine if viewerId is authorized to view statusOwnerId's statuses.
 * 
 * @param {number} viewerId 
 * @param {number} statusOwnerId 
 * @param {import('mysql2/promise').PoolConnection|null} connection 
 * @returns {Promise<boolean>}
 */
const canUserViewStatus = async (viewerId, statusOwnerId, connection = null) => {
  if (viewerId === statusOwnerId) return true;

  const conn = connection || pool;

  // Check blocking relationship
  const [blocked] = await conn.query(
    `SELECT id FROM blocked_users 
     WHERE (blocker_id = ? AND blocked_user_id = ?) OR (blocker_id = ? AND blocked_user_id = ?)
     LIMIT 1`,
    [viewerId, statusOwnerId, statusOwnerId, viewerId]
  );

  if (blocked.length > 0) return false;

  // Get status owner's privacy configuration
  const [privacyRows] = await conn.query(
    'SELECT privacy_type FROM status_privacy WHERE user_id = ? LIMIT 1',
    [statusOwnerId]
  );

  const privacyType = privacyRows[0]?.privacy_type || 'contacts';

  if (privacyType === 'only_share_with') {
    const [allowed] = await conn.query(
      'SELECT id FROM status_privacy_allowed_users WHERE user_id = ? AND allowed_user_id = ? LIMIT 1',
      [statusOwnerId, viewerId]
    );
    return allowed.length > 0;
  }

  // Both 'contacts' and 'contacts_except' require the viewer to be a contact
  const contactIds = await getUserContactIds(statusOwnerId, conn);
  if (!contactIds.includes(viewerId)) {
    return false;
  }

  if (privacyType === 'contacts_except') {
    const [excluded] = await conn.query(
      'SELECT id FROM status_privacy_exclusions WHERE user_id = ? AND excluded_user_id = ? LIMIT 1',
      [statusOwnerId, viewerId]
    );
    return excluded.length === 0;
  }

  return true;
};

/**
 * Get all user IDs who are currently eligible to view statusOwnerId's statuses.
 * Used for targeted Socket.IO event broadcasting.
 * 
 * @param {number} statusOwnerId 
 * @param {import('mysql2/promise').PoolConnection|null} connection 
 * @returns {Promise<number[]>}
 */
const getEligibleViewerIds = async (statusOwnerId, connection = null) => {
  const conn = connection || pool;

  const [privacyRows] = await conn.query(
    'SELECT privacy_type FROM status_privacy WHERE user_id = ? LIMIT 1',
    [statusOwnerId]
  );

  const privacyType = privacyRows[0]?.privacy_type || 'contacts';

  if (privacyType === 'only_share_with') {
    const [allowed] = await conn.query(
      'SELECT allowed_user_id FROM status_privacy_allowed_users WHERE user_id = ?',
      [statusOwnerId]
    );
    return allowed.map((r) => r.allowed_user_id);
  }

  const contactIds = await getUserContactIds(statusOwnerId, conn);

  if (privacyType === 'contacts_except') {
    const [excluded] = await conn.query(
      'SELECT excluded_user_id FROM status_privacy_exclusions WHERE user_id = ?',
      [statusOwnerId]
    );
    const excludedSet = new Set(excluded.map((r) => r.excluded_user_id));
    return contactIds.filter((id) => !excludedSet.has(id));
  }

  return contactIds;
};

/**
 * Cleanup expired statuses and remove unneeded media from disk.
 * Soft deletes expired rows and unlinks files.
 */
const cleanupExpiredStatuses = async () => {
  try {
    const [expired] = await pool.query(
      `SELECT id, media_url FROM statuses 
       WHERE expires_at <= NOW() AND deleted_at IS NULL`
    );

    if (expired.length === 0) return 0;

    const ids = expired.map((s) => s.id);
    await pool.query(
      'UPDATE statuses SET deleted_at = NOW() WHERE id IN (?)',
      [ids]
    );

    // Unlink media if present
    for (const item of expired) {
      if (item.media_url && item.media_url.startsWith('/uploads/statuses/')) {
        const filename = path.basename(item.media_url);
        const fullPath = path.join(__dirname, '../uploads/statuses', filename);
        try {
          if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
          }
        } catch (_) {}
      }
    }

    console.log(`[StatusService] Cleaned up ${expired.length} expired statuses.`);
    return expired.length;
  } catch (err) {
    console.error('[StatusService] Error in cleanupExpiredStatuses:', err.message);
    return 0;
  }
};

module.exports = {
  getUserContactIds,
  canUserViewStatus,
  getEligibleViewerIds,
  cleanupExpiredStatuses
};

