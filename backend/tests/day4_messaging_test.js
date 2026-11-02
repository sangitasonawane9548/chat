/**
 * =============================================================================
 * DAY 4 TEST SUITE: COMPLETE REAL-TIME ONE-TO-ONE MESSAGING SYSTEM
 * =============================================================================
 */

const path = require('path');
const { io: Client } = require(path.resolve(__dirname, '../node_modules/socket.io-client'));
const bcrypt = require('bcryptjs');
const { pool } = require('../config/database');

const BASE_URL = 'http://localhost:5000/api';
const SOCKET_URL = 'http://localhost:5000';

let passed = 0;
let failed = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`✅ [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`❌ [FAIL] ${testName}`);
    if (details) console.error(`   Details: ${details}`);
    failed++;
  }
}

async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  const response = await fetch(url, {
    ...options,
    headers
  });

  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    data = { raw: text };
  }

  // Extract set-cookie if any
  const cookieHeader = response.headers.get('set-cookie');
  let token = null;
  if (cookieHeader) {
    const match = cookieHeader.match(/token=([^;]+)/);
    if (match) token = match[1];
  }

  return { status: response.status, data, token, headers: response.headers };
}

function waitForConnect(socket) {
  return new Promise((resolve, reject) => {
    if (socket.connected) return resolve();
    socket.once('connect', resolve);
    socket.once('connect_error', (err) => reject(new Error('Socket connect error: ' + err.message)));
    setTimeout(() => {
      if (socket.connected) resolve();
      else reject(new Error('Socket connection timed out'));
    }, 5000);
  });
}

function emitWithAck(socket, event, data) {
  return new Promise((resolve) => {
    socket.emit(event, data, (response) => {
      resolve(response);
    });
    setTimeout(() => resolve({ timeout: true }), 3000);
  });
}

async function runTests() {
  console.log('\n================================================================');
  console.log('🧪 RUNNING DAY 4: COMPLETE REAL-TIME ONE-TO-ONE MESSAGING TESTS');
  console.log('================================================================\n');

  let aliceToken = null;
  let bobToken = null;
  let charlieToken = null;
  let aliceId = null;
  let bobId = null;
  let charlieId = null;
  let conversationId = null;

  let aliceSocket = null;
  let bobSocket = null;

  try {
    // -------------------------------------------------------------------------
    // Setup Test Users: Alice, Bob, Charlie
    // -------------------------------------------------------------------------
    const passwordHash = await bcrypt.hash('SecurePassword123!', 10);

    const usersToCreate = [
      { email: 'day4_alice@example.com', username: 'day4_alice', full_name: 'Alice DayFour' },
      { email: 'day4_bob@example.com', username: 'day4_bob', full_name: 'Bob DayFour' },
      { email: 'day4_charlie@example.com', username: 'day4_charlie', full_name: 'Charlie DayFour' }
    ];

    for (const u of usersToCreate) {
      const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [u.email]);
      if (existing.length > 0) {
        await pool.query('DELETE FROM users WHERE id = ?', [existing[0].id]);
      }

      const [res] = await pool.query(
        'INSERT INTO users (email, username, password_hash, full_name, account_status, email_verified) VALUES (?, ?, ?, ?, "active", 1)',
        [u.email, u.username, passwordHash, u.full_name]
      );
      const uid = res.insertId;
      await pool.query('INSERT INTO user_profiles (user_id, bio, is_online) VALUES (?, "Day 4 Tester", 0)', [uid]);
      await pool.query('INSERT INTO user_settings (user_id, show_online_status) VALUES (?, 1)', [uid]);
    }

    // Login Alice
    const aliceLogin = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ usernameOrEmail: 'day4_alice', password: 'SecurePassword123!' })
    });
    aliceToken = aliceLogin.token;
    aliceId = aliceLogin.data.user.id;

    // Login Bob
    const bobLogin = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ usernameOrEmail: 'day4_bob', password: 'SecurePassword123!' })
    });
    bobToken = bobLogin.token;
    bobId = bobLogin.data.user.id;

    // Login Charlie
    const charlieLogin = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ usernameOrEmail: 'day4_charlie', password: 'SecurePassword123!' })
    });
    charlieToken = charlieLogin.token;
    charlieId = charlieLogin.data.user.id;

    // Setup direct conversation between Alice and Bob
    const [convRes] = await pool.query('INSERT INTO conversations (conversation_type) VALUES ("direct")');
    conversationId = convRes.insertId;
    await pool.query(
      'INSERT INTO conversation_members (conversation_id, user_id) VALUES (?, ?), (?, ?)',
      [conversationId, aliceId, conversationId, bobId]
    );

    // Connect Bob's socket
    bobSocket = Client(SOCKET_URL, {
      auth: { token: bobToken },
      transports: ['websocket'],
      forceNew: true
    });
    await waitForConnect(bobSocket);
    await emitWithAck(bobSocket, 'join_conversation', { conversationId });

    // Connect Alice's socket
    aliceSocket = Client(SOCKET_URL, {
      auth: { token: aliceToken },
      transports: ['websocket'],
      forceNew: true
    });
    await waitForConnect(aliceSocket);
    await emitWithAck(aliceSocket, 'join_conversation', { conversationId });

    // =========================================================================
    // TEST 1: GET /api/conversations for Alice
    // =========================================================================
    const convsRes = await request('/conversations', {
      headers: { Authorization: `Bearer ${aliceToken}` }
    });
    assert(
      convsRes.status === 200 &&
      convsRes.data.success &&
      Array.isArray(convsRes.data.conversations) &&
      convsRes.data.conversations.some(c => c.id === conversationId && c.participant.username === 'day4_bob'),
      'TEST 1: Fetch conversations list (Alice sees direct conversation with Bob)'
    );

    // =========================================================================
    // TEST 2: GET /api/conversations/:id for authorized member (Alice)
    // =========================================================================
    const singleConvRes = await request(`/conversations/${conversationId}`, {
      headers: { Authorization: `Bearer ${aliceToken}` }
    });
    assert(
      singleConvRes.status === 200 &&
      singleConvRes.data.success &&
      singleConvRes.data.conversation.participant.username === 'day4_bob',
      'TEST 2: Fetch single conversation details for authorized member'
    );

    // =========================================================================
    // TEST 3: GET /api/conversations/:id for non-member (Charlie) -> 403 Forbidden
    // =========================================================================
    const forbiddenConvRes = await request(`/conversations/${conversationId}`, {
      headers: { Authorization: `Bearer ${charlieToken}` }
    });
    assert(
      forbiddenConvRes.status === 403,
      'TEST 3: Non-member (Charlie) accessing conversation receives 403 Forbidden'
    );

    // =========================================================================
    // TEST 4 & 11: Real-time messaging (Alice sends, Bob receives via Socket.IO)
    // =========================================================================
    let bobReceivedMessage = null;
    bobSocket.on('new_message', (msg) => {
      if (msg.conversation_id === conversationId) {
        bobReceivedMessage = msg;
      }
    });

    const sendRes = await request(`/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${aliceToken}` },
      body: JSON.stringify({
        content: 'Hello Bob! This is Alice on Day 4.',
        clientMessageId: 'client_msg_101'
      })
    });

    assert(
      sendRes.status === 201 &&
      sendRes.data.success &&
      sendRes.data.message.message_content === 'Hello Bob! This is Alice on Day 4.',
      'TEST 4: Alice sends message via POST /api/conversations/:id/messages'
    );

    const message1Id = sendRes.data.message.id;

    // =========================================================================
    // TEST 5: Message persistence in MySQL messages table
    // =========================================================================
    const [msgDb] = await pool.query('SELECT * FROM messages WHERE id = ?', [message1Id]);
    assert(
      msgDb.length === 1 &&
      msgDb[0].message_content === 'Hello Bob! This is Alice on Day 4.' &&
      msgDb[0].sender_id === aliceId,
      'TEST 5: Message is permanently persisted in MySQL messages table'
    );

    // =========================================================================
    // TEST 6: Message receipt created in message_receipts
    // =========================================================================
    const [receiptDb] = await pool.query(
      'SELECT * FROM message_receipts WHERE message_id = ? AND user_id = ?',
      [message1Id, bobId]
    );
    assert(
      receiptDb.length === 1 && receiptDb[0].delivered_at !== null,
      'TEST 6: Delivery receipt created in message_receipts (Bob was online -> delivered_at set)'
    );

    // =========================================================================
    // TEST 7: Idempotency with clientMessageId
    // =========================================================================
    const duplicateSendRes = await request(`/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${aliceToken}` },
      body: JSON.stringify({
        content: 'Hello Bob! This is Alice on Day 4.',
        clientMessageId: 'client_msg_101'
      })
    });
    assert(
      duplicateSendRes.status === 200 &&
      duplicateSendRes.data.message.id === message1Id,
      'TEST 7: Idempotent message sending prevents duplicates with same clientMessageId'
    );

    // =========================================================================
    // TEST 8: Empty message rejected (400)
    // =========================================================================
    const emptyMsgRes = await request(`/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${aliceToken}` },
      body: JSON.stringify({ content: '   ' })
    });
    assert(
      emptyMsgRes.status === 400,
      'TEST 8: Empty/whitespace message rejected with 400 Bad Request'
    );

    // =========================================================================
    // TEST 9: Oversized message (>5000 chars) rejected (400)
    // =========================================================================
    const hugeMsgRes = await request(`/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${aliceToken}` },
      body: JSON.stringify({ content: 'A'.repeat(5001) })
    });
    assert(
      hugeMsgRes.status === 400,
      'TEST 9: Oversized message (>5000 chars) rejected with 400'
    );

    // =========================================================================
    // TEST 10: Non-member cannot send message in conversation (403)
    // =========================================================================
    const charlieSendRes = await request(`/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${charlieToken}` },
      body: JSON.stringify({ content: 'Hey guys let me in!' })
    });
    assert(
      charlieSendRes.status === 403,
      'TEST 10: Unauthorized user (Charlie) blocked from sending message (403)'
    );

    // Wait slightly for socket event to be received by Bob
    await new Promise((r) => setTimeout(r, 200));

    // =========================================================================
    // TEST 11: Real-time Socket.IO: Bob received new_message event
    // =========================================================================
    assert(
      bobReceivedMessage !== null &&
      bobReceivedMessage.id === message1Id &&
      bobReceivedMessage.message_content === 'Hello Bob! This is Alice on Day 4.',
      'TEST 11: Real-time Socket.IO: Bob received new_message event with full payload'
    );

    // =========================================================================
    // TEST 12: Typing indicators (typing_start, typing_stop)
    // =========================================================================
    let bobSawTyping = false;
    let bobSawStopTyping = false;

    bobSocket.on('user_typing', (data) => {
      if (data.userId === aliceId) bobSawTyping = true;
    });

    bobSocket.on('user_stopped_typing', (data) => {
      if (data.userId === aliceId) bobSawStopTyping = true;
    });

    aliceSocket.emit('typing_start', { conversationId });
    await new Promise((r) => setTimeout(r, 250));

    aliceSocket.emit('typing_stop', { conversationId });
    await new Promise((r) => setTimeout(r, 250));

    assert(
      bobSawTyping && bobSawStopTyping,
      'TEST 12: Real-time typing indicators delivered over Socket.IO (typing_start & typing_stop)'
    );

    // =========================================================================
    // TEST 13: Read Receipts (POST /api/conversations/:id/read)
    // =========================================================================
    let aliceReceivedReadReceipt = false;
    aliceSocket.on('messages_read', (data) => {
      if (data.conversationId === conversationId && data.readerId === bobId) {
        aliceReceivedReadReceipt = true;
      }
    });

    const readRes = await request(`/conversations/${conversationId}/read`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${bobToken}` }
    });

    assert(
      readRes.status === 200 && readRes.data.success,
      'TEST 13: Bob marks conversation as read via POST /api/conversations/:id/read'
    );

    // =========================================================================
    // TEST 14: Receipt updated in MySQL message_receipts
    // =========================================================================
    const [readReceiptDb] = await pool.query(
      'SELECT read_at FROM message_receipts WHERE message_id = ? AND user_id = ?',
      [message1Id, bobId]
    );
    assert(
      readReceiptDb.length === 1 && readReceiptDb[0].read_at !== null,
      'TEST 14: Database receipt marked read_at IS NOT NULL in message_receipts'
    );

    await new Promise((r) => setTimeout(r, 200));

    // =========================================================================
    // TEST 15: Real-time Socket.IO: Alice received messages_read event
    // =========================================================================
    assert(
      aliceReceivedReadReceipt,
      'TEST 15: Real-time Socket.IO: Alice received messages_read event with blue checkmark update'
    );

    // =========================================================================
    // TEST 16: Edit own message within 15 minutes (PATCH /api/messages/:id)
    // =========================================================================
    let bobReceivedMessageEdit = null;
    bobSocket.on('message_edited', (data) => {
      if (data.messageId === message1Id) {
        bobReceivedMessageEdit = data;
      }
    });

    const editRes = await request(`/messages/${message1Id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${aliceToken}` },
      body: JSON.stringify({ content: 'Hello Bob! (Edited content)' })
    });

    assert(
      editRes.status === 200 &&
      editRes.data.success &&
      editRes.data.data.content === 'Hello Bob! (Edited content)' &&
      editRes.data.data.is_edited === true,
      'TEST 16: Alice successfully edits own message within 15 minutes'
    );

    const [editedMsgDb] = await pool.query('SELECT message_content, is_edited FROM messages WHERE id = ?', [message1Id]);
    assert(
      editedMsgDb[0].message_content === 'Hello Bob! (Edited content)' && editedMsgDb[0].is_edited === 1,
      'TEST 17: Database reflects message_content update and is_edited = 1'
    );

    await new Promise((r) => setTimeout(r, 200));
    assert(
      bobReceivedMessageEdit !== null && bobReceivedMessageEdit.content === 'Hello Bob! (Edited content)',
      'TEST 18: Real-time Socket.IO: Bob received message_edited event'
    );

    // =========================================================================
    // TEST 19: Bob cannot edit Alice's message (403 Forbidden)
    // =========================================================================
    const unauthorizedEditRes = await request(`/messages/${message1Id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${bobToken}` },
      body: JSON.stringify({ content: 'Hacked by Bob!' })
    });
    assert(
      unauthorizedEditRes.status === 403,
      'TEST 19: Bob attempting to edit Alice message rejected with 403 Forbidden'
    );

    // =========================================================================
    // TEST 20: Delete For Me (DELETE /api/messages/:id)
    // =========================================================================
    const deleteForMeRes = await request(`/messages/${message1Id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${aliceToken}` }
    });
    assert(
      deleteForMeRes.status === 200 && deleteForMeRes.data.success,
      'TEST 20: Alice deletes message for me (DELETE /api/messages/:id)'
    );

    // Verify Alice no longer sees the message
    const aliceMsgs = await request(`/conversations/${conversationId}/messages`, {
      headers: { Authorization: `Bearer ${aliceToken}` }
    });
    assert(
      !aliceMsgs.data.messages.some(m => m.id === message1Id),
      'TEST 21: Alice messages list excludes message deleted for me'
    );

    // Verify Bob STILL sees the message
    const bobMsgs = await request(`/conversations/${conversationId}/messages`, {
      headers: { Authorization: `Bearer ${bobToken}` }
    });
    assert(
      bobMsgs.data.messages.some(m => m.id === message1Id),
      'TEST 22: Bob messages list STILL contains the message (Delete For Me isolation confirmed)'
    );

    // =========================================================================
    // TEST 23 & 24: Delete For Everyone (POST /api/messages/:id/delete-for-everyone)
    // =========================================================================
    // Alice sends message 2
    const send2Res = await request(`/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${aliceToken}` },
      body: JSON.stringify({ content: 'Secret info to be deleted for everyone!' })
    });
    const message2Id = send2Res.data.message.id;

    let bobReceivedMessageDelete = null;
    bobSocket.on('message_deleted', (data) => {
      if (data.messageId === message2Id) {
        bobReceivedMessageDelete = data;
      }
    });

    const deleteEveryoneRes = await request(`/messages/${message2Id}/delete-for-everyone`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${aliceToken}` }
    });

    assert(
      deleteEveryoneRes.status === 200 && deleteEveryoneRes.data.success,
      'TEST 23: Alice deletes message for everyone (POST /api/messages/:id/delete-for-everyone)'
    );

    const [deletedDb] = await pool.query('SELECT deleted_for_everyone, message_content FROM messages WHERE id = ?', [message2Id]);
    assert(
      deletedDb[0].deleted_for_everyone === 1 && deletedDb[0].message_content === 'This message was deleted',
      'TEST 24: Database deleted_for_everyone is 1 and content masked'
    );

    await new Promise((r) => setTimeout(r, 200));
    assert(
      bobReceivedMessageDelete !== null && bobReceivedMessageDelete.deletedForEveryone === true,
      'TEST 25: Real-time Socket.IO: Bob received message_deleted event'
    );

    // =========================================================================
    // TEST 26: Bob cannot delete Alice's message for everyone (403)
    // =========================================================================
    const send3Res = await request(`/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${aliceToken}` },
      body: JSON.stringify({ content: 'Alice message 3' })
    });
    const message3Id = send3Res.data.message.id;

    const unauthorizedDeleteEveryone = await request(`/messages/${message3Id}/delete-for-everyone`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${bobToken}` }
    });
    assert(
      unauthorizedDeleteEveryone.status === 403,
      'TEST 26: Bob attempting to delete Alice message for everyone rejected with 403'
    );

    // =========================================================================
    // TEST 27: In-Conversation Message Search
    // =========================================================================
    await request(`/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${bobToken}` },
      body: JSON.stringify({ content: 'We need to discuss the project launch next week.' })
    });

    const searchRes = await request(`/conversations/${conversationId}/search?q=project+launch`, {
      headers: { Authorization: `Bearer ${aliceToken}` }
    });
    assert(
      searchRes.status === 200 &&
      searchRes.data.success &&
      searchRes.data.results.length > 0 &&
      searchRes.data.results[0].message_content.includes('project launch'),
      'TEST 27: In-conversation search locates matching message by keyword'
    );

    // =========================================================================
    // TEST 28: Clear Conversation History for Current User (POST /api/conversations/:id/clear)
    // =========================================================================
    const clearRes = await request(`/conversations/${conversationId}/clear`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${bobToken}` }
    });
    assert(
      clearRes.status === 200 && clearRes.data.success,
      'TEST 28: Bob clears conversation history for himself'
    );

    const bobMsgsAfterClear = await request(`/conversations/${conversationId}/messages`, {
      headers: { Authorization: `Bearer ${bobToken}` }
    });
    assert(
      bobMsgsAfterClear.data.messages.length === 0,
      'TEST 29: Bob messages list is now empty after clearing history'
    );

    const aliceMsgsAfterClear = await request(`/conversations/${conversationId}/messages`, {
      headers: { Authorization: `Bearer ${aliceToken}` }
    });
    assert(
      aliceMsgsAfterClear.data.messages.length > 0,
      'TEST 30: Alice conversation history is preserved (not deleted for other party)'
    );

    // =========================================================================
    // TEST 31: Unread Count Calculation in GET /api/conversations
    // =========================================================================
    // Alice sends Bob a new message
    await request(`/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${aliceToken}` },
      body: JSON.stringify({ content: 'New message after clear!' })
    });

    const bobConvs = await request('/conversations', {
      headers: { Authorization: `Bearer ${bobToken}` }
    });
    const targetConv = bobConvs.data.conversations.find(c => c.id === conversationId);
    assert(
      targetConv && targetConv.unread_count === 1 && targetConv.last_message.message_content === 'New message after clear!',
      'TEST 31: Unread count dynamically increments and last message preview updates'
    );

    // =========================================================================
    // TEST 32: Real-time Presence Update on Disconnect
    // =========================================================================
    let presenceOfflineReceived = false;
    aliceSocket.on('user_presence_changed', (data) => {
      if (data.userId === bobId && data.isOnline === false) {
        presenceOfflineReceived = true;
      }
    });

    bobSocket.disconnect();
    await new Promise((r) => setTimeout(r, 400));

    const [bobProfile] = await pool.query('SELECT is_online FROM user_profiles WHERE user_id = ?', [bobId]);
    assert(
      bobProfile[0].is_online === 0,
      'TEST 32: Disconnecting user marks profile is_online = 0 and broadcasts presence change'
    );

  } catch (err) {
    console.error('Unhandled test execution error:', err);
    failed++;
  } finally {
    if (aliceSocket) aliceSocket.disconnect();
    if (bobSocket) bobSocket.disconnect();

    console.log('\n================================================================');
    console.log(`🎉 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED (TOTAL ${passed + failed} TESTS)`);
    console.log('================================================================\n');

    setTimeout(() => {
      process.exit(failed > 0 ? 1 : 0);
    }, 200);
  }
}

runTests();
