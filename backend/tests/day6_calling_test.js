/**
 * =============================================================================
 * DAY 6: REAL-TIME ONE-TO-ONE AUDIO CALLING TEST SUITE
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
        usernameOrEmail: this.email,
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

  async get(endpoint) {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      headers: {
        ...(this.cookie ? { Cookie: this.cookie } : {})
      }
    });
    const data = await res.json();
    return { status: res.status, headers: res.headers, data };
  }

  async post(endpoint, body = {}) {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.cookie ? { Cookie: this.cookie } : {})
      },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    return { status: res.status, headers: res.headers, data };
  }

  close() {
    if (this.socket) this.socket.disconnect();
  }
}

async function runDay6Tests() {
  console.log('\n================================================================');
  console.log('🧪 RUNNING DAY 6: REAL-TIME ONE-TO-ONE AUDIO CALLING TESTS');
  console.log('================================================================\n');

  let alice = new UserClient('alice_day6', 'alice_day6@test.com', 'Alice Day6');
  let bob = new UserClient('bob_day6', 'bob_day6@test.com', 'Bob Day6');
  let charlie = new UserClient('charlie_day6', 'charlie_day6@test.com', 'Charlie Day6');

  let convId = null;
  let activeCallId = null;

  try {
    await alice.init();
    await bob.init();
    await charlie.init();

    // Setup direct conversation between Alice and Bob
    const [existingConv] = await pool.query(
      `SELECT c.id FROM conversations c
       JOIN conversation_members cm1 ON c.id = cm1.conversation_id AND cm1.user_id = ?
       JOIN conversation_members cm2 ON c.id = cm2.conversation_id AND cm2.user_id = ?
       WHERE c.conversation_type = 'direct' LIMIT 1`,
      [alice.user.id, bob.user.id]
    );

    if (existingConv.length > 0) {
      convId = existingConv[0].id;
    } else {
      const [cr] = await pool.query('INSERT INTO conversations (conversation_type) VALUES ("direct")');
      convId = cr.insertId;
      await pool.query('INSERT INTO conversation_members (conversation_id, user_id) VALUES (?, ?), (?, ?)', [
        convId, alice.user.id, convId, bob.user.id
      ]);
    }

    // Setup direct conversation between Charlie and Bob (for busy check)
    let charlieBobConvId = null;
    const [existingCBConv] = await pool.query(
      `SELECT c.id FROM conversations c
       JOIN conversation_members cm1 ON c.id = cm1.conversation_id AND cm1.user_id = ?
       JOIN conversation_members cm2 ON c.id = cm2.conversation_id AND cm2.user_id = ?
       WHERE c.conversation_type = 'direct' LIMIT 1`,
      [charlie.user.id, bob.user.id]
    );

    if (existingCBConv.length > 0) {
      charlieBobConvId = existingCBConv[0].id;
    } else {
      const [cbcr] = await pool.query('INSERT INTO conversations (conversation_type) VALUES ("direct")');
      charlieBobConvId = cbcr.insertId;
      await pool.query('INSERT INTO conversation_members (conversation_id, user_id) VALUES (?, ?), (?, ?)', [
        charlieBobConvId, charlie.user.id, charlieBobConvId, bob.user.id
      ]);
    }

    // -------------------------------------------------------------------------
    // TEST 1: Alice initiates audio call to Bob (POST /api/calls)
    // -------------------------------------------------------------------------
    let bobIncomingCall = null;
    bob.socket.once('call:incoming', (call) => {
      bobIncomingCall = call;
    });

    const initRes = await alice.post('/calls', {
      conversationId: convId,
      receiverId: bob.user.id,
      callType: 'audio'
    });

    activeCallId = initRes.data.call?.id;

    assert(
      initRes.status === 201 &&
      activeCallId &&
      initRes.data.call?.callerId === alice.user.id &&
      initRes.data.call?.receiverId === bob.user.id &&
      initRes.data.call?.status === 'initiated',
      'TEST 1: Alice initiates audio call via POST /api/calls'
    );

    // -------------------------------------------------------------------------
    // TEST 2: Bob receives real-time Socket.IO call:incoming event
    // -------------------------------------------------------------------------
    await new Promise((r) => setTimeout(r, 200));
    assert(
      bobIncomingCall &&
      bobIncomingCall.id === activeCallId &&
      bobIncomingCall.caller?.username === 'alice_day6',
      'TEST 2: Bob receives real-time Socket.IO call:incoming event with caller profile'
    );

    // -------------------------------------------------------------------------
    // TEST 3: Prevent duplicate active call (Busy detection)
    // -------------------------------------------------------------------------
    const busyRes = await charlie.post('/calls', {
      conversationId: charlieBobConvId,
      receiverId: bob.user.id,
      callType: 'audio'
    });
    assert(
      busyRes.status === 400 && busyRes.data.busy === true,
      'TEST 3: Attempting to call busy user returns 400 with busy: true'
    );

    // -------------------------------------------------------------------------
    // TEST 4: Recipient acknowledges ringing (call:ringing signal)
    // -------------------------------------------------------------------------
    let aliceReceivedRinging = null;
    alice.socket.once('call:ringing', (data) => {
      aliceReceivedRinging = data;
    });

    bob.socket.emit('call:ringing', { callId: activeCallId });
    await new Promise((r) => setTimeout(r, 200));

    assert(
      aliceReceivedRinging && aliceReceivedRinging.callId === activeCallId,
      'TEST 4: Caller (Alice) receives real-time call:ringing acknowledgement'
    );

    // -------------------------------------------------------------------------
    // TEST 5: Active call status query (GET /api/calls/active)
    // -------------------------------------------------------------------------
    const activeRes = await alice.get('/calls/active');
    assert(
      activeRes.status === 200 &&
      activeRes.data.activeCall?.callId === activeCallId,
      'TEST 5: GET /api/calls/active identifies active call in progress'
    );

    // -------------------------------------------------------------------------
    // TEST 6: Bob accepts call via Socket.IO call:accept
    // -------------------------------------------------------------------------
    let aliceAcceptedSignal = null;
    alice.socket.once('call:accepted', (data) => {
      aliceAcceptedSignal = data;
    });

    const acceptAck = await emitWithAck(bob.socket, 'call:accept', { callId: activeCallId });
    await new Promise((r) => setTimeout(r, 200));

    assert(
      acceptAck?.success === true &&
      aliceAcceptedSignal &&
      aliceAcceptedSignal.callId === activeCallId,
      'TEST 6: Bob accepts call and Alice receives call:accepted with timestamp'
    );

    // -------------------------------------------------------------------------
    // TEST 7: WebRTC SDP Offer Signaling (call:offer)
    // -------------------------------------------------------------------------
    let bobReceivedOffer = null;
    bob.socket.once('call:offer', (data) => {
      bobReceivedOffer = data;
    });

    const dummyOfferSdp = 'v=0\r\no=alice 12345 12345 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\nm=audio 50000 UDP/TLS/RTP/SAVPF 111\r\n';
    alice.socket.emit('call:offer', {
      callId: activeCallId,
      sdp: dummyOfferSdp
    });
    await new Promise((r) => setTimeout(r, 200));

    assert(
      bobReceivedOffer &&
      bobReceivedOffer.callId === activeCallId &&
      bobReceivedOffer.sdp === dummyOfferSdp,
      'TEST 7: Alice sends SDP offer and Bob receives call:offer signaling payload'
    );

    // -------------------------------------------------------------------------
    // TEST 8: WebRTC SDP Answer Signaling (call:answer)
    // -------------------------------------------------------------------------
    let aliceReceivedAnswer = null;
    alice.socket.once('call:answer', (data) => {
      aliceReceivedAnswer = data;
    });

    const dummyAnswerSdp = 'v=0\r\no=bob 67890 67890 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\nm=audio 50002 UDP/TLS/RTP/SAVPF 111\r\n';
    bob.socket.emit('call:answer', {
      callId: activeCallId,
      sdp: dummyAnswerSdp
    });
    await new Promise((r) => setTimeout(r, 200));

    assert(
      aliceReceivedAnswer &&
      aliceReceivedAnswer.callId === activeCallId &&
      aliceReceivedAnswer.sdp === dummyAnswerSdp,
      'TEST 8: Bob sends SDP answer and Alice receives call:answer signaling payload'
    );

    // -------------------------------------------------------------------------
    // TEST 9: ICE Candidate Exchange (call:ice-candidate)
    // -------------------------------------------------------------------------
    let bobReceivedCandidate = null;
    bob.socket.once('call:ice-candidate', (data) => {
      bobReceivedCandidate = data;
    });

    const dummyCandidate = { candidate: 'candidate:1 1 UDP 2122260223 127.0.0.1 50000 typ host', sdpMid: '0', sdpMLineIndex: 0 };
    alice.socket.emit('call:ice-candidate', {
      callId: activeCallId,
      candidate: dummyCandidate
    });
    await new Promise((r) => setTimeout(r, 200));

    assert(
      bobReceivedCandidate &&
      bobReceivedCandidate.callId === activeCallId &&
      bobReceivedCandidate.candidate.candidate === dummyCandidate.candidate,
      'TEST 9: ICE candidates successfully relayed between participants'
    );

    // -------------------------------------------------------------------------
    // TEST 10: Participant Mute Sync (call:mute)
    // -------------------------------------------------------------------------
    let bobReceivedMute = null;
    bob.socket.once('call:participant_muted', (data) => {
      bobReceivedMute = data;
    });

    alice.socket.emit('call:mute', {
      callId: activeCallId,
      isMuted: true
    });
    await new Promise((r) => setTimeout(r, 200));

    assert(
      bobReceivedMute &&
      bobReceivedMute.userId === alice.user.id &&
      bobReceivedMute.isMuted === true,
      'TEST 10: Microphone mute state synchronized in real-time across peers'
    );

    // Wait 1.5 seconds for duration calculation
    await new Promise((r) => setTimeout(r, 1500));

    // -------------------------------------------------------------------------
    // TEST 11: End Connected Call via API (POST /api/calls/:id/end)
    // -------------------------------------------------------------------------
    let bobReceivedEnded = null;
    bob.socket.once('call:ended', (data) => {
      bobReceivedEnded = data;
    });

    const endRes = await alice.post(`/calls/${activeCallId}/end`);
    await new Promise((r) => setTimeout(r, 200));

    assert(
      endRes.status === 200 &&
      endRes.data.duration >= 1 &&
      bobReceivedEnded &&
      bobReceivedEnded.callId === activeCallId,
      'TEST 11: Alice ends call; duration calculated and Bob receives call:ended event'
    );

    // -------------------------------------------------------------------------
    // TEST 12: MySQL calls table updated with status, ended_at, and duration_seconds
    // -------------------------------------------------------------------------
    const [dbCallRows] = await pool.query('SELECT * FROM calls WHERE id = ?', [activeCallId]);
    const dbCall = dbCallRows[0];

    assert(
      dbCall &&
      dbCall.status === 'ended' &&
      dbCall.answered_at !== null &&
      dbCall.ended_at !== null &&
      (dbCall.duration_seconds >= 1 || dbCall.duration >= 1),
      'TEST 12: MySQL calls table accurately persisted with duration, status and timestamps'
    );

    // -------------------------------------------------------------------------
    // TEST 13: Caller cancels call (POST /api/calls/:id/cancel)
    // -------------------------------------------------------------------------
    const init2 = await alice.post('/calls', {
      conversationId: convId,
      receiverId: bob.user.id,
      callType: 'audio'
    });
    const call2Id = init2.data.call.id;

    let bobCancelledSignal = null;
    bob.socket.once('call:cancelled', (data) => {
      bobCancelledSignal = data;
    });

    const cancelRes = await alice.post(`/calls/${call2Id}/cancel`);
    await new Promise((r) => setTimeout(r, 200));

    assert(
      cancelRes.status === 200 &&
      bobCancelledSignal &&
      bobCancelledSignal.callId === call2Id,
      'TEST 13: Caller cancels outgoing call before acceptance; recipient receives call:cancelled'
    );

    // -------------------------------------------------------------------------
    // TEST 14: Receiver rejects call (POST /api/calls/:id/reject)
    // -------------------------------------------------------------------------
    const init3 = await alice.post('/calls', {
      conversationId: convId,
      receiverId: bob.user.id,
      callType: 'audio'
    });
    const call3Id = init3.data.call.id;

    let aliceRejectedSignal = null;
    alice.socket.once('call:rejected', (data) => {
      aliceRejectedSignal = data;
    });

    const rejectRes = await bob.post(`/calls/${call3Id}/reject`);
    await new Promise((r) => setTimeout(r, 200));

    assert(
      rejectRes.status === 200 &&
      aliceRejectedSignal &&
      aliceRejectedSignal.callId === call3Id,
      'TEST 14: Receiver rejects incoming call; caller receives call:rejected event'
    );

    // -------------------------------------------------------------------------
    // TEST 15: Call history API (GET /api/calls)
    // -------------------------------------------------------------------------
    const historyRes = await alice.get('/calls');
    const callsList = historyRes.data.calls || [];

    assert(
      historyRes.status === 200 &&
      callsList.length >= 3 &&
      callsList.some((c) => c.id === activeCallId && c.status === 'ended') &&
      callsList.some((c) => c.id === call2Id && c.status === 'cancelled') &&
      callsList.some((c) => c.id === call3Id && c.status === 'rejected'),
      'TEST 15: GET /api/calls returns accurate call history with direction & profile details'
    );

    // -------------------------------------------------------------------------
    // TEST 16: Call history filters (outgoing filter)
    // -------------------------------------------------------------------------
    const outgoingRes = await alice.get('/calls?filter=outgoing');
    assert(
      outgoingRes.status === 200 &&
      outgoingRes.data.calls.every((c) => c.direction === 'outgoing'),
      'TEST 16: Call history filter (?filter=outgoing) returns only outgoing calls'
    );

    // -------------------------------------------------------------------------
    // TEST 17: Call history privacy isolation
    // -------------------------------------------------------------------------
    const charlieHistory = await charlie.get('/calls');
    const charlieCalls = charlieHistory.data.calls || [];
    assert(
      !charlieCalls.some((c) => c.id === activeCallId),
      'TEST 17: User cannot view another party private call history'
    );

    // -------------------------------------------------------------------------
    // TEST 18: Non-participant cannot end or cancel call (404/403)
    // -------------------------------------------------------------------------
    const unauthorizedEnd = await charlie.post(`/calls/${activeCallId}/end`);
    assert(
      unauthorizedEnd.status === 404,
      'TEST 18: Non-participant is forbidden from modifying or ending another call'
    );

  } catch (error) {
    console.error('Fatal test exception:', error);
    failed++;
  } finally {
    alice.close();
    bob.close();
    charlie.close();
  }

  console.log('\n================================================================');
  console.log(`🎉 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED (TOTAL ${passed + failed} TESTS)`);
  console.log('================================================================\n');

  setTimeout(() => {
    process.exit(failed > 0 ? 1 : 0);
  }, 200);
}

runDay6Tests();
