const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const path = require('path');
const apiRoutes = require('./routes');
const notFoundHandler = require('./middleware/notFoundHandler');
const errorHandler = require('./middleware/errorHandler');
const { apiLimiter } = require('./middleware/rateLimiter');

const app = express();

// Trust proxy for secure cookies and IP detection behind tunnels / reverse proxies
app.set('trust proxy', 1);

// Security HTTP headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// CORS configuration with credentials, LAN mobile & tunnel support
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://localhost:5174'
];

const isAllowedOrigin = (origin) => {
  // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
  if (!origin) return true;

  // In development / non-production, dynamically allow all origins (tunnels, local Wi-Fi, preview domains)
  if (process.env.NODE_ENV !== 'production') return true;

  if (allowedOrigins.includes(origin)) return true;

  // Match localhost & loopback IP addresses (http or https)
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return true;

  // Match LAN private network IP addresses (Wi-Fi, hotspot, local subnet: 192.168.x.x, 10.x.x.x, 172.16-31.x.x)
  const lanPattern = /^https?:\/\/(192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})(:\d+)?$/;
  if (lanPattern.test(origin)) return true;

  // Match Cloudflare tunnels (*.trycloudflare.com, *.cloudflare.com)
  if (/^https?:\/\/([a-zA-Z0-9-]+\.)*(trycloudflare\.com|cloudflare\.com)(:\d+)?$/.test(origin)) return true;

  // Match common developer tunnels
  if (/^https?:\/\/([a-zA-Z0-9-]+\.)*(loca\.lt|ngrok-free\.app|ngrok\.io|ngrok\.app)(:\d+)?$/.test(origin)) return true;

  return false;
};

app.use(cors({
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
    } else {
      console.warn(`[CORS] Blocked origin: ${origin}`);
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'Cache-Control']
}));

// Cookie parsing
app.use(cookieParser(process.env.COOKIE_SECRET || 'super_secret_cookie_key_aether_platform_2026'));

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Mount API routes with global rate limiter
app.use('/api', apiLimiter, apiRoutes);

// Base route for sanity check
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'online',
    platform: 'MELT Real-Time Platform API',
    version: '1.0.0'
  });
});

// 404 handler
app.use(notFoundHandler);

// Centralized error handler
app.use(errorHandler);

module.exports = app;
