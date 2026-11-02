/**
 * =============================================================================
 * DAY 9: COMPLETE REAL-TIME STATUS / STORIES SYSTEM TEST SUITE
 * =============================================================================
 */

const path = require('path');
const fs = require('fs');
const { pool } = require('../config/database');
const statusService = require('../services/statusService');

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

// Helper to establish mutual contact between two users via accepted chat request and direct conversation
async function establishMutualContact(userA, userB) {
  // Check if already connected in DB
  const [existing] = await pool.query(
    `SELECT id, status FROM chat_requests 
     WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)`,
    [userA.user.id, userB.user.id, userB.user.id, userA.user.id]
  );

  if (existing.length > 0) {
    if (existing[0].status !== 'accepted') {
      await pool.query('UPDATE chat_requests SET status = "accepted" WHERE id = ?', [existing[0].id]);
    }
  } else {
    await pool.query(
      'INSERT INTO chat_requests (sender_id, receiver_id, status, created_at, updated_at) VALUES (?, ?, "accepted", NOW(), NOW())',
      [userA.user.id, userB.user.id]
    );
  }

  // Ensure direct conversation exists
  const [convRows] = await pool.query(
    `SELECT c.id FROM conversations c
     JOIN conversation_members cm1 ON c.id = cm1.conversation_id AND cm1.user_id = ?
     JOIN conversation_members cm2 ON c.id = cm2.conversation_id AND cm2.user_id = ?
     WHERE c.conversation_type = 'direct' LIMIT 1`,
    [userA.user.id, userB.user.id]
  );

  if (convRows.length === 0) {
    const [newConv] = await pool.query(
      'INSERT INTO conversations (conversation_type, created_at, updated_at) VALUES ("direct", NOW(), NOW())'
    );
    const convId = newConv.insertId;
    await pool.query(
      'INSERT INTO conversation_members (conversation_id, user_id, joined_at) VALUES (?, ?, NOW()), (?, ?, NOW())',
      [convId, userA.user.id, convId, userB.user.id]
    );
  }
}

