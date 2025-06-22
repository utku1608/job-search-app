// src/routes/notifications.js

const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const authController = require('../controllers/authController');
const schedulerService = require('../services/schedulerService');

// Debug middleware - GEÇICI
router.use((req, res, next) => {
  console.log('🔍 Route accessed:', req.path);
  console.log('🔑 Auth header:', req.headers.authorization);
  next();
});

// Middleware - all notification routes require authentication
router.use(authController.authenticateToken);

// Debug middleware - GEÇICI
router.use((req, res, next) => {
  console.log('👤 User after auth:', req.user);
  next();
});

// Job Alerts Management
router.post('/alerts', notificationController.createJobAlert);
router.get('/alerts', notificationController.getUserJobAlerts);
router.put('/alerts/:id', notificationController.updateJobAlert);
router.delete('/alerts/:id', notificationController.deleteJobAlert);

// Job Search History
router.post('/searches', notificationController.storeJobSearch);
router.get('/searches', notificationController.getUserSearchHistory);

// Manual trigger endpoints (for testing)
router.post('/trigger/job-alerts', async (req, res) => {
  try {
    await schedulerService.triggerJobAlerts();
    res.json({ message: 'Job alerts triggered successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/trigger/related-jobs', async (req, res) => {
  try {
    await schedulerService.triggerRelatedJobs();
    res.json({ message: 'Related jobs notifications triggered successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Scheduler status
router.get('/scheduler/status', (req, res) => {
  const status = schedulerService.getStatus();
  res.json(status);
});

module.exports = router;