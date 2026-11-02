/**
 * =============================================================================
 * DAY 8: ADVANCED REAL-TIME GROUP CHAT SYSTEM TEST SUITE
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
  console.log('🧪 RUNNING DAY 8: ADVANCED REAL-TIME GROUP CHAT SYSTEM TESTS');
  console.log('================================================================\n');

  const alice = new UserClient('alice_day8', 'alice_day8@test.com', 'Alice GroupCreator');
  const bob = new UserClient('bob_day8', 'bob_day8@test.com', 'Bob GroupAdmin');
  const charlie = new UserClient('charlie_day8', 'charlie_day8@test.com', 'Charlie GroupMember');
  const david = new UserClient('david_day8', 'david_day8@test.com', 'David GroupNew');

  try {
    await alice.init();
    await bob.init();
    await charlie.init();
    await david.init();

    // -------------------------------------------------------------------------
    // TEST SUITE 1: Group Creation & Validations
    // -------------------------------------------------------------------------
    console.log('\n--- 1. Group Creation & Validation Tests ---');

    // 1.1 Short name validation (< 3 chars)
    const shortNameRes = await alice.fetch(`${API_BASE}/groups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'AB',
        memberIds: [bob.user.id, charlie.user.id]
      })
    });
    assert(
      shortNameRes.status === 400,
      'Group creation fails if name is less than 3 characters',
      `Status: ${shortNameRes.status}`
    );

    // 1.2 Fewer than 2 members validation (rule: min 2 members excluding creator)
    const fewMembersRes = await alice.fetch(`${API_BASE}/groups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Solo Crew',
        memberIds: [bob.user.id]
      })
    });
    assert(
      fewMembersRes.status === 400,
      'Group creation fails if fewer than 2 members are provided excluding creator',
      `Status: ${fewMembersRes.status}`
    );

    // 1.3 Successful Group Creation
    const createRes = await alice.fetch(`${API_BASE}/groups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Design Engineering',
        description: 'Discussing real-time architecture and design systems',
        memberIds: [bob.user.id, charlie.user.id]
      })
    });

    const createData = await createRes.json();
    assert(
      createRes.status === 201 && createData.success === true,
      'Alice successfully creates a group with Bob and Charlie',
      `Status: ${createRes.status}`
    );

    const groupId = createData.group?.id;
    const conversationId = createData.conversationId;

    assert(
      Boolean(groupId && conversationId),
      'Group and conversation identifiers are returned on creation',
      `GroupId: ${groupId}, ConversationId: ${conversationId}`
    );

    // -------------------------------------------------------------------------
    // TEST SUITE 2: Group Metadata & Role Integrity
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Group Details & Roles Verification ---');

    // 2.1 Fetch group details as Alice (Creator)
    const detailsRes = await alice.fetch(`${API_BASE}/groups/${groupId}`);
    const detailsData = await detailsRes.json();

    assert(
      detailsRes.status === 200 && detailsData.group.my_role === 'creator',
      'Creator has role: "creator" in group details',
      `Role: ${detailsData.group?.my_role}`
    );

    assert(
      detailsData.group.members_count === 3,
      'Group contains exactly 3 active members',
      `Count: ${detailsData.group.members_count}`
    );

    // 2.2 Verify initial system message was created
    const msgsRes = await alice.fetch(`${API_BASE}/conversations/${conversationId}/messages`);
    const msgsData = await msgsRes.json();
    const systemMsg = msgsData.messages?.find((m) => m.message_type === 'system');

    assert(
      Boolean(systemMsg && systemMsg.message_content.includes('created the group')),
      'Initial system message is present in the conversation history',
      `System msg: ${systemMsg?.message_content}`
    );

    // 2.3 Verify conversation is visible in Bob's conversations list
    const bobConvsRes = await bob.fetch(`${API_BASE}/conversations`);
    const bobConvsData = await bobConvsRes.json();
    const bobGroupConv = bobConvsData.conversations?.find((c) => c.id === conversationId);

    assert(
      Boolean(bobGroupConv && bobGroupConv.conversation_type === 'group'),
      'Bob sees group conversation with conversation_type = "group" in his inbox',
      `Found: ${Boolean(bobGroupConv)}`
    );

    // -------------------------------------------------------------------------
    // TEST SUITE 3: Real-Time Group Messaging & Delivery Receipts
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Real-Time Group Messaging & Receipts ---');

    // Setup socket listeners for Bob and Charlie
    let bobReceivedMsg = null;
    let charlieReceivedMsg = null;

    bob.socket.on('new_message', (msg) => {
      if (msg.conversation_id === conversationId) bobReceivedMsg = msg;
    });

    charlie.socket.on('new_message', (msg) => {
      if (msg.conversation_id === conversationId) charlieReceivedMsg = msg;
    });

    // Alice sends a message
    const sendRes = await alice.fetch(`${API_BASE}/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: 'Welcome team to our real-time group chat!',
        clientMessageId: `msg_${Date.now()}`
      })
    });
    const sendData = await sendRes.json();

    assert(
      sendRes.status === 201 && sendData.success === true,
      'Alice successfully sends a message in the group',
      `Status: ${sendRes.status}`
    );

    // Allow socket dispatch
    await new Promise((r) => setTimeout(r, 600));

    assert(
      Boolean(bobReceivedMsg && bobReceivedMsg.message_content.includes('Welcome team')),
      'Bob receives group message in real-time via Socket.IO',
      `Content: ${bobReceivedMsg?.message_content}`
    );

    assert(
      Boolean(charlieReceivedMsg && charlieReceivedMsg.message_content.includes('Welcome team')),
      'Charlie receives group message in real-time via Socket.IO',
      `Content: ${charlieReceivedMsg?.message_content}`
    );

    // Verify receipts in database for both recipients
    const [receipts] = await pool.query(
      'SELECT user_id, delivered_at FROM message_receipts WHERE message_id = ?',
      [sendData.message.id]
    );

    const receiptUserIds = receipts.map((r) => r.user_id);
    assert(
      receiptUserIds.includes(bob.user.id) && receiptUserIds.includes(charlie.user.id),
      'Delivery receipts are persistently created for all other active group members in MySQL',
      `Receipt userIds: ${receiptUserIds.join(', ')}`
    );

    // 3.2 Quoted Reply in Group
    const replyRes = await bob.fetch(`${API_BASE}/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: 'Thanks Alice, glad to be here!',
        replyToMessageId: sendData.message.id
      })
    });
    const replyData = await replyRes.json();

    assert(
      replyRes.status === 201 && replyData.message.reply_to_message_id === sendData.message.id,
      'Bob successfully sends a quoted reply to Alice in the group',
      `Replied to: ${replyData.message?.reply_to_message_id}`
    );

    // 3.3 Message Reaction in Group
    const reactRes = await charlie.fetch(`${API_BASE}/messages/${sendData.message.id}/reactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reaction: '🚀' })
    });
    const reactData = await reactRes.json();

    assert(
      reactRes.status === 200 && reactData.success === true,
      'Charlie successfully reacts to message with 🚀 emoji in the group',
      `Action: ${reactData.action}`
    );

    // -------------------------------------------------------------------------
    // TEST SUITE 4: Role-Based Access Control (RBAC)
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Role-Based Access Control (RBAC) Tests ---');

    // 4.1 Regular member (Charlie) attempts to add a member -> MUST FAIL (403)
    const unauthorizedAdd = await charlie.fetch(`${API_BASE}/groups/${groupId}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberIds: [david.user.id] })
    });
    assert(
      unauthorizedAdd.status === 403,
      'Regular member (Charlie) is forbidden from adding members (403 Forbidden)',
      `Status: ${unauthorizedAdd.status}`
    );

    // 4.2 Regular member (Charlie) attempts to update group name -> MUST FAIL (403)
    const unauthorizedUpdate = await charlie.fetch(`${API_BASE}/groups/${groupId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Hacked Group Name' })
    });
    assert(
      unauthorizedUpdate.status === 403,
      'Regular member (Charlie) is forbidden from updating group info (403 Forbidden)',
      `Status: ${unauthorizedUpdate.status}`
    );

    // 4.3 Alice (Creator) promotes Bob to 'admin'
    const promoteRes = await alice.fetch(`${API_BASE}/groups/${groupId}/members/${bob.user.id}/role`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'admin' })
    });
    const promoteData = await promoteRes.json();

    assert(
      promoteRes.status === 200 && promoteData.role === 'admin',
      'Creator successfully promotes Bob to admin',
      `Role: ${promoteData.role}`
    );

    // 4.4 Bob (now Admin) adds David to the group -> MUST SUCCEED (200)
    const adminAddRes = await bob.fetch(`${API_BASE}/groups/${groupId}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberIds: [david.user.id] })
    });
    const adminAddData = await adminAddRes.json();

    assert(
      adminAddRes.status === 200 && adminAddData.success === true,
      'Admin (Bob) successfully adds David to the group',
      `Added: ${adminAddData.addedMembers?.length}`
    );

    // 4.5 Bob (Admin) updates group description
    const adminUpdateRes = await bob.fetch(`${API_BASE}/groups/${groupId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: 'Updated by Admin Bob' })
    });
    assert(
      adminUpdateRes.status === 200,
      'Admin (Bob) successfully updates group description',
      `Status: ${adminUpdateRes.status}`
    );

    // 4.6 Bob (Admin) tries to remove Alice (Creator) -> MUST FAIL (403)
    const adminRemoveCreatorRes = await bob.fetch(`${API_BASE}/groups/${groupId}/members/${alice.user.id}`, {
      method: 'DELETE'
    });
    assert(
      adminRemoveCreatorRes.status === 403,
      'Admin is forbidden from removing group creator (403 Forbidden)',
      `Status: ${adminRemoveCreatorRes.status}`
    );

    // 4.7 Bob (Admin) removes David (Regular Member) -> MUST SUCCEED (200)
    const adminRemoveMemberRes = await bob.fetch(`${API_BASE}/groups/${groupId}/members/${david.user.id}`, {
      method: 'DELETE'
    });
    assert(
      adminRemoveMemberRes.status === 200,
      'Admin (Bob) successfully removes regular member (David)',
      `Status: ${adminRemoveMemberRes.status}`
    );

    // -------------------------------------------------------------------------
    // TEST SUITE 5: Ownership Transfer & Leaving Group
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Ownership Transfer & Member Leaving ---');

    // 5.1 Alice transfers group ownership to Charlie
    const transferRes = await alice.fetch(`${API_BASE}/groups/${groupId}/transfer-ownership`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newOwnerId: charlie.user.id })
    });
    assert(
      transferRes.status === 200,
      'Alice successfully transfers ownership to Charlie',
      `Status: ${transferRes.status}`
    );

    // Verify Charlie is now creator and Alice is admin
    const [charlieRole] = await pool.query(
      'SELECT role FROM group_members WHERE group_id = ? AND user_id = ?',
      [groupId, charlie.user.id]
    );
    const [aliceRole] = await pool.query(
      'SELECT role FROM group_members WHERE group_id = ? AND user_id = ?',
      [groupId, alice.user.id]
    );

    assert(
      charlieRole[0]?.role === 'creator' && aliceRole[0]?.role === 'admin',
      'Charlie is now "creator" and former creator Alice is "admin"',
      `Charlie: ${charlieRole[0]?.role}, Alice: ${aliceRole[0]?.role}`
    );

    // 5.2 Bob leaves the group
    const leaveRes = await bob.fetch(`${API_BASE}/groups/${groupId}/leave`, {
      method: 'POST'
    });
    assert(
      leaveRes.status === 200,
      'Bob successfully leaves the group',
      `Status: ${leaveRes.status}`
    );

    const [bobStatus] = await pool.query(
      'SELECT status FROM group_members WHERE group_id = ? AND user_id = ?',
      [groupId, bob.user.id]
    );
    assert(
      bobStatus[0]?.status === 'left',
      'Bob status in group_members is updated to "left"',
      `Status: ${bobStatus[0]?.status}`
    );

    // -------------------------------------------------------------------------
    // TEST SUITE 6: Group Calling Signaling
    // -------------------------------------------------------------------------
    console.log('\n--- 6. Multi-Participant Group Calling WebRTC Signaling ---');

    // Charlie (Creator) starts a group call
    const startCallRes = await emitWithAck(charlie.socket, 'group_call:start', {
      conversationId,
      callType: 'video'
    });

    assert(
      startCallRes?.success === true && Boolean(startCallRes?.callId),
      'Charlie successfully starts a group video call via Socket.IO',
      `CallId: ${startCallRes?.callId}`
    );

    const groupCallId = startCallRes?.callId;

    // Alice joins the group call
    const joinCallRes = await emitWithAck(alice.socket, 'group_call:join', {
      callId: groupCallId
    });

    assert(
      joinCallRes?.success === true && Array.isArray(joinCallRes?.participants),
      'Alice successfully joins the group call and receives participants list',
      `Participants: ${joinCallRes?.participants?.length}`
    );

    // Relay P2P signal between Alice and Charlie
    let signalReceived = null;
    charlie.socket.on('group_call:signal', (data) => {
      signalReceived = data;
    });

    alice.socket.emit('group_call:signal', {
      callId: groupCallId,
      toUserId: charlie.user.id,
      signal: { type: 'offer', sdp: 'mock_sdp_offer_mesh' }
    });

    await new Promise((r) => setTimeout(r, 400));

    assert(
      Boolean(signalReceived && signalReceived.fromUserId === alice.user.id),
      'P2P signaling relayed through server in group call mesh',
      `From: ${signalReceived?.fromUserId}`
    );

    // Leave call
    await emitWithAck(alice.socket, 'group_call:leave', { callId: groupCallId });
    await emitWithAck(charlie.socket, 'group_call:leave', { callId: groupCallId });

    // -------------------------------------------------------------------------
    // TEST SUITE 7: Group Deletion
    // -------------------------------------------------------------------------
    console.log('\n--- 7. Group Deletion & Cleanup ---');

    // Charlie deletes the group
    const deleteRes = await charlie.fetch(`${API_BASE}/groups/${groupId}`, {
      method: 'DELETE'
    });
    assert(
      deleteRes.status === 200,
      'Charlie (Creator) successfully deletes the group',
      `Status: ${deleteRes.status}`
    );

    // Verify cascading deletion in MySQL
    const [remainingGroups] = await pool.query('SELECT id FROM `groups` WHERE id = ?', [groupId]);
    const [remainingConv] = await pool.query('SELECT id FROM conversations WHERE id = ?', [conversationId]);

    assert(
      remainingGroups.length === 0 && remainingConv.length === 0,
      'Group and conversation cascadingly deleted from MySQL database',
      `Groups: ${remainingGroups.length}, Convs: ${remainingConv.length}`
    );

  } catch (err) {
    console.error('Unexpected test exception:', err);
    failed++;
  } finally {
    alice.disconnect();
    bob.disconnect();
    charlie.disconnect();
    david.disconnect();
  }

  console.log('\n================================================================');
  console.log(`DAY 8 TESTS COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

if (require.main === module) {
  runTests();
}

module.exports = { runTests };

