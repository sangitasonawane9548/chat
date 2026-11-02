/**
 * =============================================================================
 * DAY 7: REAL-TIME ONE-TO-ONE VIDEO CALLING TEST SUITE
 * =============================================================================
 */

const path = require('path');
const { pool } = require('../config/database');
const { io: ioClient } = require(path.resolve(__dirname, '../node_modules/socket.io-client'));

const API_BASE = 'http://localhost:5000/api';
let passed = 0;
let failed = 0;

function assert(condition, message, details = '') {
  if (condition) {
    console.log(`✅ [PASS] ${message}`);
    passed++;
  } else {
    console.error(`❌ [FAIL] ${message}`);
    if (details) console.error(`   Details: ${details}`);
    failed++;
  }
}

function waitForConnect(socket) {
  return new Promise((resolve) => {
    if (socket.connected) return resolve();
    socket.once('connect', resolve);
    setTimeout(resolve, 3000);
  });
}

function emitWithAck(socket, event, data) {
  return new Promise((resolve) => {
    socket.emit(event, data, (response) => {
      resolve(response);
    });
  });
}

class UserClient {
  constructor(username, email, fullName) {
    this.username = username;
    this.email = email;
    this.fullName = fullName;
    this.token = null;
    this.cookie = null;
    this.user = null;
    this.socket = null;
  }

