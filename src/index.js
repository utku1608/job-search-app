// gateway.js - API Gateway for Job Search Microservices
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const PORT = process.env.GATEWAY_PORT || 8000;

// Middleware
app.use(cors());
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
  },
});
app.use(limiter);

// Health check for gateway
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'API Gateway',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Service health checks (optional)
app.get('/health/services', async (req, res) => {
  const services = [
    { name: 'Job Service', url: 'http://localhost:5001/health' },
    { name: 'Notification Service', url: 'http://localhost:5002/health' },
    { name: 'AI Agent Service', url: 'http://localhost:5003/health' }
  ];

  const healthChecks = await Promise.allSettled(
    services.map(async (service) => {
      try {
        const response = await fetch(service.url);
        return {
          name: service.name,
          status: response.ok ? 'healthy' : 'unhealthy',
          url: service.url
        };
      } catch (error) {
        return {
          name: service.name,
          status: 'unhealthy',
          error: error.message,
          url: service.url
        };
      }
    })
  );

  res.json({
    gateway: 'healthy',
    timestamp: new Date().toISOString(),
    services: healthChecks.map(result => result.value || result.reason)
  });
});

// JOB SERVICE PROXY (Port 5001)
app.use('/api/v1/jobs', createProxyMiddleware({
  target: 'http://localhost:5001',
  changeOrigin: true,
  pathRewrite: { '^/api/v1/jobs': '/api/jobs' }, // Map to original route structure
  onError: (err, req, res) => {
    console.error('Job Service Proxy Error:', err.message);
    res.status(503).json({
      error: 'Job Service unavailable',
      message: 'The job service is currently down. Please try again later.'
    });
  },
  onProxyReq: (proxyReq, req, res) => {
    console.log(`[JOB SERVICE] ${req.method} ${req.originalUrl}`);
  }
}));

// NOTIFICATION SERVICE PROXY (Port 5002)
app.use('/api/v1/notify', createProxyMiddleware({
  target: 'http://localhost:5002',
  changeOrigin: true,
  pathRewrite: { '^/api/v1/notify': '/api/notifications' }, // Map to original route structure
  onError: (err, req, res) => {
    console.error('Notification Service Proxy Error:', err.message);
    res.status(503).json({
      error: 'Notification Service unavailable',
      message: 'The notification service is currently down. Please try again later.'
    });
  },
  onProxyReq: (proxyReq, req, res) => {
    console.log(`[NOTIFICATION SERVICE] ${req.method} ${req.originalUrl}`);
  }
}));

// AI AGENT SERVICE PROXY (Port 5003)
app.use('/api/v1/ai', createProxyMiddleware({
  target: 'http://localhost:5003',
  changeOrigin: true,
  pathRewrite: { '^/api/v1/ai': '/api/ai' }, // Map to original route structure
  onError: (err, req, res) => {
    console.error('AI Agent Service Proxy Error:', err.message);
    res.status(503).json({
      error: 'AI Agent Service unavailable',
      message: 'The AI agent service is currently down. Please try again later.'
    });
  },
  onProxyReq: (proxyReq, req, res) => {
    console.log(`[AI AGENT SERVICE] ${req.method} ${req.originalUrl}`);
  }
}));

// AUTH SERVICE PROXY (assuming your main service handles auth)
app.use('/api/v1/auth', createProxyMiddleware({
  target: 'http://localhost:5000', // Your main service
  changeOrigin: true,
  pathRewrite: { '^/api/v1/auth': '/api/auth' },
  onError: (err, req, res) => {
    console.error('Auth Service Proxy Error:', err.message);
    res.status(503).json({
      error: 'Auth Service unavailable',
      message: 'The authentication service is currently down. Please try again later.'
    });
  },
  onProxyReq: (proxyReq, req, res) => {
    console.log(`[AUTH SERVICE] ${req.method} ${req.originalUrl}`);
  }
}));

// ADMIN SERVICE PROXY (for admin endpoints)
app.use('/api/v1/admin', createProxyMiddleware({
  target: 'http://localhost:5000', // Your main service
  changeOrigin: true,
  pathRewrite: { '^/api/v1/admin': '/api/admin' },
  onError: (err, req, res) => {
    console.error('Admin Service Proxy Error:', err.message);
    res.status(503).json({
      error: 'Admin Service unavailable',
      message: 'The admin service is currently down. Please try again later.'
    });
  },
  onProxyReq: (proxyReq, req, res) => {
    console.log(`[ADMIN SERVICE] ${req.method} ${req.originalUrl}`);
  }
}));

// Fallback for unmatched routes
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: `The requested route ${req.originalUrl} was not found on this server.`,
    availableEndpoints: [
      '/api/v1/jobs/*',
      '/api/v1/notify/*',
      '/api/v1/ai/*',
      '/api/v1/auth/*',
      '/api/v1/admin/*',
      '/health',
      '/health/services'
    ]
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Gateway Error:', error);
  res.status(500).json({
    error: 'Internal Gateway Error',
    message: 'An unexpected error occurred in the API Gateway.'
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 API Gateway shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 API Gateway shutting down gracefully...');
  process.exit(0);
});

// Start gateway
app.listen(PORT, () => {
  console.log(`🚀 API Gateway running on http://localhost:${PORT}`);
  console.log('📋 Available routes:');
  console.log('  • /api/v1/jobs/*    -> http://localhost:5001');
  console.log('  • /api/v1/notify/*  -> http://localhost:5002');
  console.log('  • /api/v1/ai/*      -> http://localhost:5003');
  console.log('  • /api/v1/auth/*    -> http://localhost:5000');
  console.log('  • /api/v1/admin/*   -> http://localhost:5000');
  console.log('  • /health           -> Gateway health');
  console.log('  • /health/services  -> All services health');
});

module.exports = app;