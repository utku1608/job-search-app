// src/routes/healthRoutes.js
const express = require('express');
const { Pool } = require('pg');
const router = express.Router();

// Health check endpoint
router.get('/health', async (req, res) => {
  try {
    // Check database connection
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
    
    await pool.query('SELECT 1');
    await pool.end();
    
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: 'connected',
      memory: process.memoryUsage(),
      pid: process.pid
    });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

module.exports = router;