  async init() {
    try {
      await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: this.fullName,
          username: this.username,
          email: this.email,
          password: 'Password123!',
          confirmPassword: 'Password123!',
          agreeTerms: true
        })
      });
      await fetch(`${API_BASE}/auth/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: this.email,
          otp: '123456'
        })
      });
    } catch (_) {}

    const loginRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        usernameOrEmail: this.username,
        password: 'Password123!'
      })
    });

    const setCookie = loginRes.headers.get('set-cookie');
    if (setCookie) {
      this.cookie = setCookie;
      const match = setCookie.match(/token=([^;]+)/);
      if (match) this.token = match[1];
    }

    const data = await loginRes.json();
    this.user = data.user;

    this.socket = ioClient('http://localhost:5000', {
      auth: { token: this.token },
      transports: ['websocket']
    });

    await waitForConnect(this.socket);
  }

  async fetch(url, options = {}) {
    const headers = options.headers || {};
    if (this.cookie) {
      headers['Cookie'] = this.cookie;
    }
    return fetch(url, { ...options, headers });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
    }
  }
}

async function runTests() {
  console.log('\n================================================================');
  console.log('🧪 RUNNING DAY 7: REAL-TIME ONE-TO-ONE VIDEO CALLING TESTS');
  console.log('================================================================\n');

  const alice = new UserClient('alice_day7', 'alice_day7@test.com', 'Alice Video');
  const bob = new UserClient('bob_day7', 'bob_day7@test.com', 'Bob Video');
  const charlie = new UserClient('charlie_day7', 'charlie_day7@test.com', 'Charlie Video');

  try {
    await alice.init();
    await bob.init();
    await charlie.init();

    // 1. Direct conversation between Alice and Bob
    let conversationId = null;
    const [existingConv] = await pool.query(
      `SELECT c.id FROM conversations c 
       JOIN conversation_members cm1 ON c.id = cm1.conversation_id AND cm1.user_id = ?
       JOIN conversation_members cm2 ON c.id = cm2.conversation_id AND cm2.user_id = ?
       WHERE c.conversation_type = 'direct' LIMIT 1`,
      [alice.user.id, bob.user.id]
    );

    if (existingConv.length > 0) {
      conversationId = existingConv[0].id;
    } else {
      const [cr] = await pool.query('INSERT INTO conversations (conversation_type) VALUES ("direct")');
      conversationId = cr.insertId;
      await pool.query('INSERT INTO conversation_members (conversation_id, user_id) VALUES (?, ?), (?, ?)', [
        conversationId, alice.user.id, conversationId, bob.user.id
      ]);
    }

    // 2. Direct conversation between Charlie and Bob for busy testing
    let charlieBobConvId = null;
    const [existingCb] = await pool.query(
      `SELECT c.id FROM conversations c 
       JOIN conversation_members cm1 ON c.id = cm1.conversation_id AND cm1.user_id = ?
       JOIN conversation_members cm2 ON c.id = cm2.conversation_id AND cm2.user_id = ?
       WHERE c.conversation_type = 'direct' LIMIT 1`,
      [charlie.user.id, bob.user.id]
    );

    if (existingCb.length > 0) {
      charlieBobConvId = existingCb[0].id;
    } else {
      const [cbCr] = await pool.query('INSERT INTO conversations (conversation_type) VALUES ("direct")');
      charlieBobConvId = cbCr.insertId;
      await pool.query('INSERT INTO conversation_members (conversation_id, user_id) VALUES (?, ?), (?, ?)', [
        charlieBobConvId, charlie.user.id, charlieBobConvId, bob.user.id
      ]);
    }

    let activeCallId = null;

    // -------------------------------------------------------------------------
    // TEST 1: Alice initiates video call via POST /api/calls
    // -------------------------------------------------------------------------
    let incomingVideoPromise = new Promise((resolve) => {
      bob.socket.once('call:incoming', resolve);
    });

    const initRes = await alice.fetch(`${API_BASE}/calls`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId,
        receiverId: bob.user.id,
        callType: 'video'
      })
    });
    const initData = await initRes.json();
    assert(
      initRes.status === 201 && initData.success && (initData.call?.callType === 'video' || initData.call?.call_type === 'video'),
      'TEST 1: Alice initiates video call via POST /api/calls (callType: video)',
      JSON.stringify(initData)
    );
    activeCallId = initData.call?.id;

    // -------------------------------------------------------------------------
    // TEST 2: Bob receives real-time call:incoming with callType: 'video'
    // -------------------------------------------------------------------------
    const incomingCall = await incomingVideoPromise;
    assert(
      incomingCall?.id === activeCallId && (incomingCall?.callType === 'video' || incomingCall?.call_type === 'video') && incomingCall?.caller?.username === alice.username,
      'TEST 2: Bob receives real-time Socket.IO call:incoming event with callType: "video" and caller profile'
    );

    // -------------------------------------------------------------------------
    // TEST 3: Attempting to call busy user returns 400 with busy: true
    // -------------------------------------------------------------------------
    const busyRes = await charlie.fetch(`${API_BASE}/calls`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId: charlieBobConvId,
        receiverId: bob.user.id,
        callType: 'video'
      })
    });
    const busyData = await busyRes.json();
    assert(
      busyRes.status === 400 && busyData.busy === true,
      'TEST 3: Attempting to call busy user returns 400 with busy: true'
    );

    // -------------------------------------------------------------------------
    // TEST 4: Recipient acknowledges ringing
    // -------------------------------------------------------------------------
    let ringingPromise = new Promise((resolve) => {
      alice.socket.once('call:ringing', resolve);
    });
    bob.socket.emit('call:ringing', { callId: activeCallId });
    const ringingData = await ringingPromise;
    assert(
      ringingData?.callId === activeCallId,
      'TEST 4: Caller (Alice) receives real-time call:ringing acknowledgement'
    );

    // -------------------------------------------------------------------------
    // TEST 5: Active call lookup via GET /api/calls/active
    // -------------------------------------------------------------------------
    const activeRes = await alice.fetch(`${API_BASE}/calls/active`);
    const activeData = await activeRes.json();
    assert(
      activeRes.status === 200 && activeData.activeCall?.callId === activeCallId && (activeData.activeCall?.callType === 'video' || activeData.activeCall?.call_type === 'video'),
      'TEST 5: GET /api/calls/active identifies active video call in progress'
    );

    // -------------------------------------------------------------------------
    // TEST 6: Bob accepts video call
    // -------------------------------------------------------------------------
    let acceptedPromise = new Promise((resolve) => {
      alice.socket.once('call:accepted', resolve);
    });
    const acceptAck = await emitWithAck(bob.socket, 'call:accept', { callId: activeCallId });
    const acceptedData = await acceptedPromise;
    assert(
      acceptAck?.success === true && acceptedData?.callId === activeCallId,
      'TEST 6: Bob accepts video call and Alice receives call:accepted with timestamp'
    );

    // -------------------------------------------------------------------------
    // TEST 7: Video SDP Offer Exchange
    // -------------------------------------------------------------------------
    let offerPromise = new Promise((resolve) => {
      bob.socket.once('call:offer', resolve);
    });
    const mockVideoOfferSdp = 'v=0\r\no=alice 12345 2 IN IP4 127.0.0.1\r\nm=audio 54321 UDP/TLS/RTP/SAVPF 111\r\nm=video 54322 UDP/TLS/RTP/SAVPF 96\r\n';
    alice.socket.emit('call:offer', { callId: activeCallId, sdp: mockVideoOfferSdp });
    const offerReceived = await offerPromise;
    assert(
      offerReceived?.callId === activeCallId && offerReceived?.sdp?.includes('m=video'),
      'TEST 7: Alice sends SDP offer containing video and Bob receives call:offer payload'
    );

    // -------------------------------------------------------------------------
    // TEST 8: Video SDP Answer Exchange
    // -------------------------------------------------------------------------
    let answerPromise = new Promise((resolve) => {
      alice.socket.once('call:answer', resolve);
    });
    const mockVideoAnswerSdp = 'v=0\r\no=bob 54321 2 IN IP4 127.0.0.1\r\nm=audio 54321 UDP/TLS/RTP/SAVPF 111\r\nm=video 54322 UDP/TLS/RTP/SAVPF 96\r\n';
    bob.socket.emit('call:answer', { callId: activeCallId, sdp: mockVideoAnswerSdp });
    const answerReceived = await answerPromise;
    assert(
      answerReceived?.callId === activeCallId && answerReceived?.sdp?.includes('m=video'),
      'TEST 8: Bob sends SDP answer containing video and Alice receives call:answer payload'
    );

    // -------------------------------------------------------------------------
    // TEST 9: ICE Candidate Exchange
    // -------------------------------------------------------------------------
    let icePromise = new Promise((resolve) => {
      bob.socket.once('call:ice-candidate', resolve);
    });
    const mockCandidate = { candidate: 'candidate:1 1 UDP 2130706431 192.168.1.100 54321 typ host', sdpMid: 'video', sdpMLineIndex: 1 };
    alice.socket.emit('call:ice-candidate', { callId: activeCallId, candidate: mockCandidate });
    const candidateReceived = await icePromise;
    assert(
      candidateReceived?.callId === activeCallId && candidateReceived?.candidate?.sdpMid === 'video',
      'TEST 9: Video ICE candidate successfully relayed between participants'
    );

    // -------------------------------------------------------------------------
    // TEST 10: Camera Status Sync (On / Off)
    // -------------------------------------------------------------------------
    let cameraStatusPromise = new Promise((resolve) => {
      bob.socket.once('call:camera_status', resolve);
    });
    alice.socket.emit('call:camera_status', { callId: activeCallId, isCameraOff: true, videoEnabled: false });
    const cameraStatusReceived = await cameraStatusPromise;
    assert(
      cameraStatusReceived?.callId === activeCallId && cameraStatusReceived?.isCameraOff === true,
      'TEST 10: Camera on/off status synchronized in real-time across peers (call:camera_status)'
    );

    // -------------------------------------------------------------------------
    // TEST 11: Screen Share Status Sync
    // -------------------------------------------------------------------------
    let screenSharePromise = new Promise((resolve) => {
      bob.socket.once('call:screen_share_status', resolve);
    });
    alice.socket.emit('call:screen_share_status', { callId: activeCallId, isScreenSharing: true });
    const screenShareReceived = await screenSharePromise;
    assert(
      screenShareReceived?.callId === activeCallId && screenShareReceived?.isScreenSharing === true,
      'TEST 11: Screen share status synchronized in real-time across peers (call:screen_share_status)'
    );

    // -------------------------------------------------------------------------
    // TEST 12: Microphone Mute Status Sync
    // -------------------------------------------------------------------------
    let mutePromise = new Promise((resolve) => {
      bob.socket.once('call:participant_muted', resolve);
    });
    alice.socket.emit('call:mute', { callId: activeCallId, isMuted: true });
    const muteReceived = await mutePromise;
    assert(
      muteReceived?.callId === activeCallId && muteReceived?.isMuted === true,
      'TEST 12: Microphone mute state synchronized independently in real-time'
    );

    // Wait 1.2 seconds for duration
    await new Promise((r) => setTimeout(r, 1200));

    // -------------------------------------------------------------------------
    // TEST 13: Bob ends video call
    // -------------------------------------------------------------------------
    let endedPromise = new Promise((resolve) => {
      alice.socket.once('call:ended', resolve);
    });
    const endAck = await emitWithAck(bob.socket, 'call:end', { callId: activeCallId });
    const endedReceived = await endedPromise;
    assert(
      endAck?.success === true && endedReceived?.callId === activeCallId && endedReceived?.durationSeconds >= 1,
      'TEST 13: Bob ends video call; duration calculated and Alice receives call:ended event'
    );

    // -------------------------------------------------------------------------
    // TEST 14: MySQL calls table persistence
    // -------------------------------------------------------------------------
    const [dbCall] = await pool.query(
      'SELECT id, call_type, status, duration_seconds, end_reason FROM calls WHERE id = ?',
      [activeCallId]
    );
    assert(
      dbCall.length > 0 && dbCall[0].call_type === 'video' && dbCall[0].status === 'ended' && dbCall[0].duration_seconds >= 1,
      'TEST 14: MySQL calls table accurately persisted with call_type: "video", duration and status'
    );

    // -------------------------------------------------------------------------
    // TEST 15: Caller cancels outgoing video call
    // -------------------------------------------------------------------------
    let cancelIncomingPromise = new Promise((resolve) => {
      bob.socket.once('call:incoming', resolve);
    });
    const cancelCallRes = await alice.fetch(`${API_BASE}/calls`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId, receiverId: bob.user.id, callType: 'video' })
    });
    const cancelCallData = await cancelCallRes.json();
    const cancelCallId = cancelCallData.call?.id;
    await cancelIncomingPromise;

    let cancelPromise = new Promise((resolve) => {
      bob.socket.once('call:cancelled', resolve);
    });
    await emitWithAck(alice.socket, 'call:cancel', { callId: cancelCallId });
    const cancelReceived = await cancelPromise;
    assert(
      cancelReceived?.callId === cancelCallId,
      'TEST 15: Caller cancels outgoing video call before acceptance; recipient receives call:cancelled'
    );

    // -------------------------------------------------------------------------
    // TEST 16: Receiver rejects incoming video call
    // -------------------------------------------------------------------------
    let rejectIncomingPromise = new Promise((resolve) => {
      bob.socket.once('call:incoming', resolve);
    });
    const rejectCallRes = await alice.fetch(`${API_BASE}/calls`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId, receiverId: bob.user.id, callType: 'video' })
    });
    const rejectCallData = await rejectCallRes.json();
    const rejectCallId = rejectCallData.call?.id;
    await rejectIncomingPromise;

    let rejectPromise = new Promise((resolve) => {
      alice.socket.once('call:rejected', resolve);
    });
    await emitWithAck(bob.socket, 'call:reject', { callId: rejectCallId });
    const rejectReceived = await rejectPromise;
    assert(
      rejectReceived?.callId === rejectCallId,
      'TEST 16: Receiver rejects incoming video call; caller receives call:rejected event'
    );

    // -------------------------------------------------------------------------
    // TEST 17: Call history filter (?filter=video)
    // -------------------------------------------------------------------------
    const videoHistoryRes = await alice.fetch(`${API_BASE}/calls?filter=video`);
    const videoHistoryData = await videoHistoryRes.json();
    const allAreVideo = (videoHistoryData.calls || []).every((c) => c.call_type === 'video');
    assert(
      videoHistoryRes.status === 200 && videoHistoryData.calls?.length > 0 && allAreVideo,
      'TEST 17: Call history filter (?filter=video) returns only video calls'
    );

    // -------------------------------------------------------------------------
    // TEST 18: Call history filter (?filter=audio)
    // -------------------------------------------------------------------------
    const audioHistoryRes = await alice.fetch(`${API_BASE}/calls?filter=audio`);
    const audioHistoryData = await audioHistoryRes.json();
    const allAreAudio = (audioHistoryData.calls || []).every((c) => c.call_type === 'audio');
    assert(
      audioHistoryRes.status === 200 && allAreAudio,
      'TEST 18: Call history filter (?filter=audio) returns only audio calls'
    );

    // -------------------------------------------------------------------------
    // TEST 19: Privacy isolation: Charlie cannot end or access Alice's call
    // -------------------------------------------------------------------------
    const privacyRes = await charlie.fetch(`${API_BASE}/calls/${activeCallId}`);
    assert(
      privacyRes.status === 404 || privacyRes.status === 403,
      'TEST 19: Non-participant (Charlie) is forbidden from accessing or ending another video call (404/403)'
    );

  } catch (err) {
    console.error('Unexpected error in video calling test:', err);
    failed++;
  } finally {
    alice.disconnect();
    bob.disconnect();
    charlie.disconnect();
    await pool.end();
  }

  console.log('\n================================================================');
  console.log(`🎉 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED (TOTAL ${passed + failed} TESTS)`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