async function runTests() {
  console.log('\n================================================================');
  console.log('🧪 RUNNING DAY 9: REAL-TIME STATUS / STORIES SYSTEM TESTS');
  console.log('================================================================\n');

  const alice = new UserClient('alice_day9', 'alice_day9@test.com', 'Alice StatusCreator');
  const bob = new UserClient('bob_day9', 'bob_day9@test.com', 'Bob StatusContact');
  const charlie = new UserClient('charlie_day9', 'charlie_day9@test.com', 'Charlie StatusViewer');
  const stranger = new UserClient('stranger_day9', 'stranger_day9@test.com', 'Stranger OutOfLoop');

  try {
    await alice.init();
    await bob.init();
    await charlie.init();
    await stranger.init();

    // Clean up any residual data for test users to ensure clean slate
    const testUserIds = [alice.user.id, bob.user.id, charlie.user.id, stranger.user.id];
    await pool.query('DELETE FROM status_views WHERE viewer_id IN (?) OR status_id IN (SELECT id FROM statuses WHERE user_id IN (?))', [testUserIds, testUserIds]);
    await pool.query('DELETE FROM status_reactions WHERE user_id IN (?) OR status_id IN (SELECT id FROM statuses WHERE user_id IN (?))', [testUserIds, testUserIds]);
    await pool.query('DELETE FROM status_mutes WHERE user_id IN (?)', [testUserIds]);
    await pool.query('DELETE FROM statuses WHERE user_id IN (?)', [testUserIds]);

    // Establish mutual contact: Alice <-> Bob, Alice <-> Charlie (stranger is NOT a contact)
    await establishMutualContact(alice, bob);
    await establishMutualContact(alice, charlie);

    let aliceStatusId = null;
    let aliceStatus2Id = null;

    // -------------------------------------------------------------------------
    // TEST SUITE 1: Text Status Creation & Validation
    // -------------------------------------------------------------------------
    console.log('\n--- 1. Text Status Creation & Validation Tests ---');

    // 1.1 Empty text rejection
    const emptyRes = await alice.fetch(`${API_BASE}/statuses/text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ textContent: '   ' })
    });
    assert(emptyRes.status === 400, 'Rejects empty text status with 400');

    // 1.2 Overlong text (> 1000 chars)
    const longText = 'A'.repeat(1001);
    const longRes = await alice.fetch(`${API_BASE}/statuses/text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ textContent: longText })
    });
    assert(longRes.status === 400, 'Rejects text status > 1000 characters with 400');

    // 1.3 Valid text status creation
    const createRes = await alice.fetch(`${API_BASE}/statuses/text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        textContent: 'Hello world from Day 9 Status stories! ✨',
        backgroundColor: '#1E3A8A',
        textColor: '#FFFFFF',
        fontSize: 'large',
        textAlignment: 'center'
      })
    });
    const createData = await createRes.json();
    assert(createRes.status === 201 && createData.success, 'Alice creates a rich text status update');
    assert(createData.status?.status_type === 'text', 'Status type is correctly marked as text');
    assert(createData.status?.background_color === '#1E3A8A', 'Custom background color preserved');
    assert(!!createData.status?.expires_at, 'Status contains 24-hour expiration timestamp');

    aliceStatusId = createData.status.id;

    // -------------------------------------------------------------------------
    // TEST SUITE 2: Media Status Creation (Image Upload)
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Media Status Creation Tests ---');

    // Create a temporary dummy image file
    const dummyImgPath = path.join(__dirname, 'dummy_status_test.png');
    fs.writeFileSync(dummyImgPath, Buffer.from('fake-png-status-content'));

    const formData = new FormData();
    const fileBytes = fs.readFileSync(dummyImgPath);
    const blob = new Blob([fileBytes], { type: 'image/png' });
    formData.append('file', blob, 'test_status.png');
    formData.append('caption', 'Exploring the sunset view! 🌅');

    const mediaRes = await alice.fetch(`${API_BASE}/statuses/media`, {
      method: 'POST',
      body: formData
    });
    const mediaData = await mediaRes.json();

    assert(mediaRes.status === 201 && mediaData.success, 'Alice uploads an image status with caption');
    assert(mediaData.status?.status_type === 'image', 'Status type is marked as image');
    assert(mediaData.status?.caption === 'Exploring the sunset view! 🌅', 'Caption is stored accurately');
    assert(mediaData.status?.media_url.includes('/uploads/statuses/'), 'Media URL points to status uploads directory');

    aliceStatus2Id = mediaData.status.id;

    // Clean up temporary local test file
    try { fs.unlinkSync(dummyImgPath); } catch (_) {}

    // -------------------------------------------------------------------------
    // TEST SUITE 3: Status Retrieval & Feed Grouping
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Status Retrieval & Feed Tests ---');

    // 3.1 Get own statuses
    const myRes = await alice.fetch(`${API_BASE}/statuses/me`);
    const myData = await myRes.json();
    assert(myRes.status === 200 && myData.statuses?.length >= 2, 'Alice retrieves her active statuses (at least 2)');

    // 3.2 Bob gets status feed (Alice should be in 'recent' updates since Bob hasn't viewed yet)
    const bobFeedRes = await bob.fetch(`${API_BASE}/statuses/feed`);
    const bobFeedData = await bobFeedRes.json();
    assert(bobFeedRes.status === 200, 'Bob retrieves his status feed');

    const aliceInRecent = (bobFeedData.feed?.recent || []).find((u) => u.id === alice.user.id);
    assert(!!aliceInRecent, 'Alice appears in Bob\'s Recent Updates group');
    assert(aliceInRecent?.statuses?.length >= 2, 'Alice has multiple active statuses in Bob\'s feed');

    // 3.3 Stranger gets status feed (Stranger is NOT a contact, so Alice should NOT appear)
    const strangerFeedRes = await stranger.fetch(`${API_BASE}/statuses/feed`);
    const strangerFeedData = await strangerFeedRes.json();
    const aliceInStranger = (strangerFeedData.feed?.recent || []).find((u) => u.id === alice.user.id);
    assert(!aliceInStranger, 'Non-contact stranger cannot see Alice in status feed');

    // -------------------------------------------------------------------------
    // TEST SUITE 4: Status View Recording & Viewer List Authorization
    // -------------------------------------------------------------------------
    console.log('\n--- 4. View Tracking & Viewer List Security Tests ---');

    // 4.1 Bob records a view on Alice's text status
    const viewRes = await bob.fetch(`${API_BASE}/statuses/${aliceStatusId}/views`, { method: 'POST' });
    const viewData = await viewRes.json();
    assert(viewRes.status === 200 && viewData.success, 'Bob records a view on Alice\'s status');

    // 4.2 Duplicate view recording is idempotent
    const dupViewRes = await bob.fetch(`${API_BASE}/statuses/${aliceStatusId}/views`, { method: 'POST' });
    const dupViewData = await dupViewRes.json();
    assert(dupViewRes.status === 200 && dupViewData.alreadyViewed === true, 'Duplicate status view is deduplicated');

    // 4.3 Bob also views Alice's second status -> Alice moves to 'viewed' in Bob's feed
    await bob.fetch(`${API_BASE}/statuses/${aliceStatus2Id}/views`, { method: 'POST' });
    const bobFeedAfterView = await (await bob.fetch(`${API_BASE}/statuses/feed`)).json();
    const aliceInViewed = (bobFeedAfterView.feed?.viewed || []).find((u) => u.id === alice.user.id);
    assert(!!aliceInViewed, 'Alice moves to Viewed Updates group once all statuses are viewed');

    // 4.4 Viewer list access: Alice (owner) gets viewer list
    const viewersRes = await alice.fetch(`${API_BASE}/statuses/${aliceStatusId}/viewers`);
    const viewersData = await viewersRes.json();
    assert(viewersRes.status === 200 && viewersData.success, 'Alice retrieves viewer list for her status');
    assert(viewersData.viewers?.some((v) => v.viewer_id === bob.user.id), 'Bob is recorded in Alice\'s viewer list with timestamp');

    // 4.5 Viewer list security: Bob (non-owner) attempting to view Alice's viewers -> 403 Forbidden
    const bobForbiddenRes = await bob.fetch(`${API_BASE}/statuses/${aliceStatusId}/viewers`);
    assert(bobForbiddenRes.status === 403, 'Non-owner is rejected with 403 Forbidden when requesting viewer list');

    // -------------------------------------------------------------------------
    // TEST SUITE 5: Emoji Reactions
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Emoji Reactions Tests ---');

    // 5.1 Invalid emoji rejected
    const invalidEmojiRes = await bob.fetch(`${API_BASE}/statuses/${aliceStatusId}/reactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emoji: '💩' })
    });
    assert(invalidEmojiRes.status === 400, 'Rejects disallowed emoji with 400 Bad Request');

    // 5.2 Valid reaction added
    const reactRes = await bob.fetch(`${API_BASE}/statuses/${aliceStatusId}/reactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emoji: '🔥' })
    });
    const reactData = await reactRes.json();
    assert(reactRes.status === 200 && reactData.action === 'added', 'Bob reacts to Alice\'s status with 🔥');

    // 5.3 Toggle removes same reaction
    const toggleReactRes = await bob.fetch(`${API_BASE}/statuses/${aliceStatusId}/reactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emoji: '🔥' })
    });
    const toggleReactData = await toggleReactRes.json();
    assert(toggleReactRes.status === 200 && toggleReactData.action === 'removed', 'Toggling same emoji removes the reaction');

    // -------------------------------------------------------------------------
    // TEST SUITE 6: Status Reply Routing to One-to-One Chat
    // -------------------------------------------------------------------------
    console.log('\n--- 6. Status Reply Integration Tests ---');

    const replyRes = await bob.fetch(`${API_BASE}/statuses/${aliceStatusId}/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'This status looks awesome Alice!' })
    });
    const replyData = await replyRes.json();
    assert(replyRes.status === 201 && replyData.success, 'Bob sends a status reply to Alice');
    assert(!!replyData.message?.conversation_id, 'Status reply generated a message in direct conversation');
    assert(replyData.message?.sender_id === bob.user.id, 'Message sender is correctly set to Bob');

    // Verify direct conversation in MySQL
    const [msgRows] = await pool.query(
      'SELECT id, message_content FROM messages WHERE conversation_id = ? AND sender_id = ? ORDER BY id DESC LIMIT 1',
      [replyData.message.conversation_id, bob.user.id]
    );
    assert(msgRows.length > 0 && msgRows[0].message_content.includes('This status looks awesome Alice!'), 'Reply is stored in database messages table');

    // -------------------------------------------------------------------------
    // TEST SUITE 7: Status Privacy Controls
    // -------------------------------------------------------------------------
    console.log('\n--- 7. Status Privacy Controls & Enforcement Tests ---');

    // 7.1 Alice updates status privacy to 'only_share_with' [Bob]
    const privUpdateRes = await alice.fetch(`${API_BASE}/statuses/privacy`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        privacyType: 'only_share_with',
        allowedUserIds: [bob.user.id]
      })
    });
    const privUpdateData = await privUpdateRes.json();
    assert(privUpdateRes.status === 200 && privUpdateData.success, 'Alice sets privacy to "only_share_with" Bob');

    // Alice creates a private status
    const privStatusRes = await alice.fetch(`${API_BASE}/statuses/text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ textContent: 'Exclusive status for Bob only! 🤫' })
    });
    const privStatusData = await privStatusRes.json();
    const privStatusId = privStatusData.status.id;

    // Bob can view it
    const bobAccessRes = await bob.fetch(`${API_BASE}/statuses/${privStatusId}`);
    assert(bobAccessRes.status === 200, 'Allowed contact (Bob) can access "only_share_with" status');

    // Charlie (contact but not in allowedUserIds) cannot view it
    const charlieAccessRes = await charlie.fetch(`${API_BASE}/statuses/${privStatusId}`);
    assert(charlieAccessRes.status === 403, 'Excluded contact (Charlie) receives 403 Forbidden on "only_share_with" status');

    // 7.2 Alice updates status privacy to 'contacts_except' [Bob]
    await alice.fetch(`${API_BASE}/statuses/privacy`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        privacyType: 'contacts_except',
        excludedUserIds: [bob.user.id]
      })
    });

    // Alice creates another status
    const exceptStatusRes = await alice.fetch(`${API_BASE}/statuses/text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ textContent: 'Status for everyone except Bob! 👀' })
    });
    const exceptStatusData = await exceptStatusRes.json();
    const exceptStatusId = exceptStatusData.status.id;

    // Charlie can access it
    const charlieExceptAccess = await charlie.fetch(`${API_BASE}/statuses/${exceptStatusId}`);
    assert(charlieExceptAccess.status === 200, 'Unexcluded contact (Charlie) can access "contacts_except" status');

    // Bob is excluded -> 403
    const bobExceptAccess = await bob.fetch(`${API_BASE}/statuses/${exceptStatusId}`);
    assert(bobExceptAccess.status === 403, 'Excluded contact (Bob) receives 403 Forbidden on "contacts_except" status');

    // Reset Alice's privacy to 'contacts'
    await alice.fetch(`${API_BASE}/statuses/privacy`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ privacyType: 'contacts', excludedUserIds: [], allowedUserIds: [] })
    });

    // -------------------------------------------------------------------------
    // TEST SUITE 8: Muting & Unmuting User Statuses
    // -------------------------------------------------------------------------
    console.log('\n--- 8. Muting & Unmuting Tests ---');

    // Bob mutes Alice
    const muteRes = await bob.fetch(`${API_BASE}/statuses/mute/${alice.user.id}`, { method: 'POST' });
    const muteData = await muteRes.json();
    assert(muteRes.status === 200 && muteData.isMuted === true, 'Bob mutes Alice\'s status updates');

    // Check Bob's feed -> Alice is in 'muted'
    const bobMutedFeed = await (await bob.fetch(`${API_BASE}/statuses/feed`)).json();
    const aliceInMuted = (bobMutedFeed.feed?.muted || []).find((u) => u.id === alice.user.id);
    assert(!!aliceInMuted, 'Alice is now grouped under "muted" in Bob\'s feed');

    // Bob unmutes Alice
    const unmuteRes = await bob.fetch(`${API_BASE}/statuses/mute/${alice.user.id}`, { method: 'POST' });
    const unmuteData = await unmuteRes.json();
    assert(unmuteRes.status === 200 && unmuteData.isMuted === false, 'Bob unmutes Alice\'s status updates');

    // -------------------------------------------------------------------------
    // TEST SUITE 9: Status Deletion & Expiration Cleanup
    // -------------------------------------------------------------------------
    console.log('\n--- 9. Status Deletion & Expiration Tests ---');

    // 9.1 Non-owner cannot delete Alice's status
    const nonOwnerDel = await bob.fetch(`${API_BASE}/statuses/${aliceStatusId}`, { method: 'DELETE' });
    assert(nonOwnerDel.status === 403, 'Non-owner rejected with 403 when trying to delete another user\'s status');

    // 9.2 Owner deletes status
    const ownerDel = await alice.fetch(`${API_BASE}/statuses/${aliceStatusId}`, { method: 'DELETE' });
    assert(ownerDel.status === 200, 'Owner can delete their own status update');

    // Verify soft deleted in MySQL
    const [delRows] = await pool.query('SELECT deleted_at FROM statuses WHERE id = ?', [aliceStatusId]);
    assert(delRows.length > 0 && delRows[0].deleted_at !== null, 'Status is marked soft deleted in database');

    // 9.3 Background expiration cleanup function
    // Insert a dummy expired status
    const [expInsert] = await pool.query(
      `INSERT INTO statuses (user_id, status_type, text_content, created_at, expires_at)
       VALUES (?, 'text', 'Expired status', DATE_SUB(NOW(), INTERVAL 25 HOUR), DATE_SUB(NOW(), INTERVAL 1 HOUR))`,
      [alice.user.id]
    );
    const expiredId = expInsert.insertId;

    const cleanedCount = await statusService.cleanupExpiredStatuses();
    assert(cleanedCount >= 1, 'cleanupExpiredStatuses removes statuses that have passed 24-hour expiration');

    const [expCheck] = await pool.query('SELECT id, deleted_at FROM statuses WHERE id = ?', [expiredId]);
    assert(expCheck[0].deleted_at !== null, 'Expired status was soft deleted during cleanup run');

  } catch (err) {
    console.error('Unhandled test failure:', err);
    failed++;
  } finally {
    console.log('\n================================================================');
    console.log(`DAY 9 TESTS COMPLETED: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');
    await pool.end();
    process.exit(failed > 0 ? 1 : 0);
  }
}

runTests();
