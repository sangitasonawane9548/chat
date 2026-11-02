const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { pool } = require('./database');
const callManager = require('../services/callManager');

let io = null;

/**
 * Parse cookies from header string
 */
const parseCookies = (cookieString = '') => {
  const list = {};
  if (!cookieString) return list;

  cookieString.split(';').forEach((cookie) => {
    const parts = cookie.split('=');
    const key = parts.shift().trim();
    const value = decodeURIComponent(parts.join('='));
    if (key) list[key] = value;
  });

  return list;
};

/**
 * Check if a user currently has active socket connections
 * @param {number|string} userId 
 * @returns {boolean}
 */
const isUserOnline = (userId) => {
  if (!io) return false;
  const room = io.sockets.adapter.rooms.get(`user_${userId}`);
  return Boolean(room && room.size > 0);
};

/**
 * Resolve allowed origins from environment configuration
 */
const getConfiguredOrigins = () => {
  const envOrigins = (process.env.FRONTEND_URL || '')
    .split(',')
    .map(url => url.trim().replace(/\/$/, ''))
    .filter(Boolean);

  return [
    ...envOrigins,
    'http://localhost:5173',
    'http://localhost:3000',
    'http://127.0.0.1:5173',
    'http://localhost:5174'
  ];
};

const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  if (process.env.NODE_ENV !== 'production') return true;

  const origins = getConfiguredOrigins();
  if (origins.includes(origin)) return true;

  // Match Vercel production and preview deployments (*.vercel.app)
  if (/^https:\/\/([a-zA-Z0-9-]+\.)*vercel\.app$/.test(origin)) return true;

  // Match localhost & loopback IP addresses (http or https)
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return true;

  // Match LAN private network IP addresses
  const lanPattern = /^https?:\/\/(192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})(:\d+)?$/;
  if (lanPattern.test(origin)) return true;

  // Match Cloudflare tunnels
  if (/^https?:\/\/([a-zA-Z0-9-]+\.)*(trycloudflare\.com|cloudflare\.com)(:\d+)?$/.test(origin)) return true;

  // Match common developer tunnels
  if (/^https?:\/\/([a-zA-Z0-9-]+\.)*(loca\.lt|ngrok-free\.app|ngrok\.io|ngrok\.app)(:\d+)?$/.test(origin)) return true;

  return false;
};

/**
 * Initialize Socket.IO instance attached to the HTTP server
 * @param {import('http').Server} server 
 * @returns {import('socket.io').Server}
 */
