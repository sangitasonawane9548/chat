const rateLimit = require('express-rate-limit');

/**
 * General authentication rate limiter
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests from this IP. Please try again after 15 minutes.'
  }
});

/**
 * Login attempt rate limiter to prevent brute-force attacks
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 15 : 1000, // relaxed in dev/testing
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many login attempts. Please try again after 15 minutes.'
  }
});

/**
 * OTP resend / verify rate limiter
 */
const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: process.env.NODE_ENV === 'production' ? 10 : 500, // relaxed in dev/testing
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many verification code attempts. Please wait a few minutes before trying again.'
  }
});

/**
 * General API rate limiter for DDoS and abuse protection
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 1000 : 10000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests from this IP. Please slow down.'
  }
});

/**
 * Admin login rate limiter to protect against brute-force attacks on the Admin Portal
 */
const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 10 : 200, // 10 attempts in prod, 200 in dev/test
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many admin login attempts from this IP. Please try again after 15 minutes.'
  }
});

module.exports = {
  authLimiter,
  loginLimiter,
  otpLimiter,
  apiLimiter,
  adminLoginLimiter
};

