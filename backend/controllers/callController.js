const { pool } = require('../config/database');
const { getIO, emitToUser, isUserOnline } = require('../config/socket');
const callManager = require('../services/callManager');

/**
 * 1. Initiate Audio Call
 * POST /api/calls
 */
const initiateCall = async (req, res, next) => {
  try {
    const callerId = req.user.id;
    const { conversationId, receiverId, callType = 'audio' } = req.body;

    if (!conversationId || !receiverId) {
      return res.status(400).json({
        success: false,
        message: 'conversationId and receiverId are required'
      });
    }

    const numConvId = parseInt(conversationId, 10);
    const numReceiverId = parseInt(receiverId, 10);

    if (callerId === numReceiverId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot initiate a call with yourself'
      });
    }

    // 1. Verify caller and receiver are members of the conversation
    const [members] = await pool.query(
      'SELECT user_id FROM conversation_members WHERE conversation_id = ?',
      [numConvId]
    );

    const memberIds = members.map((m) => m.user_id);
    if (!memberIds.includes(callerId)) {
      return res.status(403).json({
        success: false,
        message: 'You are not a member of this conversation'
      });
    }

    if (!memberIds.includes(numReceiverId)) {
      return res.status(400).json({
        success: false,
        message: 'Recipient is not a participant in this conversation'
      });
    }

    // 2. Check if caller is already busy in an active call
    if (callManager.isUserBusy(callerId)) {
      return res.status(400).json({
        success: false,
        message: 'You are already in an active call'
      });
    }

    // 3. Check if receiver is already busy in an active call
    if (callManager.isUserBusy(numReceiverId)) {
      return res.status(400).json({
        success: false,
        busy: true,
        message: 'User is busy on another call'
      });
    }

    // 4. Check recipient online availability
    const recipientOnline = isUserOnline(numReceiverId);

    // 5. Insert call record into database
    const [callResult] = await pool.query(
      `INSERT INTO calls 
       (conversation_id, caller_id, call_type, status, call_status, started_at) 
       VALUES (?, ?, ?, 'initiated', 'initiated', NOW())`,
      [numConvId, callerId, callType]
    );

    const callId = callResult.insertId;

    // 6. Insert participants
    await pool.query(
      `INSERT INTO call_participants 
       (call_id, user_id, participant_role, participant_status, joined_at) 
       VALUES (?, ?, 'caller', 'calling', NOW()), 
              (?, ?, 'receiver', 'ringing', NULL)`,
      [callId, callerId, callId, numReceiverId]
    );

    // Fetch full caller and receiver details for payloads
    const [callerProfile] = await pool.query(
      `SELECT u.id, u.username, u.full_name, p.profile_picture 
       FROM users u JOIN user_profiles p ON u.id = p.user_id WHERE u.id = ?`,
      [callerId]
    );

    const [receiverProfile] = await pool.query(
      `SELECT u.id, u.username, u.full_name, p.profile_picture 
       FROM users u JOIN user_profiles p ON u.id = p.user_id WHERE u.id = ?`,
      [numReceiverId]
    );

    const callerData = callerProfile[0] || { id: callerId, username: req.user.username };
    const receiverData = receiverProfile[0] || { id: numReceiverId };

    // 7. Register call in Server-Side CallManager with 35s timeout
    callManager.registerCall({
      callId,
      conversationId: numConvId,
      callerId,
      receiverId: numReceiverId,
      callType,
      onTimeout: (timeoutCall) => {
        // Broadcast missed call event to receiver and no_answer to caller
        emitToUser(numReceiverId, 'call:missed', {
          callId,
          caller: callerData,
          callType
        });
        emitToUser(callerId, 'call:ended', {
          callId,
          endReason: 'timeout',
          message: 'No answer'
        });
      }
    });

    // 8. If recipient is offline, still trigger call but return offline indicator
    const callPayload = {
      id: callId,
      conversationId: numConvId,
      callerId,
      receiverId: numReceiverId,
      callType,
      status: 'initiated',
      caller: callerData,
      receiver: receiverData,
      isRecipientOnline: recipientOnline,
      startedAt: new Date()
    };

    // 9. Send real-time incoming call signal to recipient's personal room
    emitToUser(numReceiverId, 'call:incoming', callPayload);

    return res.status(201).json({
      success: true,
      call: callPayload
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 2. Get Call History with Filtering and Pagination
 * GET /api/calls
 */
const getCallHistory = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const filter = (req.query.filter || 'all').toLowerCase();
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;

    let filterCondition = '';
    const queryParams = [userId, userId];

    if (filter === 'missed') {
      filterCondition = " AND c.status = 'missed'";
    } else if (filter === 'incoming') {
      filterCondition = ' AND cp.user_id = ?';
      queryParams.push(userId);
    } else if (filter === 'outgoing') {
      filterCondition = ' AND c.caller_id = ?';
      queryParams.push(userId);
    } else if (filter === 'audio') {
      filterCondition = " AND c.call_type = 'audio'";
    } else if (filter === 'video') {
      filterCondition = " AND c.call_type = 'video'";
    }

    // Total count for pagination
    const [countRows] = await pool.query(
      `SELECT COUNT(DISTINCT c.id) as total
       FROM calls c
       JOIN call_participants cp ON c.id = cp.call_id
       WHERE (c.caller_id = ? OR cp.user_id = ?) ${filterCondition}`,
      queryParams
    );

    const totalCount = countRows[0]?.total || 0;
    const totalPages = Math.ceil(totalCount / limit);

    // Fetch paginated calls
    const [rows] = await pool.query(
      `SELECT c.id, c.conversation_id, c.caller_id, c.call_type, c.status, c.call_status,
              c.started_at, c.answered_at, c.ended_at, c.duration_seconds, c.duration,
              c.end_reason, c.created_at,
              u.id as caller_user_id, u.username as caller_username, u.full_name as caller_full_name,
              p.profile_picture as caller_profile_picture,
              rec.id as receiver_user_id, rec.username as receiver_username, rec.full_name as receiver_full_name,
              rec_p.profile_picture as receiver_profile_picture
       FROM calls c
       JOIN users u ON c.caller_id = u.id
       JOIN user_profiles p ON u.id = p.user_id
       LEFT JOIN call_participants cp ON c.id = cp.call_id AND cp.participant_role = 'receiver'
       LEFT JOIN users rec ON cp.user_id = rec.id
       LEFT JOIN user_profiles rec_p ON rec.id = rec_p.user_id
       WHERE (c.caller_id = ? OR cp.user_id = ?) ${filterCondition}
       ORDER BY c.created_at DESC
       LIMIT ? OFFSET ?`,
      [...queryParams, limit, offset]
    );

    const calls = rows.map((row) => {
      const isCaller = row.caller_id === userId;
      const otherUser = isCaller
        ? {
            id: row.receiver_user_id,
            username: row.receiver_username,
            full_name: row.receiver_full_name,
            profile_picture: row.receiver_profile_picture
          }
        : {
            id: row.caller_user_id,
            username: row.caller_username,
            full_name: row.caller_full_name,
            profile_picture: row.caller_profile_picture
          };

      return {
        id: row.id,
        conversation_id: row.conversation_id,
        caller_id: row.caller_id,
        call_type: row.call_type,
        status: row.status || row.call_status,
        direction: isCaller ? 'outgoing' : 'incoming',
        started_at: row.started_at,
        answered_at: row.answered_at,
        ended_at: row.ended_at,
        duration_seconds: row.duration_seconds || row.duration || 0,
        end_reason: row.end_reason,
        created_at: row.created_at,
        otherUser
      };
    });

    return res.status(200).json({
      success: true,
      calls,
      page,
      limit,
      totalPages,
      totalCount
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 3. Get Call by ID
 * GET /api/calls/:callId
 */
const getCallById = async (req, res, next) => {
  try {
    const callId = parseInt(req.params.callId, 10);
    const userId = req.user.id;

    const [rows] = await pool.query(
      `SELECT c.id, c.conversation_id, c.caller_id, c.call_type, c.status, c.call_status,
              c.started_at, c.answered_at, c.ended_at, c.duration_seconds, c.end_reason, c.created_at
       FROM calls c
       JOIN call_participants cp ON c.id = cp.call_id
       WHERE c.id = ? AND (c.caller_id = ? OR cp.user_id = ?)
       LIMIT 1`,
      [callId, userId, userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Call not found or you are not authorized to view it'
      });
    }

    return res.status(200).json({
      success: true,
      call: rows[0]
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 4. Cancel Outgoing Call (Caller cancels before answer)
 * POST /api/calls/:callId/cancel
 */
const cancelCall = async (req, res, next) => {
  try {
    const callId = parseInt(req.params.callId, 10);
    const userId = req.user.id;

    // Check caller identity
    const [callRows] = await pool.query(
      `SELECT c.id, c.caller_id, c.status, cp.user_id as receiver_id
       FROM calls c
       JOIN call_participants cp ON c.id = cp.call_id AND cp.participant_role = 'receiver'
       WHERE c.id = ?`,
      [callId]
    );

    if (callRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Call not found' });
    }

    const call = callRows[0];
    if (call.caller_id !== userId) {
      return res.status(403).json({ success: false, message: 'Only the caller can cancel this call' });
    }

    // Update database
    await pool.query(
      `UPDATE calls 
       SET status = 'cancelled', call_status = 'ended', ended_at = NOW(), end_reason = 'caller_cancelled'
       WHERE id = ?`,
      [callId]
    );

    await pool.query(
      `UPDATE call_participants 
       SET participant_status = 'left', left_at = NOW() 
       WHERE call_id = ?`,
      [callId]
    );

    // End call in manager
    callManager.endCall(callId, 'caller_cancelled');

    // Notify recipient
    emitToUser(call.receiver_id, 'call:cancelled', {
      callId,
      cancelledBy: userId
    });

    return res.status(200).json({
      success: true,
      message: 'Call cancelled successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 5. Reject Incoming Call (Receiver declines)
 * POST /api/calls/:callId/reject
 */
const rejectCall = async (req, res, next) => {
  try {
    const callId = parseInt(req.params.callId, 10);
    const userId = req.user.id;

    const [callRows] = await pool.query(
      `SELECT c.id, c.caller_id, c.status, cp.user_id as receiver_id
       FROM calls c
       JOIN call_participants cp ON c.id = cp.call_id AND cp.participant_role = 'receiver'
       WHERE c.id = ?`,
      [callId]
    );

    if (callRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Call not found' });
    }

    const call = callRows[0];
    if (call.receiver_id !== userId) {
      return res.status(403).json({ success: false, message: 'Only the intended recipient can reject this call' });
    }

    // Update database
    await pool.query(
      `UPDATE calls 
       SET status = 'rejected', call_status = 'rejected', ended_at = NOW(), end_reason = 'receiver_rejected'
       WHERE id = ?`,
      [callId]
    );

    await pool.query(
      `UPDATE call_participants 
       SET participant_status = 'rejected', left_at = NOW() 
       WHERE call_id = ? AND user_id = ?`,
      [callId, userId]
    );

    // End call in manager
    callManager.endCall(callId, 'receiver_rejected');

    // Notify caller
    emitToUser(call.caller_id, 'call:rejected', {
      callId,
      rejectedBy: userId
    });

    return res.status(200).json({
      success: true,
      message: 'Call rejected'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 6. End Connected Call
 * POST /api/calls/:callId/end
 */
const endCall = async (req, res, next) => {
  try {
    const callId = parseInt(req.params.callId, 10);
    const userId = req.user.id;

    const [callRows] = await pool.query(
      `SELECT c.id, c.caller_id, c.status, c.answered_at, cp.user_id as receiver_id
       FROM calls c
       JOIN call_participants cp ON c.id = cp.call_id AND cp.participant_role = 'receiver'
       WHERE c.id = ? AND (c.caller_id = ? OR cp.user_id = ?)`,
      [callId, userId, userId]
    );

    if (callRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Call not found or unauthorized' });
    }

    const call = callRows[0];
    const peerId = call.caller_id === userId ? call.receiver_id : call.caller_id;

    // End call in manager
    const endedCall = callManager.endCall(callId, 'user_hung_up');
    const durationSeconds = endedCall?.durationSeconds || 0;

    // Update database
    await pool.query(
      `UPDATE calls 
       SET status = 'ended', call_status = 'ended', ended_at = NOW(), duration_seconds = ?, duration = ?, end_reason = 'user_hung_up'
       WHERE id = ?`,
      [durationSeconds, durationSeconds, callId]
    );

    await pool.query(
      `UPDATE call_participants 
       SET participant_status = 'left', left_at = NOW() 
       WHERE call_id = ? AND user_id = ?`,
      [callId, userId]
    );

    // Notify peer
    emitToUser(peerId, 'call:ended', {
      callId,
      endedBy: userId,
      durationSeconds,
      endReason: 'user_hung_up'
    });

    return res.status(200).json({
      success: true,
      duration: durationSeconds,
      message: 'Call ended'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 7. Get Active Call for Authenticated User
 * GET /api/calls/active
 */
const getActiveCall = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const activeCall = callManager.getCallForUser(userId);

    if (!activeCall) {
      return res.status(200).json({ success: true, activeCall: null });
    }

    return res.status(200).json({
      success: true,
      activeCall: {
        callId: activeCall.callId,
        conversationId: activeCall.conversationId,
        callerId: activeCall.callerId,
        receiverId: activeCall.receiverId,
        callType: activeCall.callType,
        status: activeCall.status,
        startedAt: activeCall.startedAt,
        answeredAt: activeCall.answeredAt
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 8. Get ICE / TURN Server Configuration
 * GET /api/calls/ice-servers
 * Supplies verified STUN and TURN server credentials from environment
 */
const getIceServersConfig = async (req, res, next) => {
  try {
    const servers = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' }
    ];

    if (process.env.STUN_URLS) {
      const customStun = process.env.STUN_URLS.split(',')
        .map(u => u.trim())
        .filter(Boolean)
        .map(urls => ({ urls }));
      servers.push(...customStun);
    }

    if (process.env.TURN_URL) {
      servers.push({
        urls: process.env.TURN_URL,
        username: process.env.TURN_USERNAME || '',
        credential: process.env.TURN_CREDENTIAL || ''
      });
    }

    return res.status(200).json({
      success: true,
      iceServers: servers
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  initiateCall,
  getCallHistory,
  getCallById,
  cancelCall,
  rejectCall,
  endCall,
  getActiveCall,
  getIceServersConfig
};

