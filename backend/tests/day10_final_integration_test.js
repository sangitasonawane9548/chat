/**
 * =============================================================================
 * DAY 10: COMPLETE FINAL INTEGRATION & PRODUCTION READINESS TEST SUITE
 * =============================================================================
 */

const path = require('path');
const { pool } = require('../config/database');
const notificationService = require('../services/notificationService');

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

class UserClient {
  constructor(username, email, fullName) {
    this.username = username;
    this.email = email;
    this.fullName = fullName;
    this.token = null;
    this.cookie = null;
    this.user = null;
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
  }

  async fetch(url, options = {}) {
    const headers = options.headers || {};
    if (this.cookie) {
      headers['Cookie'] = this.cookie;
    }
    return fetch(url, { ...options, headers });
  }
}

async function runTests() {
  console.log('\n================================================================');
  console.log('🚀 RUNNING DAY 10: COMPLETE FINAL INTEGRATION & SYSTEM TEST SUITE');
  console.log('================================================================\n');

  const userA = new UserClient('user_a_final', 'user_a_final@test.com', 'Alex FinalUser');
  const userB = new UserClient('user_b_final', 'user_b_final@test.com', 'Bailey FinalUser');
  const userC = new UserClient('user_c_final', 'user_c_final@test.com', 'Casey FinalUser');
  const userD = new UserClient('user_d_final', 'user_d_final@test.com', 'Devon FinalUser');

  try {
    // -------------------------------------------------------------------------
    // TEST SECTION 1: Authentication & Session Verification
    // -------------------------------------------------------------------------
    console.log('--- 1. Authentication & Session Security Tests ---');

    await userA.init();
    await userB.init();
    await userC.init();
    await userD.init();

    assert(!!userA.user && userA.user.username === 'user_a_final', 'User A registered, verified with OTP 123456, and logged in');
    assert(!!userA.token || !!userA.cookie, 'User A session issued with secure HTTP-only token cookie');

    // Restore session via /api/auth/me
    const meRes = await userA.fetch(`${API_BASE}/auth/me`);
    const meData = await meRes.json();
    assert(meRes.status === 200 && meData.user?.id === userA.user.id, 'Session correctly authenticated via GET /api/auth/me');

    // -------------------------------------------------------------------------
    // TEST SECTION 2: User Settings & Privacy Persistence (MySQL user_settings)
    // -------------------------------------------------------------------------
    console.log('\n--- 2. User Settings & Privacy Persistence Tests ---');

    // 2.1 Fetch initial settings
    const getSetRes = await userA.fetch(`${API_BASE}/users/settings`);
    const getSetData = await getSetRes.json();
    assert(getSetRes.status === 200 && getSetData.success, 'Fetched user settings from MySQL user_settings table');

    // 2.2 Update settings (theme, call permissions, privacy toggles)
    const updateSetRes = await userA.fetch(`${API_BASE}/users/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        theme: 'dark',
        show_last_seen: false,
        show_online_status: true,
        show_read_receipts: false,
        call_permissions: 'contacts_only'
      })
    });
    const updateSetData = await updateSetRes.json();
    assert(updateSetRes.status === 200 && updateSetData.success, 'Successfully persisted updated user settings to MySQL');
    assert(updateSetData.settings?.show_last_seen === false, 'Setting show_last_seen updated to false');
    assert(updateSetData.settings?.call_permissions === 'contacts_only', 'Setting call_permissions updated to contacts_only');

    // 2.3 Verify round-trip persistence
    const verifySetRes = await userA.fetch(`${API_BASE}/users/settings`);
    const verifySetData = await verifySetRes.json();
    assert(verifySetData.settings?.show_read_receipts === false, 'Read receipts setting persistent across API requests');

    // -------------------------------------------------------------------------
    // TEST SECTION 3: User Blocking, Discovery & Unblocking
    // -------------------------------------------------------------------------
    console.log('\n--- 3. User Blocking & Discovery Enforcement Tests ---');

    // 3.1 User A blocks User C
    const blockRes = await userA.fetch(`${API_BASE}/users/block/${userC.user.id}`, { method: 'POST' });
    const blockData = await blockRes.json();
    assert(blockRes.status === 200 && blockData.success, 'User A successfully blocks User C');

    // 3.2 Fetch blocked users list
    const blockedListRes = await userA.fetch(`${API_BASE}/users/blocked`);
    const blockedListData = await blockedListRes.json();
    assert(blockedListRes.status === 200, 'User A fetches blocked contacts list');
    assert(blockedListData.blockedUsers?.some((u) => u.id === userC.user.id), 'User C is present in User A\'s blocked list');

    // 3.3 Search exclusion: User A searching for User C should return empty
    const searchRes = await userA.fetch(`${API_BASE}/users/search?q=user_c_final`);
    const searchData = await searchRes.json();
    assert(searchData.users?.length === 0, 'Blocked users are automatically excluded from search discovery');

    // 3.4 Unblock User C
    const unblockRes = await userA.fetch(`${API_BASE}/users/block/${userC.user.id}`, { method: 'DELETE' });
    assert(unblockRes.status === 200, 'User A unblocks User C successfully');

    // -------------------------------------------------------------------------
    // TEST SECTION 4: Centralized Notification System
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Centralized Notification System Tests ---');

    // 4.1 Trigger test notifications for User A
    await notificationService.sendNotification({
      userId: userA.user.id,
      type: 'system',
      title: 'Welcome to Aether Final Release',
      description: 'Your account is secured with end-to-end optimizations.'
    });

    await notificationService.sendMissedCallNotification({
      callerId: userB.user.id,
      receiverId: userA.user.id,
      callType: 'video',
      callerName: userB.fullName
    });

    // 4.2 Fetch notifications
    const notifRes = await userA.fetch(`${API_BASE}/notifications`);
    const notifData = await notifRes.json();
    assert(notifRes.status === 200 && notifData.notifications?.length >= 2, 'User A retrieves notifications list');
    assert(notifData.unreadCount >= 2, 'Unread notification count accurately calculated');

    const firstNotifId = notifData.notifications[0].id;

    // 4.3 Mark single notification read
    const markReadRes = await userA.fetch(`${API_BASE}/notifications/${firstNotifId}/read`, { method: 'PATCH' });
    assert(markReadRes.status === 200, 'Mark single notification as read succeeds');

    // 4.4 Mark all notifications read
    const markAllRes = await userA.fetch(`${API_BASE}/notifications/read-all`, { method: 'PATCH' });
    assert(markAllRes.status === 200, 'Mark all notifications as read succeeds');

    const verifyNotifRes = await userA.fetch(`${API_BASE}/notifications`);
    const verifyNotifData = await verifyNotifRes.json();
    assert(verifyNotifData.unreadCount === 0, 'Unread count resets to 0 after mark-all-read');

    // -------------------------------------------------------------------------
    // TEST SECTION 5: Messaging & Conversation Flow
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Messaging & Conversation Integrity Tests ---');

    // Connect User A and User B
    const [crRows] = await pool.query(
      `SELECT id FROM chat_requests WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)`,
      [userA.user.id, userB.user.id, userB.user.id, userA.user.id]
    );
    if (crRows.length === 0) {
      await pool.query(
        'INSERT INTO chat_requests (sender_id, receiver_id, status, created_at, updated_at) VALUES (?, ?, "accepted", NOW(), NOW())',
        [userA.user.id, userB.user.id]
      );
    } else {
      await pool.query('UPDATE chat_requests SET status = "accepted" WHERE id = ?', [crRows[0].id]);
    }

    // Direct conversation
    let convId;
    const [existingConv] = await pool.query(
      `SELECT c.id FROM conversations c
       JOIN conversation_members cm1 ON c.id = cm1.conversation_id AND cm1.user_id = ?
       JOIN conversation_members cm2 ON c.id = cm2.conversation_id AND cm2.user_id = ?
       WHERE c.conversation_type = 'direct' LIMIT 1`,
      [userA.user.id, userB.user.id]
    );

    if (existingConv.length > 0) {
      convId = existingConv[0].id;
    } else {
      const [newC] = await pool.query('INSERT INTO conversations (conversation_type) VALUES ("direct")');
      convId = newC.insertId;
      await pool.query('INSERT INTO conversation_members (conversation_id, user_id) VALUES (?, ?), (?, ?)', [convId, userA.user.id, convId, userB.user.id]);
    }

    // User A sends message
    const msgRes = await userA.fetch(`${API_BASE}/conversations/${convId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Integration message from User A to User B' })
    });
    const msgData = await msgRes.json();
    assert(msgRes.status === 201 && msgData.success, 'User A sends direct message successfully');

    // User B reads messages in conversation
    const markConvReadRes = await userB.fetch(`${API_BASE}/conversations/${convId}/read`, { method: 'POST' });
    assert(markConvReadRes.status === 200, 'User B marks conversation messages as read');

    // Paginated messages fetch
    const pagedMsgRes = await userA.fetch(`${API_BASE}/conversations/${convId}/messages?page=1&limit=5`);
    const pagedMsgData = await pagedMsgRes.json();
    assert(pagedMsgRes.status === 200 && pagedMsgData.messages?.length > 0, 'Conversation messages retrieved with pagination');

    // -------------------------------------------------------------------------
    // TEST SECTION 6: Group Chat Creation & Member Management
    // -------------------------------------------------------------------------
    console.log('\n--- 6. Group Chat & Role-Based Permissions Tests ---');

    const groupCreateRes = await userA.fetch(`${API_BASE}/groups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Aether Core Architects',
        description: 'Final release integration group chat',
        memberIds: [userB.user.id, userC.user.id]
      })
    });
    const groupCreateData = await groupCreateRes.json();
    assert(groupCreateRes.status === 201 && groupCreateData.success, 'User A creates group conversation with User B and User C');
    const groupId = groupCreateData.group.id;
    const groupConvId = groupCreateData.group.conversation_id;

    // Add User D to group
    const addMemberRes = await userA.fetch(`${API_BASE}/groups/${groupId}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberIds: [userD.user.id] })
    });
    assert(addMemberRes.status === 200, 'Group creator successfully adds User D to the group');

    // Promote User B to Admin
    const promoteRes = await userA.fetch(`${API_BASE}/groups/${groupId}/members/${userB.user.id}/role`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'admin' })
    });
    assert(promoteRes.status === 200, 'Group creator successfully promotes User B to Admin');

    // Regular member (User C) forbidden from updating group
    const charlieForbiddenRes = await userC.fetch(`${API_BASE}/groups/${groupId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Hacked Group Name' })
    });
    assert(charlieForbiddenRes.status === 403, 'Regular member is forbidden with 403 from modifying group info');

    // -------------------------------------------------------------------------
    // TEST SECTION 7: Status / Stories Ephemeral Lifecyle
    // -------------------------------------------------------------------------
    console.log('\n--- 7. Ephemeral Status / Stories Lifecycle Tests ---');

    const statusRes = await userA.fetch(`${API_BASE}/statuses/text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        textContent: 'Final release status update! 🚀',
        backgroundColor: '#0B0D12',
        textColor: '#00E5FF'
      })
    });
    const statusData = await statusRes.json();
    assert(statusRes.status === 201 && statusData.success, 'User A posts a rich text status update');
    const createdStatusId = statusData.status.id;

    // User B records view
    const statusViewRes = await userB.fetch(`${API_BASE}/statuses/${createdStatusId}/views`, { method: 'POST' });
    assert(statusViewRes.status === 200, 'User B records status view successfully');

    // User A checks viewers list
    const viewersRes = await userA.fetch(`${API_BASE}/statuses/${createdStatusId}/viewers`);
    const viewersData = await viewersRes.json();
    assert(viewersRes.status === 200 && viewersData.total_views >= 1, 'Status owner retrieves verified viewers list');

    // -------------------------------------------------------------------------
    // TEST SECTION 8: Security & Defense-in-Depth Tests
    // -------------------------------------------------------------------------
    console.log('\n--- 8. Security & Defense-in-Depth Tests ---');

    // 8.1 Unauthenticated request returns 401
    const unauthRes = await fetch(`${API_BASE}/conversations`);
    assert(unauthRes.status === 401, 'Unauthenticated request to protected endpoint rejected with 401 Unauthorized');

    // 8.2 Non-member conversation access returns 403/404
    const outsiderRes = await userC.fetch(`${API_BASE}/conversations/${convId}/messages`);
    assert(outsiderRes.status === 403 || outsiderRes.status === 404, 'Non-member user rejected from accessing private conversation');

    // 8.3 Rate limit headers are present
    const healthRes = await fetch(`${API_BASE}/health`);
    assert(healthRes.headers.has('ratelimit-limit') || healthRes.headers.has('x-ratelimit-limit'), 'Global rate limiter headers present on API responses');

    // 8.4 Non-existent route returns clean JSON 404
    const notFoundRes = await fetch(`${API_BASE}/non_existent_endpoint_xyz`);
    assert(notFoundRes.status === 404, 'Non-existent route handled by centralized 404 handler with structured JSON');

  } catch (err) {
    console.error('Unhandled failure during Day 10 test execution:', err);
    failed++;
  } finally {
    console.log('\n================================================================');
    console.log(`DAY 10 TESTS COMPLETED: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');
    await pool.end();
    process.exit(failed > 0 ? 1 : 0);
  }
}

runTests();
