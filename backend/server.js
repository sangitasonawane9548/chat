const http = require('http');
const dotenv = require('dotenv');

// Load environment variables before anything else
dotenv.config();

const app = require('./app');
const { testDatabaseConnection, pool } = require('./config/database');
const { initSocket } = require('./config/socket');
const statusService = require('./services/statusService');

const PORT = process.env.PORT || 5000;

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.IO
const io = initSocket(server);

// Boot sequence
const startServer = async () => {
  try {
    console.log('----------------------------------------------------');
    console.log('🚀 Booting Username Chat Platform Backend Server...');
    console.log('----------------------------------------------------');

    // Test MySQL Database connection
    const dbTest = await testDatabaseConnection();
    if (dbTest.connected) {
      console.log('✅ MySQL Database: Connected & Verified');
      console.log(`   Host: ${process.env.DB_HOST || '127.0.0.1'}`);
      console.log(`   Database: ${process.env.DB_NAME || 'username_chat_platform'}`);
    } else {
      console.warn('⚠️  MySQL Database connection warning:', dbTest.message);
      console.warn('   The server will start, but database requests will fail until MySQL is accessible.');
    }

    server.listen(PORT, () => {
      console.log(`📡 HTTP Server running on http://localhost:${PORT}`);
      console.log(`⚡ Socket.IO initialized and ready`);
      console.log(`🔍 Health check available at: http://localhost:${PORT}/api/health`);
      console.log('----------------------------------------------------');

      // Run status cleanup immediately on start, then every 30 minutes
      statusService.cleanupExpiredStatuses().catch(err => {
        console.error('Initial status cleanup error:', err.message);
      });
      setInterval(() => {
        statusService.cleanupExpiredStatuses().catch(err => {
          console.error('Periodic status cleanup error:', err.message);
        });
      }, 30 * 60 * 1000);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Handle process termination gracefully
const shutdown = async () => {
  console.log('\n🛑 Gracefully shutting down server...');
  server.close(async () => {
    console.log('   HTTP server closed.');
    try {
      await pool.end();
      console.log('   MySQL connection pool closed.');
    } catch (err) {
      console.error('   Error closing MySQL pool:', err);
    }
    process.exit(0);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

startServer();

