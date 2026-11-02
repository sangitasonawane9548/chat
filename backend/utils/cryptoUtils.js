const crypto = require('crypto');

/**
 * Generate a cryptographically secure 6-digit OTP
 * @returns {string} 6-digit numeric string
 */
const generateSecureOTP = () => {
  return crypto.randomInt(100000, 1000000).toString();
};

/**
 * Hash a string (such as an OTP or reset token) using SHA-256
 * @param {string} data 
 * @returns {string} Hex encoded hash
 */
const hashData = (data) => {
  return crypto.createHash('sha256').update(String(data)).digest('hex');
};

/**
 * Generate a secure random token for password resets or sessions
 * @param {number} bytes 
 * @returns {string} Hex encoded token
 */
const generateRandomToken = (bytes = 32) => {
  return crypto.randomBytes(bytes).toString('hex');
};

module.exports = {
  generateSecureOTP,
  hashData,
  generateRandomToken
};

