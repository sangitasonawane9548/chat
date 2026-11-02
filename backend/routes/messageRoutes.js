const express = require('express');
const {
  editMessage,
  deleteMessageForMe,
  deleteMessageForEveryone
} = require('../controllers/messageController');
const {
  toggleReaction,
  removeReaction,
  forwardMessage
} = require('../controllers/attachmentController');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

// All message routes require authentication
router.use(requireAuth);

router.patch('/:id', editMessage);
router.delete('/:id', deleteMessageForMe);
router.post('/:id/delete-for-everyone', deleteMessageForEveryone);
router.post('/:id/reactions', toggleReaction);
router.delete('/:id/reactions', removeReaction);
router.post('/:id/forward', forwardMessage);

module.exports = router;

