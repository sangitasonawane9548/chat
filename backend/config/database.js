const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

// Create connection pool with production-grade configurations
const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'username_chat_platform',
  waitForConnections: true,
  connectionLimit: 15,
  maxIdle: 10,
  idleTimeout: 60000,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  charset: 'utf8mb4'
});

/**
 * Perform a live health check on the MySQL pool
 * @returns {Promise<{connected: boolean, message: string, timestamp: string}>}
 */
const testDatabaseConnection = async () => {
  try {
    const connection = await pool.getConnection();
    try {
      await connection.query('SELECT 1 + 1 AS health_check');
      return {
        connected: true,
        message: 'Database connection verified successfully',
        timestamp: new Date().toISOString()
      };
    } finally {
      connection.release();
    }
  } catch (error) {
    return {
      connected: false,
      message: error.message || 'Database connection failed',
      timestamp: new Date().toISOString()
    };
  }
};

module.exports = {
  pool,
  testDatabaseConnection
};