const initSocket = (server) => {

  io = new Server(server, {
    cors: {
      origin: (origin, callback) => {
        if (isAllowedOrigin(origin)) {
          callback(null, true);
        } else {
          console.warn('[Socket.IO CORS] Blocked origin: ' + origin);
          callback(null, false);
        }
      },
      methods: ['GET', 'POST'],
      credentials: true
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000
  });

  // Socket authentication middleware
  io.use(async (socket, next) => {
    try {
      const cookies = parseCookies(socket.handshake.headers.cookie);
      let token = cookies.token || socket.handshake.auth?.token;

      if (!token && socket.handshake.headers.authorization?.startsWith('Bearer ')) {
        token = socket.handshake.headers.authorization.split(' ')[1];
      }

      if (token) {
        try {
          const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET || 'super_secret_dev_jwt_key_aether_platform_2026'
          );
          socket.userId = decoded.userId;
          socket.username = decoded.username;
        } catch (jwtErr) {
          socket.userId = null;
        }
      } else {
        socket.userId = null;
      }
      next();
    } catch (err) {
      next();
    }
  });

  io.on('connection', async (socket) => {
    if (socket.userId) {
      const userRoom = `user_${socket.userId}`;
      socket.join(userRoom);
      console.log(`[Socket.IO] Authenticated user connected: @${socket.username} (ID: ${socket.userId}, Socket: ${socket.id}) -> Joined ${userRoom}`);

      // Track online status
      try {
        const room = io.sockets.adapter.rooms.get(userRoom);
        if (room && room.size === 1) {
          // First connection for this user
          await pool.query(
            'UPDATE user_profiles SET is_online = 1 WHERE user_id = ?',
            [socket.userId]
          );

          // Broadcast presence update
          io.emit('user_presence_changed', {
            userId: socket.userId,
            isOnline: true
          });
        }

        // Deliver any pending messages waiting for this user
        const [pendingReceipts] = await pool.query(
          `SELECT mr.id, mr.message_id, m.conversation_id, m.sender_id
           FROM message_receipts mr
           JOIN messages m ON mr.message_id = m.id
           WHERE mr.user_id = ? AND mr.delivered_at IS NULL`,
          [socket.userId]
        );

        if (pendingReceipts.length > 0) {
          const receiptIds = pendingReceipts.map(r => r.id);
          await pool.query(
            'UPDATE message_receipts SET delivered_at = NOW() WHERE id IN (?)',
            [receiptIds]
          );

          // Notify senders
          for (const receipt of pendingReceipts) {
            io.to(`user_${receipt.sender_id}`).emit('message_delivered', {
              messageId: receipt.message_id,
              conversationId: receipt.conversation_id,
              deliveredAt: new Date()
            });
            io.to(`conversation_${receipt.conversation_id}`).emit('message_delivered', {
              messageId: receipt.message_id,
              conversationId: receipt.conversation_id,
              deliveredAt: new Date()
            });
          }
        }
      } catch (err) {
        console.error('[Socket.IO] Error handling user connection presence:', err.message);
      }

      // Join a specific conversation room with membership authorization
      socket.on('join_conversation', async (data, callback) => {
        try {
          const conversationId = typeof data === 'object' ? data?.conversationId : data;
          if (!conversationId) {
            return callback?.({ success: false, error: 'conversationId is required' });
          }

          // Verify user is a member of this conversation
          const [membership] = await pool.query(
            'SELECT id FROM conversation_members WHERE conversation_id = ? AND user_id = ?',
            [conversationId, socket.userId]
          );

          if (membership.length === 0) {
            return callback?.({ success: false, error: 'Access denied: not a conversation member' });
          }

          const roomName = `conversation_${conversationId}`;
          socket.join(roomName);

          callback?.({ success: true, conversationId });
        } catch (err) {
          console.error('[Socket.IO] Error in join_conversation:', err.message);
          callback?.({ success: false, error: 'Internal socket error' });
        }
      });

      // Leave a conversation room
      socket.on('leave_conversation', (data) => {
        const conversationId = typeof data === 'object' ? data?.conversationId : data;
        if (conversationId) {
          socket.leave(`conversation_${conversationId}`);
        }
      });

      // Typing start indicator
      socket.on('typing_start', async (data) => {
        try {
          const conversationId = data?.conversationId;
          if (!conversationId) return;

          // Verify membership
          const [membership] = await pool.query(
            'SELECT id FROM conversation_members WHERE conversation_id = ? AND user_id = ?',
            [conversationId, socket.userId]
          );

          if (membership.length > 0) {
            const typingPayload = {
              conversationId,
              userId: socket.userId,
              username: socket.username,
              fullName: data?.fullName || socket.username
            };

            socket.to(`conversation_${conversationId}`).emit('user_typing', typingPayload);

            // Direct emission to other member's personal room
            const [otherMembers] = await pool.query(
              'SELECT user_id FROM conversation_members WHERE conversation_id = ? AND user_id != ?',
              [conversationId, socket.userId]
            );
            for (const om of otherMembers) {
              io.to(`user_${om.user_id}`).emit('user_typing', typingPayload);
            }
          }
        } catch (err) {
          console.error('[Socket.IO] Error in typing_start:', err.message);
        }
      });

      // Typing stop indicator
      socket.on('typing_stop', async (data) => {
        try {
          const conversationId = data?.conversationId;
          if (!conversationId) return;

          socket.to(`conversation_${conversationId}`).emit('user_stopped_typing', {
            conversationId,
            userId: socket.userId
          });

          const [otherMembers] = await pool.query(
            'SELECT user_id FROM conversation_members WHERE conversation_id = ? AND user_id != ?',
            [conversationId, socket.userId]
          );
          for (const om of otherMembers) {
            io.to(`user_${om.user_id}`).emit('user_stopped_typing', {
              conversationId,
              userId: socket.userId
            });
          }
        } catch (err) {
          console.error('[Socket.IO] Error in typing_stop:', err.message);
        }
      });

      // Mark message / conversation read via socket
      socket.on('mark_read', async (data, callback) => {
        try {
          const conversationId = data?.conversationId;
          if (!conversationId) return;

          // Update receipts
          await pool.query(
            `UPDATE message_receipts mr
             JOIN messages m ON mr.message_id = m.id
             SET mr.read_at = NOW(), mr.delivered_at = COALESCE(mr.delivered_at, NOW())
             WHERE m.conversation_id = ? AND mr.user_id = ? AND mr.read_at IS NULL`,
            [conversationId, socket.userId]
          );

          await pool.query(
            `UPDATE conversation_members
             SET last_read_at = NOW(),
                 last_read_message_id = (SELECT COALESCE(MAX(id), 0) FROM messages WHERE conversation_id = ?)
             WHERE conversation_id = ? AND user_id = ?`,
            [conversationId, conversationId, socket.userId]
          );

          const readPayload = {
            conversationId,
            readerId: socket.userId,
            readAt: new Date()
          };

          // Broadcast to conversation room and to members
          io.to(`conversation_${conversationId}`).emit('messages_read', readPayload);

          const [otherMembers] = await pool.query(
            'SELECT user_id FROM conversation_members WHERE conversation_id = ? AND user_id != ?',
            [conversationId, socket.userId]
          );
          for (const om of otherMembers) {
            io.to(`user_${om.user_id}`).emit('messages_read', readPayload);
          }

          callback?.({ success: true });
        } catch (err) {
          console.error('[Socket.IO] Error in mark_read socket event:', err.message);
          callback?.({ success: false, error: err.message });
        }
      });

      // =======================================================================
      // WebRTC Call Signaling Handlers (Day 6)
      // =======================================================================

      // 1. Recipient acknowledges ringing
      socket.on('call:ringing', (data) => {
        try {
          const callId = parseInt(data?.callId, 10);
          if (!callId) return;
          const call = callManager.getCall(callId);
          if (call && call.receiverId === socket.userId) {
            callManager.setRinging(callId);
            io.to(`user_${call.callerId}`).emit('call:ringing', { callId });
          }
        } catch (err) {
          console.error('[Socket.IO] Error in call:ringing:', err.message);
        }
      });

      // 2. Accept call
      socket.on('call:accept', async (data, callback) => {
        try {
          const callId = parseInt(data?.callId, 10);
          if (!callId) return callback?.({ success: false, error: 'callId is required' });

          const call = callManager.getCall(callId);
          if (!call) {
            return callback?.({ success: false, error: 'Call not found or already ended' });
          }

          if (call.receiverId !== socket.userId) {
            return callback?.({ success: false, error: 'Unauthorized to accept this call' });
          }

          const acceptedCall = callManager.acceptCall(callId, socket.userId);

          await pool.query(
            `UPDATE calls 
             SET status = 'connected', call_status = 'accepted', answered_at = NOW() 
             WHERE id = ?`,
            [callId]
          );

          await pool.query(
            `UPDATE call_participants 
             SET participant_status = 'joined', joined_at = NOW() 
             WHERE call_id = ? AND user_id = ?`,
            [callId, socket.userId]
          );

          io.to(`user_${call.callerId}`).emit('call:accepted', {
            callId,
            answeredAt: acceptedCall.answeredAt
          });

          callback?.({ success: true, callId });
        } catch (err) {
          console.error('[Socket.IO] Error in call:accept:', err.message);
          callback?.({ success: false, error: err.message });
        }
      });

      // 3. Reject call
      socket.on('call:reject', async (data, callback) => {
        try {
          const callId = parseInt(data?.callId, 10);
          if (!callId) return;

          const call = callManager.getCall(callId);
          if (call && call.receiverId === socket.userId) {
            callManager.endCall(callId, 'receiver_rejected');

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
              [callId, socket.userId]
            );

            io.to(`user_${call.callerId}`).emit('call:rejected', {
              callId,
              rejectedBy: socket.userId
            });

            callback?.({ success: true });
          }
        } catch (err) {
          console.error('[Socket.IO] Error in call:reject:', err.message);
        }
      });

      // 4. Cancel call
      socket.on('call:cancel', async (data, callback) => {
        try {
          const callId = parseInt(data?.callId, 10);
          if (!callId) return;

          const call = callManager.getCall(callId);
          if (call && call.callerId === socket.userId) {
            callManager.endCall(callId, 'caller_cancelled');

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

            io.to(`user_${call.receiverId}`).emit('call:cancelled', {
              callId,
              cancelledBy: socket.userId
            });

            callback?.({ success: true });
          }
        } catch (err) {
          console.error('[Socket.IO] Error in call:cancel:', err.message);
        }
      });

      // 5. SDP Offer
      socket.on('call:offer', (data) => {
        try {
          const callId = parseInt(data?.callId, 10);
          const sdp = data?.sdp;
          if (!callId || !sdp) return;

          const call = callManager.getCall(callId);
          if (call && call.callerId === socket.userId) {
            call.sdpOffer = sdp;
            io.to(`user_${call.receiverId}`).emit('call:offer', {
              callId,
              sdp
            });
          }
        } catch (err) {
          console.error('[Socket.IO] Error in call:offer:', err.message);
        }
      });

      // 6. SDP Answer
      socket.on('call:answer', (data) => {
        try {
          const callId = parseInt(data?.callId, 10);
          const sdp = data?.sdp;
          if (!callId || !sdp) return;

          const call = callManager.getCall(callId);
          if (call && call.receiverId === socket.userId) {
            call.sdpAnswer = sdp;
            io.to(`user_${call.callerId}`).emit('call:answer', {
              callId,
              sdp
            });
          }
        } catch (err) {
          console.error('[Socket.IO] Error in call:answer:', err.message);
        }
      });

      // 7. ICE Candidate Exchange
      socket.on('call:ice-candidate', (data) => {
        try {
          const callId = parseInt(data?.callId, 10);
          const candidate = data?.candidate;
          if (!callId || !candidate) return;

          const call = callManager.getCall(callId);
          if (call) {
            const peerId = call.callerId === socket.userId ? call.receiverId : call.callerId;
            io.to(`user_${peerId}`).emit('call:ice-candidate', {
              callId,
              candidate
            });
          }
        } catch (err) {
          console.error('[Socket.IO] Error in call:ice-candidate:', err.message);
        }
      });

      // 8. End Call
      socket.on('call:end', async (data, callback) => {
        try {
          const callId = parseInt(data?.callId, 10);
          if (!callId) return;

          const call = callManager.getCall(callId);
          if (call && (call.callerId === socket.userId || call.receiverId === socket.userId)) {
            const peerId = call.callerId === socket.userId ? call.receiverId : call.callerId;
            const endedCall = callManager.endCall(callId, 'user_hung_up');
            const durationSeconds = endedCall?.durationSeconds || 0;

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
              [callId, socket.userId]
            );

            io.to(`user_${peerId}`).emit('call:ended', {
              callId,
              endedBy: socket.userId,
              durationSeconds,
              endReason: 'user_hung_up'
            });

            callback?.({ success: true, durationSeconds });
          }
        } catch (err) {
          console.error('[Socket.IO] Error in call:end:', err.message);
        }
      });

      // 9. Participant Mute status sync
      socket.on('call:mute', (data) => {
        try {
          const callId = parseInt(data?.callId, 10);
          const isMuted = Boolean(data?.isMuted);
          if (!callId) return;

          const call = callManager.getCall(callId);
          if (call) {
            const peerId = call.callerId === socket.userId ? call.receiverId : call.callerId;
            io.to(`user_${peerId}`).emit('call:participant_muted', {
              callId,
              userId: socket.userId,
              isMuted
            });
          }
        } catch (err) {
          console.error('[Socket.IO] Error in call:mute:', err.message);
        }
      });

      // 10. Participant Camera status sync (Day 7 Video Calling)
      const handleCameraStatus = (data) => {
        try {
          const callId = parseInt(data?.callId, 10);
          const isCameraOff = Boolean(data?.isCameraOff ?? !data?.videoEnabled);
          const videoEnabled = !isCameraOff;
          if (!callId) return;

          const call = callManager.getCall(callId);
          if (call) {
            const peerId = call.callerId === socket.userId ? call.receiverId : call.callerId;
            const payload = {
              callId,
              userId: socket.userId,
              isCameraOff,
              videoEnabled
            };
            io.to(`user_${peerId}`).emit('call:camera_status', payload);
            io.to(`user_${peerId}`).emit('call:camera-status', payload);
          }
        } catch (err) {
          console.error('[Socket.IO] Error in call:camera_status:', err.message);
        }
      };
      socket.on('call:camera_status', handleCameraStatus);
      socket.on('call:camera-status', handleCameraStatus);

      // 11. Participant Screen Share status sync (Day 7 Video Calling)
      const handleScreenShareStatus = (data) => {
        try {
          const callId = parseInt(data?.callId, 10);
          const isScreenSharing = Boolean(data?.isScreenSharing);
          if (!callId) return;

          const call = callManager.getCall(callId);
          if (call) {
            const peerId = call.callerId === socket.userId ? call.receiverId : call.callerId;
            const payload = {
              callId,
              userId: socket.userId,
              isScreenSharing
            };
            io.to(`user_${peerId}`).emit('call:screen_share_status', payload);
            io.to(`user_${peerId}`).emit('call:screen-share-status', payload);
          }
        } catch (err) {
          console.error('[Socket.IO] Error in call:screen_share_status:', err.message);
        }
      };
      socket.on('call:screen_share_status', handleScreenShareStatus);
      socket.on('call:screen-share-status', handleScreenShareStatus);

      // =======================================================================
      // Group WebRTC Calling Handlers (Day 8)
      // =======================================================================

      // 1. Start Group Call
      socket.on('group_call:start', async (data, callback) => {
        try {
          const conversationId = parseInt(data?.conversationId, 10);
          const callType = data?.callType === 'video' ? 'video' : 'audio';

          if (!conversationId) {
            return callback?.({ success: false, error: 'conversationId is required' });
          }

          // Verify group and membership
          const [groupRows] = await pool.query(
            `SELECT g.id, g.conversation_id, g.name, g.profile_image 
             FROM \`groups\` g
             JOIN group_members gm ON g.id = gm.group_id
             WHERE g.conversation_id = ? AND gm.user_id = ? AND gm.status = 'active'
             LIMIT 1`,
            [conversationId, socket.userId]
          );

          if (groupRows.length === 0) {
            return callback?.({ success: false, error: 'Not authorized or group not found' });
          }

          const group = groupRows[0];

          // Create group call record
          const [callResult] = await pool.query(
            `INSERT INTO group_calls (conversation_id, group_id, initiated_by, call_type, status, started_at)
             VALUES (?, ?, ?, ?, 'active', NOW())`,
            [conversationId, group.id, socket.userId, callType]
          );
          const callId = callResult.insertId;

          // Add initiator as joined participant
          await pool.query(
            `INSERT INTO group_call_participants (call_id, user_id, status, joined_at)
             VALUES (?, ?, 'joined', NOW())`,
            [callId, socket.userId]
          );

          // Add other active group members as 'calling'
          const [members] = await pool.query(
            `SELECT gm.user_id 
             FROM group_members gm 
             WHERE gm.group_id = ? AND gm.user_id != ? AND gm.status = 'active'`,
            [group.id, socket.userId]
          );

          for (const m of members) {
            await pool.query(
              `INSERT INTO group_call_participants (call_id, user_id, status)
               VALUES (?, ?, 'calling')`,
              [callId, m.user_id]
            );
          }

          // Caller joins call room
          socket.join(`group_call_${callId}`);

          // Fetch initiator profile
          const [userRow] = await pool.query(
            `SELECT u.id, u.username, u.full_name, p.profile_picture 
             FROM users u 
             JOIN user_profiles p ON u.id = p.user_id 
             WHERE u.id = ?`,
            [socket.userId]
          );
          const initiator = userRow[0] || { id: socket.userId, username: socket.username };

          const callPayload = {
            callId,
            conversationId,
            groupId: group.id,
            groupName: group.name,
            groupImage: group.profile_image,
            callType,
            initiator,
            startedAt: new Date()
          };

          // Notify all other members
          for (const m of members) {
            io.to(`user_${m.user_id}`).emit('group_call:incoming', callPayload);
          }

          callback?.({ success: true, callId, groupCall: callPayload });
        } catch (err) {
          console.error('[Socket.IO] Error in group_call:start:', err.message);
          callback?.({ success: false, error: err.message });
        }
      });

      // 2. Join Group Call
      socket.on('group_call:join', async (data, callback) => {
        try {
          const callId = parseInt(data?.callId, 10);
          if (!callId) return callback?.({ success: false, error: 'callId is required' });

          const [callRows] = await pool.query(
            `SELECT gc.*, g.name as group_name, g.profile_image as group_image
             FROM group_calls gc
             JOIN \`groups\` g ON gc.group_id = g.id
             WHERE gc.id = ? AND gc.status = 'active'
             LIMIT 1`,
            [callId]
          );

          if (callRows.length === 0) {
            return callback?.({ success: false, error: 'Call has already ended or does not exist' });
          }

          const call = callRows[0];

          // Check membership
          const [membership] = await pool.query(
            `SELECT id FROM group_members WHERE group_id = ? AND user_id = ? AND status = 'active'`,
            [call.group_id, socket.userId]
          );

          if (membership.length === 0) {
            return callback?.({ success: false, error: 'You are not a member of this group' });
          }

          // Upsert participant
          await pool.query(
            `INSERT INTO group_call_participants (call_id, user_id, status, joined_at)
             VALUES (?, ?, 'joined', NOW())
             ON DUPLICATE KEY UPDATE status = 'joined', joined_at = NOW(), left_at = NULL`,
            [callId, socket.userId]
          );

          socket.join(`group_call_${callId}`);

          // Fetch current joined participants
          const [currentParticipants] = await pool.query(
            `SELECT gcp.user_id, u.username, u.full_name, p.profile_picture
             FROM group_call_participants gcp
             JOIN users u ON gcp.user_id = u.id
             JOIN user_profiles p ON u.id = p.user_id
             WHERE gcp.call_id = ? AND gcp.status = 'joined'`,
            [callId]
          );

          const [myInfo] = await pool.query(
            `SELECT u.id, u.username, u.full_name, p.profile_picture 
             FROM users u 
             JOIN user_profiles p ON u.id = p.user_id 
             WHERE u.id = ?`,
            [socket.userId]
          );

          // Broadcast to call room that this user joined
          socket.to(`group_call_${callId}`).emit('group_call:user_joined', {
            callId,
            user: myInfo[0] || { id: socket.userId, username: socket.username }
          });

          callback?.({
            success: true,
            callId,
            callType: call.call_type,
            groupName: call.group_name,
            participants: currentParticipants
          });
        } catch (err) {
          console.error('[Socket.IO] Error in group_call:join:', err.message);
          callback?.({ success: false, error: err.message });
        }
      });

      // 3. Relay P2P Signal in Group Call Mesh
      socket.on('group_call:signal', (data) => {
        try {
          const callId = parseInt(data?.callId, 10);
          const toUserId = parseInt(data?.toUserId, 10);
          const signal = data?.signal;

          if (!callId || !toUserId || !signal) return;

          io.to(`user_${toUserId}`).emit('group_call:signal', {
            callId,
            fromUserId: socket.userId,
            signal
          });
        } catch (err) {
          console.error('[Socket.IO] Error in group_call:signal:', err.message);
        }
      });

      // 4. Leave Group Call
      socket.on('group_call:leave', async (data, callback) => {
        try {
          const callId = parseInt(data?.callId, 10);
          if (!callId) return;

          await pool.query(
            `UPDATE group_call_participants SET status = 'left', left_at = NOW() WHERE call_id = ? AND user_id = ?`,
            [callId, socket.userId]
          );

          socket.leave(`group_call_${callId}`);

          io.to(`group_call_${callId}`).emit('group_call:user_left', {
            callId,
            userId: socket.userId
          });

          // Check if any participants remain
          const [remaining] = await pool.query(
            `SELECT COUNT(*) as count FROM group_call_participants WHERE call_id = ? AND status = 'joined'`,
            [callId]
          );

          if (remaining[0]?.count === 0) {
            await pool.query(
              `UPDATE group_calls SET status = 'ended', ended_at = NOW() WHERE id = ?`,
              [callId]
            );
            io.to(`group_call_${callId}`).emit('group_call:ended', { callId });
          }

          callback?.({ success: true });
        } catch (err) {
          console.error('[Socket.IO] Error in group_call:leave:', err.message);
        }
      });

      // 5. End Group Call
      socket.on('group_call:end', async (data, callback) => {
        try {
          const callId = parseInt(data?.callId, 10);
          if (!callId) return;

          await pool.query(
            `UPDATE group_calls SET status = 'ended', ended_at = NOW() WHERE id = ?`,
            [callId]
          );

          await pool.query(
            `UPDATE group_call_participants SET status = 'left', left_at = NOW() WHERE call_id = ? AND status = 'joined'`,
            [callId]
          );

          io.to(`group_call_${callId}`).emit('group_call:ended', { callId });
          callback?.({ success: true });
        } catch (err) {
          console.error('[Socket.IO] Error in group_call:end:', err.message);
        }
      });
    } else {
      console.log(`[Socket.IO] Guest client connected: ${socket.id}`);
    }

    socket.on('disconnect', async (reason) => {
      console.log(`[Socket.IO] Client disconnected: ${socket.id} (Reason: ${reason})`);
      if (socket.userId) {
        // Clean up any active calls on disconnect
        try {
          await callManager.handleUserDisconnect(socket.userId, (peerId, payload) => {
            io.to(`user_${peerId}`).emit('call:ended', payload);
          });
        } catch (callErr) {
          console.error('[Socket.IO] Error handling user call disconnect:', callErr.message);
        }

        try {
          const room = io.sockets.adapter.rooms.get(`user_${socket.userId}`);
          if (!room || room.size === 0) {
            await pool.query(
              'UPDATE user_profiles SET is_online = 0, last_seen = NOW() WHERE user_id = ?',
              [socket.userId]
            );

            // Broadcast presence update
            io.emit('user_presence_changed', {
              userId: socket.userId,
              isOnline: false,
              lastSeen: new Date()
            });
          }
        } catch (err) {
          console.error('[Socket.IO] Error updating offline presence:', err.message);
        }
      }
    });
  });

  return io;
};

/**
 * Get active Socket.IO instance
 * @returns {import('socket.io').Server}
 */
const getIO = () => {
  if (!io) {
    throw new Error('Socket.IO has not been initialized yet!');
  }
  return io;
};

/**
 * Emit a real-time event to a specific verified user's private room
 * @param {number|string} userId 
 * @param {string} event 
 * @param {any} data 
 */
const emitToUser = (userId, event, data) => {
  if (io) {
    io.to(`user_${userId}`).emit(event, data);
  }
};

/**
 * Emit a real-time event to a specific conversation room
 * @param {number|string} conversationId 
 * @param {string} event 
 * @param {any} data 
 */
const emitToConversation = (conversationId, event, data) => {
  if (io) {
    io.to(`conversation_${conversationId}`).emit(event, data);
  }
};

module.exports = {
  initSocket,
  getIO,
  emitToUser,
  emitToConversation,
  isUserOnline
};
