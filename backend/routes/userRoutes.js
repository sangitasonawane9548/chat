const express = require('express');
const {
  searchUsers,
  getSuggestions,
  getUserProfile,
  updateOwnProfile,
  uploadAvatar,
  getUserSettings,
  updateUserSettings,
  getBlockedUsers,
  blockUser,
  unblockUser
} = require('../controllers/userController');
const { checkUsername } = require('../controllers/authController');
const { requireAuth } = require('../middleware/authMiddleware');
const { uploadAvatar: uploadMiddleware } = require('../middleware/uploadMiddleware');

const router = express.Router();

// Public username check alias
router.get('/check-username', checkUsername);

// Protected user discovery, settings & profile endpoints
router.get('/search', requireAuth, searchUsers);
router.get('/suggestions', requireAuth, getSuggestions);
router.get('/settings', requireAuth, getUserSettings);
router.put('/settings', requireAuth, updateUserSettings);
router.get('/blocked', requireAuth, getBlockedUsers);
router.post('/block/:targetUserId', requireAuth, blockUser);
router.delete('/block/:targetUserId', requireAuth, unblockUser);
router.put('/me/profile', requireAuth, updateOwnProfile);
router.post('/me/avatar', requireAuth, uploadMiddleware.single('avatar'), uploadAvatar);
router.get('/:username', requireAuth, getUserProfile);

module.exports = router;

