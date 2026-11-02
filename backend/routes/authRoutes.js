const express = require('express');
const {
  checkUsername,
  register,
  verifyEmail,
  resendOtp,
  login,
  getMe,
  logout,
  logoutAll,
  getSessions,
  forgotPassword,
  resetPassword,
  changePassword
} = require('../controllers/authController');
const { requireAuth } = require('../middleware/authMiddleware');
const { authLimiter, loginLimiter, otpLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// Public Authentication Endpoints
router.get('/check-username', checkUsername);
router.post('/register', authLimiter, register);
router.post('/verify-email', otpLimiter, verifyEmail);
router.post('/resend-otp', otpLimiter, resendOtp);
router.post('/login', loginLimiter, login);
router.post('/forgot-password', authLimiter, forgotPassword);
router.post('/reset-password', authLimiter, resetPassword);

// Authenticated Endpoints
router.get('/me', requireAuth, getMe);
router.post('/logout', requireAuth, logout);
router.post('/logout-all', requireAuth, logoutAll);
router.get('/sessions', requireAuth, getSessions);
router.post('/change-password', requireAuth, changePassword);

module.exports = router;

