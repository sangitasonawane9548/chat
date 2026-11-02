const express = require('express');
const {
  getConversations,
  getConversationById,
  getConversationMessages,
  sendMessage,
  markConversationAsRead,
  searchConversationMessages,
  clearConversation
} = require('../controllers/messageController');
const { uploadAttachment } = require('../controllers/attachmentController');
const { handleAttachmentUpload } = require('../middleware/attachmentMiddleware');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

// All conversation routes require authentication
router.use(requireAuth);

router.get('/', getConversations);
router.get('/:id', getConversationById);
router.get('/:id/messages', getConversationMessages);
router.post('/:id/messages', sendMessage);
router.post('/:id/attachments', handleAttachmentUpload, uploadAttachment);
router.post('/:id/read', markConversationAsRead);
router.get('/:id/search', searchConversationMessages);
router.post('/:id/clear', clearConversation);

module.exports = router;
