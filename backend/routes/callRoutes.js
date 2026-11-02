const express = require('express');
const {
  initiateCall,
  getCallHistory,
  getCallById,
  cancelCall,
  rejectCall,
  endCall,
  getActiveCall
} = require('../controllers/callController');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

// All call routes require authentication
router.use(requireAuth);

router.post('/', initiateCall);
router.get('/', getCallHistory);
router.get('/active', getActiveCall);
router.get('/:callId', getCallById);
router.post('/:callId/cancel', cancelCall);
router.post('/:callId/reject', rejectCall);
router.post('/:callId/end', endCall);

module.exports = router;

