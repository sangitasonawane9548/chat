const express = require('express');
const {
  getAttachmentFile,
  downloadAttachmentFile
} = require('../controllers/attachmentController');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

// Attachment retrieval routes require authentication
router.use(requireAuth);

router.get('/:id', getAttachmentFile);
router.get('/:id/download', downloadAttachmentFile);

module.exports = router;

