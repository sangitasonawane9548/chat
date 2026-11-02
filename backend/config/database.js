const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const fs = require('fs');

dotenv.config();

/**
 * Resolve database configuration options supporting:
 * 1. Aiven MySQL individual environment variables (DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME)
 * 2. Full connection URI string (DATABASE_URL / MYSQL_URL / DB_URI)
 * 3. SSL/TLS configuration required by Aiven MySQL (CA cert, rejectUnauthorized)
 */
const getPoolConfig = () => {
  const isAiven = Boolean(
    (process.env.DB_HOST && process.env.DB_HOST.includes('aivencloud.com')) ||
    (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('aivencloud.com'))
  );

  const isProduction = process.env.NODE_ENV === 'production';
  const sslRequested = process.env.DB_SSL === 'true' || process.env.DATABASE_SSL === 'true' || isAiven;

  // SSL Options configuration for Aiven
  let ssl = undefined;
  if (sslRequested) {
    const caCert = process.env.DB_SSL_CA || process.env.DATABASE_SSL_CA;
    if (caCert) {
      let caContent = caCert;
      if (fs.existsSync(caCert)) {
        try {
          caContent = fs.readFileSync(caCert, 'utf8');
        } catch (e) {
          console.warn('[Database] Could not read CA cert file, using raw value:', e.message);
        }
      }
      ssl = {
        ca: caContent,
        rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'false' ? false : true
      };
    } else {
      // Default SSL mode for cloud managed databases like Aiven
      ssl = {
        rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true' ? true : false
      };
    }
  }

  // Connection string support (e.g. Aiven Service URI)
  const connectionUri = process.env.DATABASE_URL || process.env.MYSQL_URL || process.env.DB_URI;
  if (connectionUri) {
    return {
      uri: connectionUri,
      waitForConnections: true,
      connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '10', 10),
      maxIdle: parseInt(process.env.DB_MAX_IDLE || '5', 10),
      idleTimeout: 60000,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
      connectTimeout: 20000,
      charset: 'utf8mb4',
      ...(ssl ? { ssl } : {})
    };
  }

  // Standard granular environment variables
  return {
    host: process.env.DB_HOST || process.env.DATABASE_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || process.env.DATABASE_PORT || '3306', 10),
    user: process.env.DB_USER || process.env.DATABASE_USER || 'root',
    password: process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : (process.env.DATABASE_PASSWORD || ''),
    database: process.env.DB_NAME || process.env.DATABASE_NAME || 'username_chat_platform',
    waitForConnections: true,
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || (isProduction ? '10' : '15'), 10),
    maxIdle: parseInt(process.env.DB_MAX_IDLE || '5', 10),
    idleTimeout: 60000,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
    connectTimeout: 20000,
    charset: 'utf8mb4',
    ...(ssl ? { ssl } : {})
  };
};

const poolConfig = getPoolConfig();
const pool = mysql.createPool(poolConfig);

// Pool-level error handler to prevent unhandled node crash on transient network glitches
pool.on('error', (err) => {
  console.error('[Database Pool Error]:', err.message || err);
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
  testDatabaseConnection,
  getPoolConfig
};
