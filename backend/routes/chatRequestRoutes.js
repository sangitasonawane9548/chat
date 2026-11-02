const express = require('express');
const {
  sendChatRequest,
  getIncomingRequests,
  getSentRequests,
  acceptChatRequest,
  declineChatRequest,
  cancelChatRequest
} = require('../controllers/chatRequestController');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(requireAuth);

router.post('/', sendChatRequest);
router.get('/incoming', getIncomingRequests);
router.get('/sent', getSentRequests);
router.post('/:id/accept', acceptChatRequest);
router.post('/:id/decline', declineChatRequest);
router.post('/:id/cancel', cancelChatRequest);

module.exports = router;

