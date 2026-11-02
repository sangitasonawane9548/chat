const express = require('express');
const healthRoutes = require('./healthRoutes');
const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');
const chatRequestRoutes = require('./chatRequestRoutes');
const conversationRoutes = require('./conversationRoutes');
const messageRoutes = require('./messageRoutes');
const notificationRoutes = require('./notificationRoutes');
const attachmentRoutes = require('./attachmentRoutes');
const callRoutes = require('./callRoutes');
const groupRoutes = require('./groupRoutes');
const statusRoutes = require('./statusRoutes');
const adminRoutes = require('./adminRoutes');
const reportRoutes = require('./reportRoutes');

const router = express.Router();

// Mount API modules
router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/chat-requests', chatRequestRoutes);
router.use('/conversations', conversationRoutes);
router.use('/groups', groupRoutes);
router.use('/messages', messageRoutes);
router.use('/attachments', attachmentRoutes);
router.use('/calls', callRoutes);
router.use('/notifications', notificationRoutes);
router.use('/statuses', statusRoutes);
router.use('/admin', adminRoutes);
router.use('/reports', reportRoutes);

module.exports = router;
