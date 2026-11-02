const { pool } = require('../config/database');

/**
 * Server-Side Active Call Manager
 * Controls real-time call states, enforces busy detection, manages ringing timeouts,
 * and handles abrupt disconnects.
 */
class CallManager {
  constructor() {
    // Map: callId (number) -> CallStateObject
    this.activeCalls = new Map();
    // Map: userId (number) -> callId (number)
    this.userCallMap = new Map();
  }

  /**
   * Check if a user is currently engaged in an active call
   * @param {number} userId 
   * @returns {boolean}
   */
  isUserBusy(userId) {
    const activeCallId = this.userCallMap.get(userId);
    if (!activeCallId) return false;
    const call = this.activeCalls.get(activeCallId);
    return Boolean(call && ['initiated', 'ringing', 'connecting', 'connected'].includes(call.status));
  }

  /**
   * Get active call record by ID
   * @param {number} callId 
   */
  getCall(callId) {
    return this.activeCalls.get(parseInt(callId, 10)) || null;
  }

  /**
   * Get active call for a specific user
   * @param {number} userId 
   */
  getCallForUser(userId) {
    const callId = this.userCallMap.get(userId);
    if (!callId) return null;
    return this.activeCalls.get(callId) || null;
  }

  /**
   * Register a newly initiated call
   * @param {object} param0 
   */
  registerCall({
    callId,
    conversationId,
    callerId,
    receiverId,
    callType = 'audio',
    onTimeout
  }) {
    const numericCallId = parseInt(callId, 10);
    const numericCallerId = parseInt(callerId, 10);
    const numericReceiverId = parseInt(receiverId, 10);

    // Set 35-second ringing timeout
    const timeoutTimer = setTimeout(async () => {
      try {
        await this.handleCallTimeout(numericCallId, onTimeout);
      } catch (err) {
        console.error('[CallManager] Timeout handling error:', err.message);
      }
    }, 35000);

    const callRecord = {
      callId: numericCallId,
      conversationId,
      callerId: numericCallerId,
      receiverId: numericReceiverId,
      callType,
      status: 'initiated', // 'initiated' | 'ringing' | 'connected' | 'ended'
      startedAt: new Date(),
      answeredAt: null,
      timeoutTimer,
      onTimeout,
      sdpOffer: null,
      sdpAnswer: null,
      iceCandidatesCaller: [],
      iceCandidatesReceiver: []
    };

    this.activeCalls.set(numericCallId, callRecord);
    this.userCallMap.set(numericCallerId, numericCallId);
    this.userCallMap.set(numericReceiverId, numericCallId);

    return callRecord;
  }

  /**
   * Mark call as ringing
   * @param {number} callId 
   */
  setRinging(callId) {
    const call = this.getCall(callId);
    if (call && call.status === 'initiated') {
      call.status = 'ringing';
    }
  }

  /**
   * Receiver accepts the call -> transition to connected
   * @param {number} callId 
   * @param {number} receiverId 
   */
  acceptCall(callId, receiverId) {
    const call = this.getCall(callId);
    if (!call) return null;

    if (call.receiverId !== parseInt(receiverId, 10)) {
      throw new Error('Unauthorized: only the intended recipient can accept the call');
    }

    // Clear ringing timeout
    if (call.timeoutTimer) {
      clearTimeout(call.timeoutTimer);
      call.timeoutTimer = null;
    }

    call.status = 'connected';
    call.answeredAt = new Date();
    return call;
  }

  /**
   * Terminate call cleanly and calculate duration
   * @param {number} callId 
   * @param {string} endReason 
   */
  endCall(callId, endReason = 'normal_hangup') {
    const numericCallId = parseInt(callId, 10);
    const call = this.activeCalls.get(numericCallId);
    if (!call) return null;

    if (call.timeoutTimer) {
      clearTimeout(call.timeoutTimer);
      call.timeoutTimer = null;
    }

    call.status = 'ended';
    call.endedAt = new Date();

    let durationSeconds = 0;
    if (call.answeredAt) {
      durationSeconds = Math.max(0, Math.round((call.endedAt.getTime() - call.answeredAt.getTime()) / 1000));
    }
    call.durationSeconds = durationSeconds;
    call.endReason = endReason;

    // Unmap users
    this.userCallMap.delete(call.callerId);
    this.userCallMap.delete(call.receiverId);
    this.activeCalls.delete(numericCallId);

    return call;
  }

  /**
   * Ringing timeout expired -> auto-mark as missed
   * @param {number} callId 
   * @param {function} onTimeout 
   */
  async handleCallTimeout(callId, onTimeout) {
    const call = this.activeCalls.get(callId);
    if (!call || call.status === 'connected' || call.status === 'ended') {
      return;
    }

    // Mark as missed in database
    await pool.query(
      `UPDATE calls 
       SET status = 'missed', call_status = 'missed', ended_at = NOW(), end_reason = 'timeout' 
       WHERE id = ?`,
      [callId]
    );

    await pool.query(
      `UPDATE call_participants 
       SET participant_status = 'missed', left_at = NOW() 
       WHERE call_id = ? AND participant_role = 'receiver'`,
      [callId]
    );

    // Send missed call notification
    try {
      const notificationService = require('./notificationService');
      notificationService.sendMissedCallNotification({
        callerId: call.callerId,
        receiverId: call.receiverId,
        callType: call.callType
      }).catch(() => {});
    } catch (_) {}

    // Clean up
    this.userCallMap.delete(call.callerId);
    this.userCallMap.delete(call.receiverId);
    this.activeCalls.delete(callId);

    if (typeof onTimeout === 'function') {
      onTimeout(call);
    }
  }

  /**
   * Handle unexpected user socket disconnect during a call
   * @param {number} userId 
   * @param {function} notifyPeer 
   */
  async handleUserDisconnect(userId, notifyPeer) {
    const numericUserId = parseInt(userId, 10);
    const callId = this.userCallMap.get(numericUserId);
    if (!callId) return;

    const call = this.activeCalls.get(callId);
    if (!call) return;

    const peerId = call.callerId === numericUserId ? call.receiverId : call.callerId;
    const isAnswered = Boolean(call.answeredAt);
    const endReason = 'peer_disconnected';

    const endedCall = this.endCall(callId, endReason);
    if (endedCall) {
      const finalStatus = isAnswered ? 'ended' : 'failed';

      await pool.query(
        `UPDATE calls 
         SET status = ?, call_status = ?, ended_at = NOW(), duration_seconds = ?, duration = ?, end_reason = ? 
         WHERE id = ?`,
        [finalStatus, finalStatus, endedCall.durationSeconds || 0, endedCall.durationSeconds || 0, endReason, callId]
      );

      if (typeof notifyPeer === 'function') {
        notifyPeer(peerId, {
          callId,
          endReason,
          durationSeconds: endedCall.durationSeconds || 0
        });
      }
    }
  }
}

module.exports = new CallManager();

