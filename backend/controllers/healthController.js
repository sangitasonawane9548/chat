const { testDatabaseConnection } = require('../config/database');

/**
 * Health check controller
 * Checks API server status and verifies live MySQL connectivity
 */
const getHealthStatus = async (req, res, next) => {
  try {
    const dbStatus = await testDatabaseConnection();

    if (dbStatus.connected) {
      return res.status(200).json({
        success: true,
        message: 'Username Chat Platform API is running',
        database: 'connected'
      });
    }

    return res.status(503).json({
      success: false,
      message: 'Username Chat Platform API is running but database is unreachable',
      database: 'disconnected',
      error: dbStatus.message
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getHealthStatus
};

