/**
 * =============================================================================
 * DAY 5: ADVANCED MESSAGING, MEDIA SHARING & VOICE MESSAGES TEST SUITE
 * =============================================================================
 */

const path = require('path');
const fs = require('fs');
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

function emitWithAck(socket, event, data) {
  return new Promise((resolve) => {
    socket.emit(event, data, (response) => {
      resolve(response);
    });
  });
}

function waitForConnect(socket) {
  return new Promise((resolve) => {
    if (socket.connected) return resolve();
    socket.once('connect', resolve);
    setTimeout(resolve, 3000);
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
    // 1. Try register
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
      // 2. Verify OTP
      await fetch(`${API_BASE}/auth/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: this.email,
          otp: '123456'
        })
      });
    } catch (_) {}

    // 3. Login
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

    // Connect socket
    this.socket = ioClient('http://localhost:5000', {
      auth: { token: this.token },
      transports: ['websocket']
    });

    await new Promise((resolve) => {
      if (this.socket.connected) return resolve();
      this.socket.once('connect', resolve);
      setTimeout(resolve, 3000);
    });
  }

  async get(endpoint) {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      headers: {
        ...(this.cookie ? { Cookie: this.cookie } : {})
      }
    });
    const contentType = res.headers.get('content-type') || '';
    let data;
    if (contentType.includes('application/json')) {
      data = await res.json();
    } else {
      data = await res.text();
    }
    return { status: res.status, headers: res.headers, data };
  }

  async post(endpoint, body, isJson = true) {
    const headers = {};
    if (this.cookie) headers['Cookie'] = this.cookie;
    if (isJson) headers['Content-Type'] = 'application/json';

    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers,
      body: isJson ? JSON.stringify(body) : body
    });

    const contentType = res.headers.get('content-type') || '';
    let data;
    if (contentType.includes('application/json')) {
      data = await res.json();
    } else {
      data = await res.text();
    }
    return { status: res.status, headers: res.headers, data };
  }

  close() {
    if (this.socket) this.socket.disconnect();
  }
}

async function runDay5Tests() {
  console.log('\n================================================================');
  console.log('🧪 RUNNING DAY 5: ADVANCED MESSAGING & MEDIA SHARING TESTS');
  console.log('================================================================\n');

  let alice = new UserClient('alice_day5', 'alice_day5@test.com', 'Alice Day5');
  let bob = new UserClient('bob_day5', 'bob_day5@test.com', 'Bob Day5');
  let charlie = new UserClient('charlie_day5', 'charlie_day5@test.com', 'Charlie Day5');

  let convId = null;
  let targetConvId = null;
  let textMessageId = null;
  let imageMessageId = null;
  let imageAttachmentId = null;

  try {
    await alice.init();
    await bob.init();
    await charlie.init();

    // Ensure conversation exists between Alice and Bob
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

    // Ensure conversation exists between Alice and Charlie (for forwarding test)
    const [existingTargetConv] = await pool.query(
      `SELECT c.id FROM conversations c
       JOIN conversation_members cm1 ON c.id = cm1.conversation_id AND cm1.user_id = ?
       JOIN conversation_members cm2 ON c.id = cm2.conversation_id AND cm2.user_id = ?
       WHERE c.conversation_type = 'direct' LIMIT 1`,
      [alice.user.id, charlie.user.id]
    );

    if (existingTargetConv.length > 0) {
      targetConvId = existingTargetConv[0].id;
    } else {
      const [tcr] = await pool.query('INSERT INTO conversations (conversation_type) VALUES ("direct")');
      targetConvId = tcr.insertId;
      await pool.query('INSERT INTO conversation_members (conversation_id, user_id) VALUES (?, ?), (?, ?)', [
        targetConvId, alice.user.id, targetConvId, charlie.user.id
      ]);
    }

    await waitForConnect(alice.socket);
    await waitForConnect(bob.socket);
    await emitWithAck(alice.socket, 'join_conversation', { conversationId: convId });
    await emitWithAck(bob.socket, 'join_conversation', { conversationId: convId });

    // -------------------------------------------------------------------------
    // TEST 1: Send standard text message & reply to it
    // -------------------------------------------------------------------------
    const textRes = await alice.post(`/conversations/${convId}/messages`, {
      content: 'Hello Bob! This is message to reply to.'
    });
    textMessageId = textRes.data.message?.id;
    assert(textRes.status === 201 && textMessageId, 'TEST 1: Alice creates root text message');

    // -------------------------------------------------------------------------
    // TEST 2: Alice sends reply to text message
    // -------------------------------------------------------------------------
    const replyRes = await alice.post(`/conversations/${convId}/messages`, {
      content: 'This is a quoted reply!',
      replyToMessageId: textMessageId
    });
    assert(
      replyRes.status === 201 &&
      replyRes.data.message?.reply_to_message_id === textMessageId &&
      replyRes.data.message?.reply_to?.id === textMessageId &&
      replyRes.data.message?.reply_to?.sender_username === 'alice_day5',
      'TEST 2: Alice sends reply containing parent message preview'
    );

    // -------------------------------------------------------------------------
    // TEST 3: Create temporary test files for upload
    // -------------------------------------------------------------------------
    const tempDir = path.join(__dirname, 'temp_test_files');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    const dummyImagePath = path.join(tempDir, 'test_photo.png');
    const dummyDocPath = path.join(tempDir, 'test_report.pdf');
    const dummyAudioPath = path.join(tempDir, 'test_voice.webm');
    const dummyVideoPath = path.join(tempDir, 'test_clip.mp4');
    const blockedExePath = path.join(tempDir, 'malware.exe');

    fs.writeFileSync(dummyImagePath, Buffer.from('89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C4890000000A49444154789C63000100000500010D0A2DB40000000049454E44AE426082', 'hex'));
    fs.writeFileSync(dummyDocPath, Buffer.from('%PDF-1.4\n%EOF\n'));
    fs.writeFileSync(dummyAudioPath, Buffer.from('1A45DFA3934282886D6174726F736B61', 'hex'));
    fs.writeFileSync(dummyVideoPath, Buffer.from('00000018667479706D7034320000000069736F6D6D703432', 'hex'));
    fs.writeFileSync(blockedExePath, Buffer.from('MZ90000300000004000000FFFF0000', 'hex'));

    assert(fs.existsSync(dummyImagePath), 'TEST 3: Test fixture files generated successfully');

    // -------------------------------------------------------------------------
    // TEST 4: Upload Image Attachment
    // -------------------------------------------------------------------------
    const waitForBobImageMessage = new Promise((resolve) => {
      const handler = (msg) => {
        if (msg.message_type === 'image') {
          bob.socket.off('new_message', handler);
          resolve(msg);
        }
      };
      bob.socket.on('new_message', handler);
      setTimeout(() => resolve(null), 3000);
    });

    const imgForm = new FormData();
    const imgBlob = new Blob([fs.readFileSync(dummyImagePath)], { type: 'image/png' });
    imgForm.append('file', imgBlob, 'sunset.png');
    imgForm.append('caption', 'Check out this sunset!');

    const imgRes = await alice.post(`/conversations/${convId}/attachments`, imgForm, false);

    imageMessageId = imgRes.data.message?.id;
    imageAttachmentId = imgRes.data.message?.attachments?.[0]?.id;

    assert(
      imgRes.status === 201 &&
      imgRes.data.message?.message_type === 'image' &&
      imgRes.data.message?.attachments?.length === 1 &&
      imgRes.data.message?.attachments[0]?.attachment_type === 'image' &&
      imgRes.data.message?.attachments[0]?.original_filename === 'sunset.png',
      'TEST 4: Alice uploads image attachment with caption'
    );

    bobReceivedSocketMessage = await waitForBobImageMessage;
    assert(
      bobReceivedSocketMessage &&
      bobReceivedSocketMessage.id === imageMessageId &&
      bobReceivedSocketMessage.attachments?.[0]?.attachment_type === 'image',
      'TEST 5: Bob receives real-time Socket.IO new_message with image attachment'
    );

    // -------------------------------------------------------------------------
    // TEST 6: Upload Document Attachment (PDF)
    // -------------------------------------------------------------------------
    const docForm = new FormData();
    const docBlob = new Blob([fs.readFileSync(dummyDocPath)], { type: 'application/pdf' });
    docForm.append('file', docBlob, 'Project_Report.pdf');

    const docRes = await alice.post(`/conversations/${convId}/attachments`, docForm, false);

    assert(
      docRes.status === 201 &&
      docRes.data.message?.message_type === 'file' &&
      docRes.data.message?.attachments?.[0]?.attachment_type === 'document' &&
      docRes.data.message?.attachments?.[0]?.original_filename === 'Project_Report.pdf',
      'TEST 6: Alice uploads PDF document attachment'
    );

    // -------------------------------------------------------------------------
    // TEST 7: Upload Audio / Voice Message
    // -------------------------------------------------------------------------
    const audioForm = new FormData();
    const audioBlob = new Blob([fs.readFileSync(dummyAudioPath)], { type: 'audio/webm' });
    audioForm.append('file', audioBlob, 'voice_note.webm');
    audioForm.append('durationSeconds', '14');

    const audioRes = await alice.post(`/conversations/${convId}/attachments`, audioForm, false);

    assert(
      audioRes.status === 201 &&
      audioRes.data.message?.message_type === 'audio' &&
      audioRes.data.message?.attachments?.[0]?.attachment_type === 'audio' &&
      audioRes.data.message?.attachments?.[0]?.duration_seconds === 14,
      'TEST 7: Alice uploads voice message with duration metadata'
    );

    // -------------------------------------------------------------------------
    // TEST 8: Upload Video Message
    // -------------------------------------------------------------------------
    const videoForm = new FormData();
    const videoBlob = new Blob([fs.readFileSync(dummyVideoPath)], { type: 'video/mp4' });
    videoForm.append('file', videoBlob, 'product_demo.mp4');

    const videoRes = await alice.post(`/conversations/${convId}/attachments`, videoForm, false);

    assert(
      videoRes.status === 201 &&
      videoRes.data.message?.message_type === 'video' &&
      videoRes.data.message?.attachments?.[0]?.attachment_type === 'video',
      'TEST 8: Alice uploads video attachment'
    );

    // -------------------------------------------------------------------------
    // TEST 9: Reject Dangerous / Executable File Types (.exe)
    // -------------------------------------------------------------------------
    const exeForm = new FormData();
    const exeBlob = new Blob([fs.readFileSync(blockedExePath)], { type: 'application/x-msdownload' });
    exeForm.append('file', exeBlob, 'malware.exe');
    const exeRes = await alice.post(`/conversations/${convId}/attachments`, exeForm, false);

    assert(exeRes.status === 400, 'TEST 9: Dangerous executable (.exe) rejected with 400 Bad Request');

    // -------------------------------------------------------------------------
    // TEST 10: Non-member (Charlie) cannot upload to conversation
    // -------------------------------------------------------------------------
    const intruderForm = new FormData();
    const intruderBlob = new Blob([fs.readFileSync(dummyImagePath)], { type: 'image/png' });
    intruderForm.append('file', intruderBlob, 'intruder.png');
    const intruderRes = await charlie.post(`/conversations/${convId}/attachments`, intruderForm, false);

    assert(intruderRes.status === 403, 'TEST 10: Unauthorized user (Charlie) blocked from uploading (403)');

    // -------------------------------------------------------------------------
    // TEST 11: Authorized Member (Bob) can stream attachment file
    // -------------------------------------------------------------------------
    const streamRes = await bob.get(`/attachments/${imageAttachmentId}`);
    assert(
      streamRes.status === 200 && streamRes.headers.get('content-type').includes('image/png'),
      'TEST 11: Authorized member (Bob) streams attachment via GET /api/attachments/:id'
    );

    // -------------------------------------------------------------------------
    // TEST 12: Non-member (Charlie) cannot access attachment file (403)
    // -------------------------------------------------------------------------
    const charlieStreamRes = await charlie.get(`/attachments/${imageAttachmentId}`);
    assert(charlieStreamRes.status === 403, 'TEST 12: Non-member (Charlie) blocked from accessing attachment (403)');

    // -------------------------------------------------------------------------
    // TEST 13: Authorized Member can download attachment with original filename
    // -------------------------------------------------------------------------
    const downloadRes = await bob.get(`/attachments/${imageAttachmentId}/download`);
    const contentDisposition = downloadRes.headers.get('content-disposition') || '';
    assert(
      downloadRes.status === 200 && contentDisposition.includes('sunset.png'),
      'TEST 13: Authorized member downloads file with Content-Disposition original filename'
    );

    // -------------------------------------------------------------------------
    // TEST 14: Add Emoji Reaction to Message
    // -------------------------------------------------------------------------
    let reactionReceivedSocket = null;
    bob.socket.once('message_reaction_updated', (data) => {
      reactionReceivedSocket = data;
    });

    const reactRes1 = await alice.post(`/messages/${imageMessageId}/reactions`, {
      reaction: '🔥'
    });

    assert(
      reactRes1.status === 200 &&
      reactRes1.data.action === 'added' &&
      reactRes1.data.reactions?.some((r) => r.reaction === '🔥' && r.count === 1),
      'TEST 14: Alice adds "🔥" reaction to image message'
    );

    await new Promise((r) => setTimeout(r, 200));
    assert(
      reactionReceivedSocket &&
      reactionReceivedSocket.messageId === imageMessageId &&
      reactionReceivedSocket.reaction === '🔥' &&
      reactionReceivedSocket.action === 'added',
      'TEST 15: Bob receives real-time Socket.IO message_reaction_updated event'
    );

    // -------------------------------------------------------------------------
    // TEST 16: Bob adds another reaction (❤️) to same message
    // -------------------------------------------------------------------------
    const reactRes2 = await bob.post(`/messages/${imageMessageId}/reactions`, {
      reaction: '❤️'
    });
    assert(
      reactRes2.status === 200 &&
      reactRes2.data.reactions?.length === 2,
      'TEST 16: Bob adds second reaction "❤️" to the same message'
    );

    // -------------------------------------------------------------------------
    // TEST 17: Toggle Reaction (Alice clicks 🔥 again -> removes it)
    // -------------------------------------------------------------------------
    const toggleRes = await alice.post(`/messages/${imageMessageId}/reactions`, {
      reaction: '🔥'
    });
    assert(
      toggleRes.status === 200 &&
      toggleRes.data.action === 'removed' &&
      !toggleRes.data.reactions.some((r) => r.reaction === '🔥'),
      'TEST 17: Toggling same reaction cleanly removes it'
    );

    // -------------------------------------------------------------------------
    // TEST 18: Non-member cannot react to message (403)
    // -------------------------------------------------------------------------
    const charlieReactRes = await charlie.post(`/messages/${imageMessageId}/reactions`, {
      reaction: '👍'
    });
    assert(charlieReactRes.status === 403, 'TEST 18: Non-member blocked from reacting to message (403)');

    // -------------------------------------------------------------------------
    // TEST 19: Forward Message to Another Conversation
    // -------------------------------------------------------------------------
    const forwardRes = await alice.post(`/messages/${imageMessageId}/forward`, {
      targetConversationId: targetConvId
    });

    assert(
      forwardRes.status === 201 &&
      forwardRes.data.message?.conversation_id === targetConvId &&
      forwardRes.data.message?.forwarded_from_message_id === imageMessageId &&
      forwardRes.data.message?.is_forwarded === true &&
      forwardRes.data.message?.attachments?.length === 1 &&
      forwardRes.data.message?.attachments[0]?.original_filename === 'sunset.png',
      'TEST 19: Alice forwards image message to conversation with Charlie'
    );

    // -------------------------------------------------------------------------
    // TEST 20: Verified messages list includes attachments, reactions & quotes
    // -------------------------------------------------------------------------
    const listRes = await alice.get(`/conversations/${convId}/messages`);
    const fetchedImgMsg = listRes.data.messages?.find((m) => m.id === imageMessageId);
    const fetchedReplyMsg = listRes.data.messages?.find((m) => m.reply_to_message_id === textMessageId);

    assert(
      fetchedImgMsg &&
      fetchedImgMsg.attachments?.length === 1 &&
      fetchedImgMsg.reactions?.length >= 1,
      'TEST 20: GET /api/conversations/:id/messages hydrates attachments and reactions'
    );

    assert(
      fetchedReplyMsg &&
      fetchedReplyMsg.reply_to &&
      fetchedReplyMsg.reply_to.id === textMessageId &&
      fetchedReplyMsg.reply_to.message_content === 'Hello Bob! This is message to reply to.',
      'TEST 21: GET /api/conversations/:id/messages hydrates parent reply preview'
    );

    // Clean up temporary test files
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (_) {}

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

runDay5Tests();
