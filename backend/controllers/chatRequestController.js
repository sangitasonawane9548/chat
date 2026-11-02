const { pool } = require('../config/database');
const { emitToUser } = require('../config/socket');

/**
 * 1. Send Chat Request
 * POST /api/chat-requests
 */
const sendChatRequest = async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const senderId = req.user.id;
    let { receiver_id, username } = req.body;

    // Resolve receiver_id if username was provided
    if (!receiver_id && username) {
      const cleanUsername = username.trim().replace(/^@/, '');
      const [uRows] = await connection.query(
        'SELECT id FROM users WHERE LOWER(username) = LOWER(?) AND account_status = "active" LIMIT 1',
        [cleanUsername]
      );
      if (uRows.length > 0) {
        receiver_id = uRows[0].id;
      }
    }

    if (!receiver_id) {
      return res.status(400).json({ success: false, message: 'Recipient identifier is required' });
    }

    receiver_id = parseInt(receiver_id, 10);

    // Cannot send request to oneself
    if (senderId === receiver_id) {
      return res.status(400).json({ success: false, message: 'You cannot send a chat request to yourself' });
    }

    // Verify recipient exists and check settings
    const [recipients] = await connection.query(
      `SELECT u.id, u.username, u.full_name, u.account_status, s.allow_chat_requests
       FROM users u
       LEFT JOIN user_settings s ON u.id = s.user_id
       WHERE u.id = ? AND u.email_verified = 1`,
      [receiver_id]
    );

    if (recipients.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found or inactive' });
    }

    const recipient = recipients[0];

    // Check if recipient disallows chat requests
    if (recipient.allow_chat_requests === 'nobody') {
      return res.status(403).json({
        success: false,
        message: 'This user has disabled incoming chat requests in their privacy settings'
      });
    }

    // Check if either user has blocked the other
    const [blocked] = await connection.query(
      `SELECT id FROM blocked_users 
       WHERE (blocker_id = ? AND blocked_user_id = ?) OR (blocker_id = ? AND blocked_user_id = ?)
       LIMIT 1`,
      [senderId, receiver_id, receiver_id, senderId]
    );

    if (blocked.length > 0) {
      return res.status(403).json({
        success: false,
        message: 'Cannot send chat request due to block restrictions'
      });
    }

    // Check if direct conversation already exists
    const [convRows] = await connection.query(
      `SELECT c.id 
       FROM conversations c
       JOIN conversation_members cm1 ON c.id = cm1.conversation_id AND cm1.user_id = ?
       JOIN conversation_members cm2 ON c.id = cm2.conversation_id AND cm2.user_id = ?
       WHERE c.conversation_type = 'direct'
       LIMIT 1`,
      [senderId, receiver_id]
    );

    if (convRows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'You already have an active conversation with this user',
        conversationId: convRows[0].id
      });
    }

    // Check if pending request already exists
    const [existingReqs] = await connection.query(
      `SELECT id, sender_id, receiver_id, status 
       FROM chat_requests 
       WHERE ((sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?))
         AND status = 'pending'
       LIMIT 1`,
      [senderId, receiver_id, receiver_id, senderId]
    );

    if (existingReqs.length > 0) {
      const existing = existingReqs[0];
      if (existing.sender_id === senderId) {
        return res.status(409).json({
          success: false,
          message: 'You already have a pending chat request sent to this user',
          requestId: existing.id
        });
      } else {
        return res.status(409).json({
          success: false,
          message: 'This user has already sent you a chat request. Please accept it in your requests tab.',
          requestId: existing.id
        });
      }
    }

    // Create chat request
    await connection.beginTransaction();

    const [reqResult] = await connection.query(
      'INSERT INTO chat_requests (sender_id, receiver_id, status) VALUES (?, ?, "pending")',
      [senderId, receiver_id]
    );

    const requestId = reqResult.insertId;

    // Create in-app notification for receiver
    await connection.query(
      `INSERT INTO notifications (user_id, notification_type, title, description, reference_id, is_read)
       VALUES (?, 'chat_request', 'New Chat Request', ?, ?, 0)`,
      [
        receiver_id,
        `@${req.user.username} sent you a one-on-one chat request.`,
        requestId
      ]
    );

    await connection.commit();

    // Emit real-time Socket.IO notification to receiver's private room
    emitToUser(receiver_id, 'new_chat_request', {
      requestId,
      sender: {
        id: req.user.id,
        full_name: req.user.full_name,
        username: req.user.username,
        profile_picture: req.user.profile_picture
      },
      createdAt: new Date().toISOString()
    });

    return res.status(201).json({
      success: true,
      message: 'Chat request sent successfully',
      requestId
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
};

/**
 * 2. Get Incoming Pending Chat Requests
 * GET /api/chat-requests/incoming
 */
const getIncomingRequests = async (req, res, next) => {
  try {
    const currentUserId = req.user.id;

    const [requests] = await pool.query(
      `SELECT cr.id, cr.sender_id, cr.created_at, cr.status,
              u.full_name, u.username, p.profile_picture, p.bio, p.is_online
       FROM chat_requests cr
       JOIN users u ON cr.sender_id = u.id
       JOIN user_profiles p ON u.id = p.user_id
       WHERE cr.receiver_id = ? AND cr.status = 'pending'
       ORDER BY cr.created_at DESC`,
      [currentUserId]
    );

    return res.status(200).json({
      success: true,
      requests: requests.map((r) => ({
        id: r.id,
        sender_id: r.sender_id,
        full_name: r.full_name,
        username: r.username,
        profile_picture: r.profile_picture,
        bio: r.bio || '',
        is_online: Boolean(r.is_online),
        created_at: r.created_at,
        status: r.status
      }))
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 3. Get Sent Pending Chat Requests
 * GET /api/chat-requests/sent
 */
const getSentRequests = async (req, res, next) => {
  try {
    const currentUserId = req.user.id;

    const [requests] = await pool.query(
      `SELECT cr.id, cr.receiver_id, cr.created_at, cr.status,
              u.full_name, u.username, p.profile_picture, p.bio, p.is_online
       FROM chat_requests cr
       JOIN users u ON cr.receiver_id = u.id
       JOIN user_profiles p ON u.id = p.user_id
       WHERE cr.sender_id = ? AND cr.status = 'pending'
       ORDER BY cr.created_at DESC`,
      [currentUserId]
    );

    return res.status(200).json({
      success: true,
      requests: requests.map((r) => ({
        id: r.id,
        receiver_id: r.receiver_id,
        full_name: r.full_name,
        username: r.username,
        profile_picture: r.profile_picture,
        bio: r.bio || '',
        is_online: Boolean(r.is_online),
        created_at: r.created_at,
        status: r.status
      }))
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 4. Accept Chat Request
 * POST /api/chat-requests/:id/accept
 */
const acceptChatRequest = async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const requestId = parseInt(req.params.id, 10);
    const receiverId = req.user.id;

    // Check request
    const [requests] = await connection.query(
      'SELECT id, sender_id, receiver_id, status FROM chat_requests WHERE id = ? AND receiver_id = ? AND status = "pending"',
      [requestId, receiverId]
    );

    if (requests.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Pending chat request not found or already processed'
      });
    }

    const request = requests[0];
    const senderId = request.sender_id;

    await connection.beginTransaction();

    // Mark request accepted
    await connection.query(
      'UPDATE chat_requests SET status = "accepted", responded_at = NOW() WHERE id = ?',
      [requestId]
    );

    // Check if direct conversation already exists between the two
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
      // Create new direct conversation
      const [convResult] = await connection.query(
        'INSERT INTO conversations (conversation_type) VALUES ("direct")'
      );
      conversationId = convResult.insertId;

      // Add both members
      await connection.query(
        'INSERT INTO conversation_members (conversation_id, user_id) VALUES (?, ?), (?, ?)',
        [conversationId, senderId, conversationId, receiverId]
      );
    }

    // Insert notification for the sender
    await connection.query(
      `INSERT INTO notifications (user_id, notification_type, title, description, reference_id, is_read)
       VALUES (?, 'chat_request', 'Chat Request Accepted', ?, ?, 0)`,
      [
        senderId,
        `@${req.user.username} accepted your chat request. You can now chat!`,
        conversationId
      ]
    );

    await connection.commit();

    // Emit real-time Socket.IO notification to original sender
    emitToUser(senderId, 'chat_request_accepted', {
      requestId,
      conversationId,
      acceptedBy: {
        id: req.user.id,
        full_name: req.user.full_name,
        username: req.user.username,
        profile_picture: req.user.profile_picture
      }
    });

    return res.status(200).json({
      success: true,
      message: 'Chat request accepted successfully',
      conversationId
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
};

/**
 * 5. Decline Chat Request
 * POST /api/chat-requests/:id/decline
 */
const declineChatRequest = async (req, res, next) => {
  try {
    const requestId = parseInt(req.params.id, 10);
    const receiverId = req.user.id;

    const [requests] = await pool.query(
      'SELECT id, sender_id, receiver_id, status FROM chat_requests WHERE id = ? AND receiver_id = ? AND status = "pending"',
      [requestId, receiverId]
    );

    if (requests.length === 0) {
      return res.status(404).json({ success: false, message: 'Pending request not found' });
    }

    const request = requests[0];

    await pool.query(
      'UPDATE chat_requests SET status = "declined", responded_at = NOW() WHERE id = ?',
      [requestId]
    );

    // Real-time notification to sender
    emitToUser(request.sender_id, 'chat_request_declined', {
      requestId
    });

    return res.status(200).json({
      success: true,
      message: 'Chat request declined'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 6. Cancel Sent Chat Request
 * POST /api/chat-requests/:id/cancel
 */
const cancelChatRequest = async (req, res, next) => {
  try {
    const requestId = parseInt(req.params.id, 10);
    const senderId = req.user.id;

    const [requests] = await pool.query(
      'SELECT id, sender_id, receiver_id, status FROM chat_requests WHERE id = ? AND sender_id = ? AND status = "pending"',
      [requestId, senderId]
    );

    if (requests.length === 0) {
      return res.status(404).json({ success: false, message: 'Pending request not found' });
    }

    const request = requests[0];

    await pool.query(
      'UPDATE chat_requests SET status = "cancelled", responded_at = NOW() WHERE id = ?',
      [requestId]
    );

    // Real-time notification to receiver
    emitToUser(request.receiver_id, 'chat_request_cancelled', {
      requestId
    });

    return res.status(200).json({
      success: true,
      message: 'Chat request cancelled'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 7. Get User's Authorized Conversations
 * GET /api/conversations
 */
const getUserConversations = async (req, res, next) => {
  try {
    const currentUserId = req.user.id;

    // Fetch conversations where current user is a member
    const [conversations] = await pool.query(
      `SELECT c.id, c.conversation_type, c.created_at, c.updated_at
       FROM conversations c
       JOIN conversation_members cm ON c.id = cm.conversation_id
       WHERE cm.user_id = ?
       ORDER BY c.updated_at DESC`,
      [currentUserId]
    );

    // Annotate direct conversations with other member's profile
    const formattedConversations = await Promise.all(
      conversations.map(async (conv) => {
        if (conv.conversation_type === 'direct') {
          const [otherMembers] = await pool.query(
            `SELECT u.id, u.full_name, u.username, p.profile_picture, p.is_online, p.last_seen, s.show_online_status
             FROM conversation_members cm
             JOIN users u ON cm.user_id = u.id
             JOIN user_profiles p ON u.id = p.user_id
             LEFT JOIN user_settings s ON u.id = s.user_id
             WHERE cm.conversation_id = ? AND cm.user_id != ?
             LIMIT 1`,
            [conv.id, currentUserId]
          );

          const otherUser = otherMembers[0] || null;

          return {
            id: conv.id,
            conversation_type: conv.conversation_type,
            updated_at: conv.updated_at,
            participant: otherUser ? {
              id: otherUser.id,
              full_name: otherUser.full_name,
              username: otherUser.username,
              profile_picture: otherUser.profile_picture,
              is_online: otherUser.show_online_status ? Boolean(otherUser.is_online) : false
            } : null
          };
        }

        return conv;
      })
    );

    return res.status(200).json({
      success: true,
      conversations: formattedConversations
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  sendChatRequest,
  getIncomingRequests,
  getSentRequests,
  acceptChatRequest,
  declineChatRequest,
  cancelChatRequest,
  getUserConversations
};

