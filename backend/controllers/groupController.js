const { pool } = require('../config/database');
const { getIO, emitToUser, emitToConversation, isUserOnline } = require('../config/socket');

/**
 * 1. Create a New Group Conversation
 * POST /api/groups
 */
const createGroup = async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const creatorId = req.user.id;
    const { name, description = '', memberIds = [], profileImage = null } = req.body;

    // 1. Validation
    if (!name || typeof name !== 'string' || name.trim().length < 3 || name.trim().length > 150) {
      return res.status(400).json({
        success: false,
        message: 'Group name must be between 3 and 150 characters'
      });
    }

    if (!Array.isArray(memberIds)) {
      return res.status(400).json({
        success: false,
        message: 'memberIds must be an array of user IDs'
      });
    }

    // Deduplicate and filter out creator if accidentally included in memberIds
    const uniqueMemberIds = [...new Set(memberIds.map((id) => parseInt(id, 10)).filter((id) => !isNaN(id) && id !== creatorId))];

    // Rule: Must contain at least two members, excluding the creator
    if (uniqueMemberIds.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'A group must contain at least two members, excluding the creator'
      });
    }

    // Verify all members exist in the database
    const [existingUsers] = await connection.query(
      'SELECT id, username, full_name, email FROM users WHERE id IN (?) AND account_status = "active"',
      [uniqueMemberIds]
    );

    if (existingUsers.length !== uniqueMemberIds.length) {
      return res.status(400).json({
        success: false,
        message: 'One or more selected members do not exist or are inactive'
      });
    }

    await connection.beginTransaction();

    // 2. Create entry in conversations table
    const [convResult] = await connection.query(
      'INSERT INTO conversations (conversation_type, created_at, updated_at) VALUES ("group", NOW(), NOW())'
    );
    const conversationId = convResult.insertId;

    // 3. Create entry in groups table
    const [groupResult] = await connection.query(
      `INSERT INTO \`groups\` (conversation_id, name, description, profile_image, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
      [conversationId, name.trim(), description ? description.trim() : null, profileImage || null, creatorId]
    );
    const groupId = groupResult.insertId;

    // 4. Add Creator to conversation_members and group_members
    await connection.query(
      `INSERT INTO conversation_members (conversation_id, user_id, role, status, joined_at)
       VALUES (?, ?, 'creator', 'active', NOW())`,
      [conversationId, creatorId]
    );

    await connection.query(
      `INSERT INTO group_members (group_id, conversation_id, user_id, role, status, joined_at)
       VALUES (?, ?, ?, 'creator', 'active', NOW())`,
      [groupId, conversationId, creatorId]
    );

    // 5. Add Members to conversation_members and group_members
    for (const memberId of uniqueMemberIds) {
      await connection.query(
        `INSERT INTO conversation_members (conversation_id, user_id, role, status, joined_at)
         VALUES (?, ?, 'member', 'active', NOW())`,
        [conversationId, memberId]
      );

      await connection.query(
        `INSERT INTO group_members (group_id, conversation_id, user_id, role, status, joined_at)
         VALUES (?, ?, ?, 'member', 'active', NOW())`,
        [groupId, conversationId, memberId]
      );
    }

    // 6. Create initial system message in the group
    const initialSystemContent = `${req.user.full_name || req.user.username} created the group "${name.trim()}"`;
    const [msgResult] = await connection.query(
      `INSERT INTO messages (conversation_id, sender_id, message_type, message_content, created_at, updated_at)
       VALUES (?, ?, 'system', ?, NOW(), NOW())`,
      [conversationId, creatorId, initialSystemContent]
    );
    const systemMessageId = msgResult.insertId;

    // 7. Create delivery receipts for all members
    const allMemberIds = [creatorId, ...uniqueMemberIds];
    for (const mId of allMemberIds) {
      await connection.query(
        `INSERT INTO message_receipts (message_id, user_id, delivered_at)
         VALUES (?, ?, NOW())`,
        [systemMessageId, mId]
      );
    }

    await connection.commit();

    // 8. Fetch complete group details to return
    const [membersData] = await pool.query(
      `SELECT gm.user_id, gm.role, gm.status, gm.joined_at,
              u.username, u.full_name, p.profile_picture, p.is_online, p.last_seen
       FROM group_members gm
       JOIN users u ON gm.user_id = u.id
       JOIN user_profiles p ON u.id = p.user_id
       WHERE gm.group_id = ? AND gm.status = 'active'`,
      [groupId]
    );

    const groupPayload = {
      id: groupId,
      conversation_id: conversationId,
      name: name.trim(),
      description: description ? description.trim() : null,
      profile_image: profileImage || null,
      created_by: creatorId,
      created_at: new Date(),
      updated_at: new Date(),
      members_count: allMemberIds.length,
      members: membersData.map((m) => ({
        id: m.user_id,
        user_id: m.user_id,
        username: m.username,
        full_name: m.full_name,
        profile_picture: m.profile_picture,
        role: m.role,
        is_online: Boolean(m.is_online) || isUserOnline(m.user_id),
        last_seen: m.last_seen
      }))
    };

    // 9. Real-time Socket.IO notification to all members
    const systemMessagePayload = {
      id: systemMessageId,
      conversation_id: conversationId,
      sender_id: creatorId,
      sender: {
        id: creatorId,
        username: req.user.username,
        full_name: req.user.full_name,
        profile_picture: req.user.profile_picture
      },
      message_type: 'system',
      message_content: initialSystemContent,
      created_at: new Date(),
      status: 'delivered'
    };

    for (const mId of allMemberIds) {
      emitToUser(mId, 'new_group', {
        group: groupPayload,
        conversationId
      });
      emitToUser(mId, 'new_message', systemMessagePayload);
      emitToUser(mId, 'conversation_updated', {
        conversationId,
        lastMessage: systemMessagePayload
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Group created successfully',
      group: groupPayload,
      conversationId
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
};

/**
 * 2. Get User Groups
 * GET /api/groups
 */
const getUserGroups = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const [rows] = await pool.query(
      `SELECT g.id, g.conversation_id, g.name, g.description, g.profile_image, g.created_by,
              g.created_at, g.updated_at, gm.role as my_role,
              (SELECT COUNT(*) FROM group_members WHERE group_id = g.id AND status = 'active') as members_count
       FROM \`groups\` g
       JOIN group_members gm ON g.id = gm.group_id
       WHERE gm.user_id = ? AND gm.status = 'active'
       ORDER BY g.updated_at DESC`,
      [userId]
    );

    return res.status(200).json({
      success: true,
      groups: rows
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 3. Get Group Details by Group ID or Conversation ID
 * GET /api/groups/:id
 */
const getGroupDetails = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const identifier = parseInt(req.params.id, 10);

    // Search by group id or conversation_id
    const [groupRows] = await pool.query(
      `SELECT g.id, g.conversation_id, g.name, g.description, g.profile_image, g.created_by,
              g.created_at, g.updated_at,
              u.username as creator_username, u.full_name as creator_full_name
       FROM \`groups\` g
       JOIN users u ON g.created_by = u.id
       WHERE g.id = ? OR g.conversation_id = ?
       LIMIT 1`,
      [identifier, identifier]
    );

    if (groupRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }

    const group = groupRows[0];

    // Verify user is an active member
    const [membership] = await pool.query(
      `SELECT role, status FROM group_members WHERE group_id = ? AND user_id = ?`,
      [group.id, userId]
    );

    if (membership.length === 0 || membership[0].status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'You are not a member of this group'
      });
    }

    const myRole = membership[0].role;

    // Fetch all active members
    const [members] = await pool.query(
      `SELECT gm.user_id, gm.role, gm.joined_at,
              u.username, u.full_name, u.email,
              p.profile_picture, p.is_online, p.last_seen, p.bio
       FROM group_members gm
       JOIN users u ON gm.user_id = u.id
       JOIN user_profiles p ON u.id = p.user_id
       WHERE gm.group_id = ? AND gm.status = 'active'
       ORDER BY FIELD(gm.role, 'creator', 'admin', 'member'), u.full_name ASC`,
      [group.id]
    );

    const formattedMembers = members.map((m) => ({
      id: m.user_id,
      user_id: m.user_id,
      username: m.username,
      full_name: m.full_name,
      profile_picture: m.profile_picture,
      bio: m.bio,
      role: m.role,
      joined_at: m.joined_at,
      is_online: Boolean(m.is_online) || isUserOnline(m.user_id),
      last_seen: m.last_seen
    }));

    const onlineCount = formattedMembers.filter((m) => m.is_online).length;

    return res.status(200).json({
      success: true,
      group: {
        ...group,
        my_role: myRole,
        members_count: formattedMembers.length,
        online_count: onlineCount,
        members: formattedMembers
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 4. Update Group Information (Name, Description, Profile Image)
 * PATCH /api/groups/:id
 */
const updateGroup = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const identifier = parseInt(req.params.id, 10);
    const { name, description, profileImage } = req.body;

    const [groupRows] = await pool.query(
      `SELECT id, conversation_id, name, description, profile_image, created_by 
       FROM \`groups\` WHERE id = ? OR conversation_id = ? LIMIT 1`,
      [identifier, identifier]
    );

    if (groupRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }

    const group = groupRows[0];

    // Authorization check: Admin or Creator only
    const [membership] = await pool.query(
      `SELECT role FROM group_members WHERE group_id = ? AND user_id = ? AND status = 'active'`,
      [group.id, userId]
    );

    if (membership.length === 0 || !['creator', 'admin'].includes(membership[0].role)) {
      return res.status(403).json({
        success: false,
        message: 'Only group admins and the creator can update group information'
      });
    }

    const updates = [];
    const params = [];

    if (name !== undefined) {
      if (!name || name.trim().length < 3 || name.trim().length > 150) {
        return res.status(400).json({
          success: false,
          message: 'Group name must be between 3 and 150 characters'
        });
      }
      updates.push('name = ?');
      params.push(name.trim());
    }

    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description ? description.trim() : null);
    }

    if (profileImage !== undefined) {
      updates.push('profile_image = ?');
      params.push(profileImage || null);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields provided for update'
      });
    }

    params.push(group.id);
    await pool.query(
      `UPDATE \`groups\` SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
      params
    );

    // Create system message
    let changeText = `${req.user.full_name || req.user.username} updated group information`;
    if (name && name.trim() !== group.name) {
      changeText = `${req.user.full_name || req.user.username} changed the group name to "${name.trim()}"`;
    }

    const [msgRes] = await pool.query(
      `INSERT INTO messages (conversation_id, sender_id, message_type, message_content, created_at, updated_at)
       VALUES (?, ?, 'system', ?, NOW(), NOW())`,
      [group.conversation_id, userId, changeText]
    );

    const updatedGroup = {
      ...group,
      name: name !== undefined ? name.trim() : group.name,
      description: description !== undefined ? (description ? description.trim() : null) : group.description,
      profile_image: profileImage !== undefined ? profileImage : group.profile_image
    };

    // Real-time broadcast
    emitToConversation(group.conversation_id, 'group_updated', {
      group: updatedGroup,
      conversationId: group.conversation_id,
      updatedBy: req.user.id
    });

    emitToConversation(group.conversation_id, 'new_message', {
      id: msgRes.insertId,
      conversation_id: group.conversation_id,
      sender_id: userId,
      sender: {
        id: userId,
        username: req.user.username,
        full_name: req.user.full_name,
        profile_picture: req.user.profile_picture
      },
      message_type: 'system',
      message_content: changeText,
      created_at: new Date(),
      status: 'delivered'
    });

    return res.status(200).json({
      success: true,
      message: 'Group updated successfully',
      group: updatedGroup
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 5. Add Members to Group
 * POST /api/groups/:id/members
 */
const addGroupMembers = async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const userId = req.user.id;
    const identifier = parseInt(req.params.id, 10);
    const { memberIds } = req.body;

    if (!Array.isArray(memberIds) || memberIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'memberIds array is required'
      });
    }

    const [groupRows] = await connection.query(
      `SELECT id, conversation_id, name, created_by FROM \`groups\` WHERE id = ? OR conversation_id = ? LIMIT 1`,
      [identifier, identifier]
    );

    if (groupRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }

    const group = groupRows[0];

    // Authorization: Admin or Creator only
    const [membership] = await connection.query(
      `SELECT role FROM group_members WHERE group_id = ? AND user_id = ? AND status = 'active'`,
      [group.id, userId]
    );

    if (membership.length === 0 || !['creator', 'admin'].includes(membership[0].role)) {
      return res.status(403).json({
        success: false,
        message: 'Only admins or the group creator can add members'
      });
    }

    // Filter out users who are already active members
    const [existingMembers] = await connection.query(
      `SELECT user_id FROM group_members WHERE group_id = ? AND status = 'active'`,
      [group.id]
    );
    const activeMemberIds = new Set(existingMembers.map((m) => m.user_id));

    const newMemberIds = [...new Set(memberIds.map((id) => parseInt(id, 10)).filter((id) => !isNaN(id) && !activeMemberIds.has(id)))];

    if (newMemberIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Selected users are already active members of this group'
      });
    }

    // Verify users exist
    const [validUsers] = await connection.query(
      `SELECT u.id, u.username, u.full_name, p.profile_picture FROM users u 
       JOIN user_profiles p ON u.id = p.user_id 
       WHERE u.id IN (?) AND u.account_status = 'active'`,
      [newMemberIds]
    );

    if (validUsers.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid active users found to add'
      });
    }

    await connection.beginTransaction();

    const addedUserNames = [];

    for (const u of validUsers) {
      // Upsert into conversation_members
      await connection.query(
        `INSERT INTO conversation_members (conversation_id, user_id, role, status, joined_at)
         VALUES (?, ?, 'member', 'active', NOW())
         ON DUPLICATE KEY UPDATE status = 'active', role = 'member', joined_at = NOW()`,
        [group.conversation_id, u.id]
      );

      // Upsert into group_members
      await connection.query(
        `INSERT INTO group_members (group_id, conversation_id, user_id, role, status, joined_at)
         VALUES (?, ?, ?, 'member', 'active', NOW())
         ON DUPLICATE KEY UPDATE status = 'active', role = 'member', joined_at = NOW()`,
        [group.id, group.conversation_id, u.id]
      );

      addedUserNames.push(u.full_name || u.username);
    }

    // System message
    const systemMsg = `${req.user.full_name || req.user.username} added ${addedUserNames.join(', ')} to the group`;
    const [msgRes] = await connection.query(
      `INSERT INTO messages (conversation_id, sender_id, message_type, message_content, created_at, updated_at)
       VALUES (?, ?, 'system', ?, NOW(), NOW())`,
      [group.conversation_id, userId, systemMsg]
    );

    await connection.commit();

    const formattedMessage = {
      id: msgRes.insertId,
      conversation_id: group.conversation_id,
      sender_id: userId,
      sender: {
        id: userId,
        username: req.user.username,
        full_name: req.user.full_name,
        profile_picture: req.user.profile_picture
      },
      message_type: 'system',
      message_content: systemMsg,
      created_at: new Date(),
      status: 'delivered'
    };

    // Notify all conversation members
    emitToConversation(group.conversation_id, 'group_member_added', {
      groupId: group.id,
      conversationId: group.conversation_id,
      addedMembers: validUsers,
      addedBy: req.user.id
    });

    emitToConversation(group.conversation_id, 'new_message', formattedMessage);

    for (const u of validUsers) {
      emitToUser(u.id, 'new_group', {
        group: { id: group.id, conversation_id: group.conversation_id, name: group.name },
        conversationId: group.conversation_id
      });
    }

    // Centralized notification for added members
    try {
      const { sendNotification } = require('../services/notificationService');
      for (const u of validUsers) {
        sendNotification({
          userId: u.id,
          type: 'group',
          title: 'Added to Group',
          description: `${req.user.full_name || req.user.username} added you to "${group.name}"`,
          referenceId: group.id
        }).catch(() => {});
      }
    } catch (_) {}

    return res.status(200).json({
      success: true,
      message: `Added ${validUsers.length} member(s) successfully`,
      addedMembers: validUsers
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
};

/**
 * 6. Remove a Member from Group
 * DELETE /api/groups/:id/members/:userId
 */
const removeGroupMember = async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const currentUserId = req.user.id;
    const identifier = parseInt(req.params.id, 10);
    const targetUserId = parseInt(req.params.userId, 10);

    const [groupRows] = await connection.query(
      `SELECT id, conversation_id, name, created_by FROM \`groups\` WHERE id = ? OR conversation_id = ? LIMIT 1`,
      [identifier, identifier]
    );

    if (groupRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }

    const group = groupRows[0];

    // Check acting user role
    const [actingMembership] = await connection.query(
      `SELECT role FROM group_members WHERE group_id = ? AND user_id = ? AND status = 'active'`,
      [group.id, currentUserId]
    );

    if (actingMembership.length === 0) {
      return res.status(403).json({ success: false, message: 'You are not a member of this group' });
    }

    const actingRole = actingMembership[0].role;
    if (!['creator', 'admin'].includes(actingRole)) {
      return res.status(403).json({ success: false, message: 'Only admins or the creator can remove members' });
    }

    // Check target user role
    const [targetMembership] = await connection.query(
      `SELECT role FROM group_members WHERE group_id = ? AND user_id = ? AND status = 'active'`,
      [group.id, targetUserId]
    );

    if (targetMembership.length === 0) {
      return res.status(404).json({ success: false, message: 'Target user is not an active member' });
    }

    const targetRole = targetMembership[0].role;

    // Creator cannot be removed
    if (targetRole === 'creator') {
      return res.status(403).json({ success: false, message: 'The group creator cannot be removed' });
    }

    // Admins cannot remove other admins (only creator can)
    if (actingRole === 'admin' && targetRole === 'admin') {
      return res.status(403).json({ success: false, message: 'Only the group creator can remove another admin' });
    }

    await connection.beginTransaction();

    // Mark as removed
    await connection.query(
      `UPDATE conversation_members SET status = 'removed' WHERE conversation_id = ? AND user_id = ?`,
      [group.conversation_id, targetUserId]
    );

    await connection.query(
      `UPDATE group_members SET status = 'removed' WHERE group_id = ? AND user_id = ?`,
      [group.id, targetUserId]
    );

    // Target user profile
    const [targetUser] = await connection.query(
      'SELECT username, full_name FROM users WHERE id = ?',
      [targetUserId]
    );
    const targetName = targetUser[0]?.full_name || targetUser[0]?.username || 'A member';

    const systemMsg = `${req.user.full_name || req.user.username} removed ${targetName} from the group`;
    const [msgRes] = await connection.query(
      `INSERT INTO messages (conversation_id, sender_id, message_type, message_content, created_at, updated_at)
       VALUES (?, ?, 'system', ?, NOW(), NOW())`,
      [group.conversation_id, currentUserId, systemMsg]
    );

    await connection.commit();

    const formattedMessage = {
      id: msgRes.insertId,
      conversation_id: group.conversation_id,
      sender_id: currentUserId,
      message_type: 'system',
      message_content: systemMsg,
      created_at: new Date(),
      status: 'delivered'
    };

    emitToConversation(group.conversation_id, 'group_member_removed', {
      groupId: group.id,
      conversationId: group.conversation_id,
      removedUserId: targetUserId,
      removedBy: currentUserId
    });

    emitToConversation(group.conversation_id, 'new_message', formattedMessage);
    emitToUser(targetUserId, 'group_removed_self', {
      groupId: group.id,
      conversationId: group.conversation_id
    });

    return res.status(200).json({
      success: true,
      message: `${targetName} was removed from the group`
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
};

/**
 * 7. Leave Group
 * POST /api/groups/:id/leave
 */
const leaveGroup = async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const userId = req.user.id;
    const identifier = parseInt(req.params.id, 10);

    const [groupRows] = await connection.query(
      `SELECT id, conversation_id, name, created_by FROM \`groups\` WHERE id = ? OR conversation_id = ? LIMIT 1`,
      [identifier, identifier]
    );

    if (groupRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }

    const group = groupRows[0];

    const [membership] = await connection.query(
      `SELECT role, status FROM group_members WHERE group_id = ? AND user_id = ? AND status = 'active'`,
      [group.id, userId]
    );

    if (membership.length === 0) {
      return res.status(400).json({ success: false, message: 'You are not an active member of this group' });
    }

    const currentRole = membership[0].role;

    await connection.beginTransaction();

    // If Creator is leaving: automatically reassign ownership to an admin or oldest member
    if (currentRole === 'creator') {
      const [candidates] = await connection.query(
        `SELECT user_id, role FROM group_members 
         WHERE group_id = ? AND user_id != ? AND status = 'active'
         ORDER BY FIELD(role, 'admin', 'member'), joined_at ASC LIMIT 1`,
        [group.id, userId]
      );

      if (candidates.length > 0) {
        const nextOwnerId = candidates[0].user_id;

        await connection.query(
          `UPDATE \`groups\` SET created_by = ?, updated_at = NOW() WHERE id = ?`,
          [nextOwnerId, group.id]
        );

        await connection.query(
          `UPDATE group_members SET role = 'creator' WHERE group_id = ? AND user_id = ?`,
          [group.id, nextOwnerId]
        );

        await connection.query(
          `UPDATE conversation_members SET role = 'creator' WHERE conversation_id = ? AND user_id = ?`,
          [group.conversation_id, nextOwnerId]
        );
      }
    }

    // Update status to 'left'
    await connection.query(
      `UPDATE conversation_members SET status = 'left' WHERE conversation_id = ? AND user_id = ?`,
      [group.conversation_id, userId]
    );

    await connection.query(
      `UPDATE group_members SET status = 'left' WHERE group_id = ? AND user_id = ?`,
      [group.id, userId]
    );

    const systemMsg = `${req.user.full_name || req.user.username} left the group`;
    const [msgRes] = await connection.query(
      `INSERT INTO messages (conversation_id, sender_id, message_type, message_content, created_at, updated_at)
       VALUES (?, ?, 'system', ?, NOW(), NOW())`,
      [group.conversation_id, userId, systemMsg]
    );

    await connection.commit();

    const formattedMessage = {
      id: msgRes.insertId,
      conversation_id: group.conversation_id,
      sender_id: userId,
      message_type: 'system',
      message_content: systemMsg,
      created_at: new Date(),
      status: 'delivered'
    };

    emitToConversation(group.conversation_id, 'group_member_left', {
      groupId: group.id,
      conversationId: group.conversation_id,
      leftUserId: userId
    });
    emitToConversation(group.conversation_id, 'new_message', formattedMessage);

    return res.status(200).json({
      success: true,
      message: 'You have left the group'
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
};

/**
 * 8. Promote / Demote Member Role
 * POST /api/groups/:id/members/:userId/role
 */
const updateMemberRole = async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const currentUserId = req.user.id;
    const identifier = parseInt(req.params.id, 10);
    const targetUserId = parseInt(req.params.userId, 10);
    const { role } = req.body;

    if (!['admin', 'member'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Role must be either admin or member' });
    }

    const [groupRows] = await connection.query(
      `SELECT id, conversation_id, name, created_by FROM \`groups\` WHERE id = ? OR conversation_id = ? LIMIT 1`,
      [identifier, identifier]
    );

    if (groupRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }

    const group = groupRows[0];

    // Authorization: Only creator can change admin roles
    const [actingMembership] = await connection.query(
      `SELECT role FROM group_members WHERE group_id = ? AND user_id = ? AND status = 'active'`,
      [group.id, currentUserId]
    );

    if (actingMembership.length === 0 || actingMembership[0].role !== 'creator') {
      return res.status(403).json({
        success: false,
        message: 'Only the group creator can promote or demote admins'
      });
    }

    const [targetMembership] = await connection.query(
      `SELECT role FROM group_members WHERE group_id = ? AND user_id = ? AND status = 'active'`,
      [group.id, targetUserId]
    );

    if (targetMembership.length === 0) {
      return res.status(404).json({ success: false, message: 'Target user is not an active member' });
    }

    if (targetUserId === currentUserId) {
      return res.status(400).json({ success: false, message: 'Cannot modify your own creator role' });
    }

    await connection.beginTransaction();

    await connection.query(
      `UPDATE group_members SET role = ? WHERE group_id = ? AND user_id = ?`,
      [role, group.id, targetUserId]
    );

    await connection.query(
      `UPDATE conversation_members SET role = ? WHERE conversation_id = ? AND user_id = ?`,
      [role, group.conversation_id, targetUserId]
    );

    const [targetUser] = await connection.query('SELECT username, full_name FROM users WHERE id = ?', [targetUserId]);
    const targetName = targetUser[0]?.full_name || targetUser[0]?.username || 'A member';
    const actionText = role === 'admin' ? 'promoted' : 'demoted';
    const systemMsg = `${req.user.full_name || req.user.username} ${actionText} ${targetName} to ${role}`;

    const [msgRes] = await connection.query(
      `INSERT INTO messages (conversation_id, sender_id, message_type, message_content, created_at, updated_at)
       VALUES (?, ?, 'system', ?, NOW(), NOW())`,
      [group.conversation_id, currentUserId, systemMsg]
    );

    await connection.commit();

    const formattedMessage = {
      id: msgRes.insertId,
      conversation_id: group.conversation_id,
      sender_id: currentUserId,
      message_type: 'system',
      message_content: systemMsg,
      created_at: new Date(),
      status: 'delivered'
    };

    emitToConversation(group.conversation_id, 'group_role_updated', {
      groupId: group.id,
      conversationId: group.conversation_id,
      targetUserId,
      newRole: role,
      updatedBy: currentUserId
    });
    emitToConversation(group.conversation_id, 'new_message', formattedMessage);

    // Centralized notification on role update
    try {
      const { sendNotification } = require('../services/notificationService');
      sendNotification({
        userId: targetUserId,
        type: 'group',
        title: 'Group Role Updated',
        description: `Your role in "${group.name}" is now ${role}`,
        referenceId: group.id
      }).catch(() => {});
    } catch (_) {}

    return res.status(200).json({
      success: true,
      message: `${targetName} is now a group ${role}`,
      role
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
};

/**
 * 9. Transfer Group Ownership
 * POST /api/groups/:id/transfer-ownership
 */
const transferOwnership = async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const currentUserId = req.user.id;
    const identifier = parseInt(req.params.id, 10);
    const { newOwnerId } = req.body;

    if (!newOwnerId) {
      return res.status(400).json({ success: false, message: 'newOwnerId is required' });
    }

    const numNewOwnerId = parseInt(newOwnerId, 10);
    if (numNewOwnerId === currentUserId) {
      return res.status(400).json({ success: false, message: 'You are already the group creator' });
    }

    const [groupRows] = await connection.query(
      `SELECT id, conversation_id, name, created_by FROM \`groups\` WHERE id = ? OR conversation_id = ? LIMIT 1`,
      [identifier, identifier]
    );

    if (groupRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }

    const group = groupRows[0];

    if (group.created_by !== currentUserId) {
      return res.status(403).json({ success: false, message: 'Only the current group creator can transfer ownership' });
    }

    const [targetMembership] = await connection.query(
      `SELECT role FROM group_members WHERE group_id = ? AND user_id = ? AND status = 'active'`,
      [group.id, numNewOwnerId]
    );

    if (targetMembership.length === 0) {
      return res.status(404).json({ success: false, message: 'Target user must be an active member of the group' });
    }

    await connection.beginTransaction();

    // 1. Update group creator
    await connection.query(
      `UPDATE \`groups\` SET created_by = ?, updated_at = NOW() WHERE id = ?`,
      [numNewOwnerId, group.id]
    );

    // 2. Set new owner as 'creator' in group_members and conversation_members
    await connection.query(
      `UPDATE group_members SET role = 'creator' WHERE group_id = ? AND user_id = ?`,
      [group.id, numNewOwnerId]
    );
    await connection.query(
      `UPDATE conversation_members SET role = 'creator' WHERE conversation_id = ? AND user_id = ?`,
      [group.conversation_id, numNewOwnerId]
    );

    // 3. Demote previous owner to 'admin'
    await connection.query(
      `UPDATE group_members SET role = 'admin' WHERE group_id = ? AND user_id = ?`,
      [group.id, currentUserId]
    );
    await connection.query(
      `UPDATE conversation_members SET role = 'admin' WHERE conversation_id = ? AND user_id = ?`,
      [group.conversation_id, currentUserId]
    );

    const [newOwner] = await connection.query('SELECT username, full_name FROM users WHERE id = ?', [numNewOwnerId]);
    const newOwnerName = newOwner[0]?.full_name || newOwner[0]?.username || 'A member';
    const systemMsg = `${req.user.full_name || req.user.username} transferred group ownership to ${newOwnerName}`;

    const [msgRes] = await connection.query(
      `INSERT INTO messages (conversation_id, sender_id, message_type, message_content, created_at, updated_at)
       VALUES (?, ?, 'system', ?, NOW(), NOW())`,
      [group.conversation_id, currentUserId, systemMsg]
    );

    await connection.commit();

    const formattedMessage = {
      id: msgRes.insertId,
      conversation_id: group.conversation_id,
      sender_id: currentUserId,
      message_type: 'system',
      message_content: systemMsg,
      created_at: new Date(),
      status: 'delivered'
    };

    emitToConversation(group.conversation_id, 'group_ownership_transferred', {
      groupId: group.id,
      conversationId: group.conversation_id,
      previousOwnerId: currentUserId,
      newOwnerId: numNewOwnerId
    });
    emitToConversation(group.conversation_id, 'new_message', formattedMessage);

    return res.status(200).json({
      success: true,
      message: `Group ownership transferred to ${newOwnerName} successfully`
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
};

/**
 * 10. Delete Group
 * DELETE /api/groups/:id
 */
const deleteGroup = async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const currentUserId = req.user.id;
    const identifier = parseInt(req.params.id, 10);

    const [groupRows] = await connection.query(
      `SELECT id, conversation_id, name, created_by FROM \`groups\` WHERE id = ? OR conversation_id = ? LIMIT 1`,
      [identifier, identifier]
    );

    if (groupRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }

    const group = groupRows[0];

    if (group.created_by !== currentUserId) {
      return res.status(403).json({
        success: false,
        message: 'Only the group creator can delete this group'
      });
    }

    const [members] = await connection.query(
      `SELECT user_id FROM group_members WHERE group_id = ? AND status = 'active'`,
      [group.id]
    );

    await connection.beginTransaction();

    // Deleting conversation cascades to groups, group_members, messages, conversation_members
    await connection.query('DELETE FROM conversations WHERE id = ?', [group.conversation_id]);

    await connection.commit();

    // Broadcast deletion
    for (const m of members) {
      emitToUser(m.user_id, 'group_deleted', {
        groupId: group.id,
        conversationId: group.conversation_id,
        deletedBy: currentUserId
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Group deleted successfully'
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
};

module.exports = {
  createGroup,
  getUserGroups,
  getGroupDetails,
  updateGroup,
  addGroupMembers,
  removeGroupMember,
  leaveGroup,
  updateMemberRole,
  transferOwnership,
  deleteGroup
};
