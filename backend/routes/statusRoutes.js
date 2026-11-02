const express = require('express');
const { requireAuth } = require('../middleware/authMiddleware');
const { uploadStatusMedia } = require('../middleware/statusUploadMiddleware');
const {
  createTextStatus,
  createMediaStatus,
  getMyStatuses,
  getFeedStatuses,
  getStatusDetails,
  recordStatusView,
  getStatusViewers,
  toggleStatusReaction,
  replyToStatus,
  deleteStatus,
  getStatusPrivacy,
  updateStatusPrivacy,
  toggleMuteUser
} = require('../controllers/statusController');

const router = express.Router();

// Require authentication for all status routes
router.use(requireAuth);

// Creation endpoints
router.post('/text', createTextStatus);
router.post('/media', uploadStatusMedia.single('file'), createMediaStatus);

// Personal & feed endpoints
router.get('/me', getMyStatuses);
router.get('/feed', getFeedStatuses);

// Privacy endpoints
router.get('/privacy', getStatusPrivacy);
router.put('/privacy', updateStatusPrivacy);

// Mute toggle
router.post('/mute/:userId', toggleMuteUser);

// Parameterized status routes
router.get('/:id', getStatusDetails);
router.post('/:id/views', recordStatusView);
router.get('/:id/viewers', getStatusViewers);
router.post('/:id/reactions', toggleStatusReaction);
router.post('/:id/reply', replyToStatus);
router.delete('/:id', deleteStatus);

module.exports = router;

