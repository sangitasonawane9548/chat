const http = require('http');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const { pool } = require('../config/database');

const request = (options, postData = null, isMultipart = false, boundary = '') => {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, headers: res.headers, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, data: body });
        }
      });
    });

    req.on('error', reject);

    if (postData) {
      if (Buffer.isBuffer(postData)) {
        req.write(postData);
      } else {
        req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
      }
    }
    req.end();
  });
};

const runDay3Tests = async () => {
  console.log('================================================================');
  console.log('🧪 RUNNING DAY 3: USER DISCOVERY, PROFILES & CHAT REQUESTS TESTS');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  const assert = (condition, testName, details = '') => {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName} - ${details}`);
      failed++;
    }
  };

  // Clean test data before running
  await pool.query("DELETE FROM users WHERE username IN ('user_alice', 'user_bob', 'user_charlie')");

  try {
    const passwordHash = await bcrypt.hash('TestPassword123!', 10);

    // Seed test users: Alice and Bob
    const [aliceRes] = await pool.query(
      `INSERT INTO users (full_name, username, email, password_hash, email_verified, account_status)
       VALUES ('Alice Cooper', 'user_alice', 'alice@test.com', ?, 1, 'active')`,
      [passwordHash]
    );
    const aliceId = aliceRes.insertId;
    await pool.query('INSERT INTO user_profiles (user_id, bio, is_online) VALUES (?, "Alice bio", 1)', [aliceId]);
    await pool.query('INSERT INTO user_settings (user_id, show_online_status, show_last_seen, allow_username_search, allow_chat_requests) VALUES (?, 1, 1, 1, "everyone")', [aliceId]);

    const [bobRes] = await pool.query(
      `INSERT INTO users (full_name, username, email, password_hash, email_verified, account_status)
       VALUES ('Bob Marley', 'user_bob', 'bob@test.com', ?, 1, 'active')`,
      [passwordHash]
    );
    const bobId = bobRes.insertId;
    await pool.query('INSERT INTO user_profiles (user_id, bio, is_online) VALUES (?, "Bob bio", 0)', [bobId]);
    await pool.query('INSERT INTO user_settings (user_id, show_online_status, show_last_seen, allow_username_search, allow_chat_requests) VALUES (?, 0, 0, 1, "everyone")', [bobId]);

    const [charlieRes] = await pool.query(
      `INSERT INTO users (full_name, username, email, password_hash, email_verified, account_status)
       VALUES ('Charlie Brown', 'user_charlie', 'charlie@test.com', ?, 1, 'active')`,
      [passwordHash]
    );
    const charlieId = charlieRes.insertId;
    await pool.query('INSERT INTO user_profiles (user_id, bio, is_online) VALUES (?, "Charlie bio", 1)', [charlieId]);
    await pool.query('INSERT INTO user_settings (user_id, show_online_status, show_last_seen, allow_username_search, allow_chat_requests) VALUES (?, 1, 1, 1, "everyone")', [charlieId]);

    // Login as Alice to obtain cookie
    const aliceLogin = await request(
      {
        hostname: 'localhost',
        port: 5000,
        path: '/api/auth/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      },
      { usernameOrEmail: 'user_alice', password: 'TestPassword123!' }
    );
    const aliceCookie = aliceLogin.headers['set-cookie'][0].split(';')[0];

    // Login as Bob to obtain cookie
    const bobLogin = await request(
      {
        hostname: 'localhost',
        port: 5000,
        path: '/api/auth/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      },
      { usernameOrEmail: 'user_bob', password: 'TestPassword123!' }
    );
    const bobCookie = bobLogin.headers['set-cookie'][0].split(';')[0];

    // -------------------------------------------------------------------------
    // TEST 1: Search an existing username
    // -------------------------------------------------------------------------
    const s1 = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/users/search?q=user_bob',
      method: 'GET',
      headers: { Cookie: aliceCookie }
    });
    assert(
      s1.status === 200 && s1.data.users.length === 1 && s1.data.users[0].username === 'user_bob',
      'TEST 1: Search exact existing username'
    );

    // -------------------------------------------------------------------------
    // TEST 2: Search a partial username
    // -------------------------------------------------------------------------
    const s2 = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/users/search?q=marley',
      method: 'GET',
      headers: { Cookie: aliceCookie }
    });
    assert(
      s2.status === 200 && s2.data.users.some((u) => u.username === 'user_bob'),
      'TEST 2: Search partial matching name'
    );

    // -------------------------------------------------------------------------
    // TEST 3: Search using uppercase letters
    // -------------------------------------------------------------------------
    const s3 = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/users/search?q=USER_BOB',
      method: 'GET',
      headers: { Cookie: aliceCookie }
    });
    assert(
      s3.status === 200 && s3.data.users.length >= 1 && s3.data.users[0].username === 'user_bob',
      'TEST 3: Case-insensitive search using uppercase letters'
    );

    // -------------------------------------------------------------------------
    // TEST 4: Search with @ prefix
    // -------------------------------------------------------------------------
    const s4 = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/users/search?q=@user_bob',
      method: 'GET',
      headers: { Cookie: aliceCookie }
    });
    assert(
      s4.status === 200 && s4.data.users.length >= 1 && s4.data.users[0].username === 'user_bob',
      'TEST 4: Search handle with @ prefix stripped automatically'
    );

    // -------------------------------------------------------------------------
    // TEST 5: Search a nonexistent username
    // -------------------------------------------------------------------------
    const s5 = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/users/search?q=completely_nonexistent_user_9999',
      method: 'GET',
      headers: { Cookie: aliceCookie }
    });
    assert(
      s5.status === 200 && s5.data.users.length === 0,
      'TEST 5: Search nonexistent username returns empty results array'
    );

    // -------------------------------------------------------------------------
    // TEST 6: Search with empty query
    // -------------------------------------------------------------------------
    const s6 = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/users/search?q=',
      method: 'GET',
      headers: { Cookie: aliceCookie }
    });
    assert(
      s6.status === 200 && s6.data.users.length === 0,
      'TEST 6: Search with empty query'
    );

    // -------------------------------------------------------------------------
    // TEST 7: Confirm current user does NOT appear in search results
    // -------------------------------------------------------------------------
    const s7 = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/users/search?q=alice',
      method: 'GET',
      headers: { Cookie: aliceCookie }
    });
    const containsSelf = s7.data.users?.some((u) => u.username === 'user_alice');
    assert(
      s7.status === 200 && !containsSelf,
      'TEST 7: Current user is excluded from search results'
    );

    // -------------------------------------------------------------------------
    // TEST 8: Confirm private information is NOT exposed
    // -------------------------------------------------------------------------
    const targetInSearch = s1.data.users[0];
    assert(
      targetInSearch.email === undefined && targetInSearch.password_hash === undefined,
      'TEST 8: Private information (email, password hash) is not leaked in search results'
    );

    // -------------------------------------------------------------------------
    // TEST 9: Privacy settings respected in search results
    // -------------------------------------------------------------------------
    // Bob has show_online_status = 0 and show_last_seen = 0
    assert(
      targetInSearch.is_online === false && targetInSearch.last_seen === null,
      'TEST 9: User privacy settings (hidden presence) respected in results'
    );

    // -------------------------------------------------------------------------
    // TEST 10: Open own profile (contains email & is_own_profile: true)
    // -------------------------------------------------------------------------
    const pOwn = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/users/user_alice',
      method: 'GET',
      headers: { Cookie: aliceCookie }
    });
    assert(
      pOwn.status === 200 && pOwn.data.profile.is_own_profile === true && pOwn.data.profile.email === 'alice@test.com',
      'TEST 10: Open own profile (contains private details & is_own_profile true)'
    );

    // -------------------------------------------------------------------------
    // TEST 11: Open another user's profile (email hidden & is_own_profile: false)
    // -------------------------------------------------------------------------
    const pOther = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/users/user_bob',
      method: 'GET',
      headers: { Cookie: aliceCookie }
    });
    assert(
      pOther.status === 200 && pOther.data.profile.is_own_profile === false && pOther.data.profile.email === undefined,
      'TEST 11: Open another user profile (email hidden & is_own_profile false)'
    );

    // -------------------------------------------------------------------------
    // TEST 12: Update own profile (full name, bio)
    // -------------------------------------------------------------------------
    const updateRes = await request(
      {
        hostname: 'localhost',
        port: 5000,
        path: '/api/users/me/profile',
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Cookie: aliceCookie }
      },
      { fullName: 'Alice Cooper Updated', bio: 'Updated bio for Alice' }
    );
    const [updatedUser] = await pool.query('SELECT full_name FROM users WHERE id = ?', [aliceId]);
    assert(
      updateRes.status === 200 && updatedUser[0].full_name === 'Alice Cooper Updated',
      'TEST 12: Update own profile successfully'
    );

    // -------------------------------------------------------------------------
    // TEST 13: Send chat request from Alice to Bob
    // -------------------------------------------------------------------------
    const reqRes = await request(
      {
        hostname: 'localhost',
        port: 5000,
        path: '/api/chat-requests',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: aliceCookie }
      },
      { receiver_id: bobId }
    );
    const requestId = reqRes.data.requestId;
    assert(
      reqRes.status === 201 && reqRes.data.success && requestId,
      'TEST 13: Send chat request successfully'
    );

    // -------------------------------------------------------------------------
    // TEST 14: Prevent sending request to oneself
    // -------------------------------------------------------------------------
    const selfReq = await request(
      {
        hostname: 'localhost',
        port: 5000,
        path: '/api/chat-requests',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: aliceCookie }
      },
      { receiver_id: aliceId }
    );
    assert(
      selfReq.status === 400 && selfReq.data.message.includes('yourself'),
      'TEST 14: Prevent sending chat request to yourself'
    );

    // -------------------------------------------------------------------------
    // TEST 15: Prevent duplicate pending requests
    // -------------------------------------------------------------------------
    const dupReq = await request(
      {
        hostname: 'localhost',
        port: 5000,
        path: '/api/chat-requests',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: aliceCookie }
      },
      { receiver_id: bobId }
    );
    assert(
      dupReq.status === 409 && dupReq.data.message.includes('already have a pending'),
      'TEST 15: Prevent duplicate pending requests between same users'
    );

    // -------------------------------------------------------------------------
    // TEST 16: Sent request appears in Alice's /api/chat-requests/sent
    // -------------------------------------------------------------------------
    const sentList = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/chat-requests/sent',
      method: 'GET',
      headers: { Cookie: aliceCookie }
    });
    assert(
      sentList.status === 200 && sentList.data.requests.some((r) => r.id === requestId && r.username === 'user_bob'),
      'TEST 16: Sent request appears in GET /api/chat-requests/sent'
    );

    // -------------------------------------------------------------------------
    // TEST 17: Incoming request appears in Bob's /api/chat-requests/incoming
    // -------------------------------------------------------------------------
    const incList = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/chat-requests/incoming',
      method: 'GET',
      headers: { Cookie: bobCookie }
    });
    assert(
      incList.status === 200 && incList.data.requests.some((r) => r.id === requestId && r.username === 'user_alice'),
      'TEST 17: Incoming request appears in GET /api/chat-requests/incoming'
    );

    // -------------------------------------------------------------------------
    // TEST 18: Notification was recorded for Bob in notifications table
    // -------------------------------------------------------------------------
    const notifRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/notifications',
      method: 'GET',
      headers: { Cookie: bobCookie }
    });
    assert(
      notifRes.status === 200 && notifRes.data.notifications.some((n) => n.notification_type === 'chat_request'),
      'TEST 18: In-app notification created for receiver in notifications table'
    );

    // -------------------------------------------------------------------------
    // TEST 19: Accept chat request -> Conversation established
    // -------------------------------------------------------------------------
    const acceptRes = await request(
      {
        hostname: 'localhost',
        port: 5000,
        path: `/api/chat-requests/${requestId}/accept`,
        method: 'POST',
        headers: { Cookie: bobCookie }
      }
    );
    const conversationId = acceptRes.data.conversationId;
    assert(
      acceptRes.status === 200 && acceptRes.data.success && conversationId,
      'TEST 19: Accept chat request creates authorized direct conversation'
    );

    // -------------------------------------------------------------------------
    // TEST 20: Both users are members of conversation
    // -------------------------------------------------------------------------
    const [members] = await pool.query(
      'SELECT user_id FROM conversation_members WHERE conversation_id = ?',
      [conversationId]
    );
    const memberIds = members.map((m) => m.user_id);
    assert(
      memberIds.includes(aliceId) && memberIds.includes(bobId) && memberIds.length === 2,
      'TEST 20: Both users are verified conversation_members in database'
    );

    // -------------------------------------------------------------------------
    // TEST 21: GET /api/conversations returns authorized conversation for Alice
    // -------------------------------------------------------------------------
    const aliceConvs = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/conversations',
      method: 'GET',
      headers: { Cookie: aliceCookie }
    });
    assert(
      aliceConvs.status === 200 && aliceConvs.data.conversations.some((c) => c.id === conversationId),
      'TEST 21: Conversation accessible via GET /api/conversations for Alice'
    );

    // -------------------------------------------------------------------------
    // TEST 22: Search relationship now shows 'connected' between Alice & Bob
    // -------------------------------------------------------------------------
    const relCheck = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/users/search?q=user_bob',
      method: 'GET',
      headers: { Cookie: aliceCookie }
    });
    assert(
      relCheck.status === 200 && relCheck.data.users[0].relationship === 'connected',
      'TEST 22: Relationship status automatically updates to connected'
    );

    // -------------------------------------------------------------------------
    // TEST 23: Decline a chat request (Charlie -> Alice)
    // -------------------------------------------------------------------------
    const charlieLogin = await request(
      {
        hostname: 'localhost',
        port: 5000,
        path: '/api/auth/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      },
      { usernameOrEmail: 'user_charlie', password: 'TestPassword123!' }
    );
    const charlieCookie = charlieLogin.headers['set-cookie'][0].split(';')[0];

    const cReq = await request(
      {
        hostname: 'localhost',
        port: 5000,
        path: '/api/chat-requests',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: charlieCookie }
      },
      { receiver_id: aliceId }
    );
    const cReqId = cReq.data.requestId;

    const declineRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: `/api/chat-requests/${cReqId}/decline`,
      method: 'POST',
      headers: { Cookie: aliceCookie }
    });
    const [cReqStatus] = await pool.query('SELECT status FROM chat_requests WHERE id = ?', [cReqId]);
    assert(
      declineRes.status === 200 && cReqStatus[0].status === 'declined',
      'TEST 23: Decline incoming chat request'
    );

    // -------------------------------------------------------------------------
    // TEST 24: Cancel a sent chat request (Alice -> Charlie)
    // -------------------------------------------------------------------------
    const aToC = await request(
      {
        hostname: 'localhost',
        port: 5000,
        path: '/api/chat-requests',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: aliceCookie }
      },
      { receiver_id: charlieId }
    );
    const aToCId = aToC.data.requestId;

    const cancelRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: `/api/chat-requests/${aToCId}/cancel`,
      method: 'POST',
      headers: { Cookie: aliceCookie }
    });
    const [cancelStatus] = await pool.query('SELECT status FROM chat_requests WHERE id = ?', [aToCId]);
    assert(
      cancelRes.status === 200 && cancelStatus[0].status === 'cancelled',
      'TEST 24: Cancel outgoing pending chat request'
    );

    console.log('\n================================================================');
    console.log(`🎉 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED (TOTAL 24 TESTS)`);
    console.log('================================================================\n');

    process.exit(failed === 0 ? 0 : 1);
  } catch (err) {
    console.error('Day 3 test error:', err);
    process.exit(1);
  }
};

runDay3Tests();

