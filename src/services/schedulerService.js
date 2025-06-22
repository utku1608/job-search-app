// src/services/schedulerService.js

const cron = require('node-cron');
const { 
  checkAndSendJobAlerts, 
  sendRelatedJobNotifications 
} = require('../controllers/notificationController');

class SchedulerService {
  constructor() {
    this.jobs = new Map();
    this.isRunning = false;
  }

  // Start all scheduled tasks
  start() {
    if (this.isRunning) {
      console.log('⚠️ Scheduler is already running');
      return;
    }

    console.log('🚀 Starting scheduler service...');
    
    // Job Alert Notifications - Every 30 minutes
    this.scheduleJobAlerts();
    
    // Related Job Notifications - Daily at 9 AM
    this.scheduleRelatedJobNotifications();
    
    // Cleanup old notifications - Weekly on Sundays at 2 AM
    this.scheduleNotificationCleanup();
    
    this.isRunning = true;
    console.log('✅ Scheduler service started successfully');
  }

  // Stop all scheduled tasks
  stop() {
    if (!this.isRunning) {
      console.log('⚠️ Scheduler is not running');
      return;
    }

    console.log('🛑 Stopping scheduler service...');
    
    this.jobs.forEach((job, name) => {
      job.destroy();
      console.log(`📋 Stopped task: ${name}`);
    });
    
    this.jobs.clear();
    this.isRunning = false;
    console.log('✅ Scheduler service stopped');
  }

  // Schedule job alert notifications
  scheduleJobAlerts() {
    const taskName = 'job-alerts';
    
    // Run every 30 minutes
    const task = cron.schedule('*/30 * * * *', async () => {
      console.log('🔔 Running job alerts check...');
      try {
        await checkAndSendJobAlerts();
      } catch (error) {
        console.error('❌ Job alerts task failed:', error);
      }
    }, {
      scheduled: false,
      timezone: 'Europe/Istanbul'
    });

    task.start();
    this.jobs.set(taskName, task);
    console.log(`📅 Scheduled: ${taskName} - every 30 minutes`);
  }

  // Schedule related job notifications
  scheduleRelatedJobNotifications() {
    const taskName = 'related-jobs';
    
    // Run daily at 9:00 AM
    const task = cron.schedule('0 9 * * *', async () => {
      console.log('💡 Running related jobs notifications...');
      try {
        await sendRelatedJobNotifications();
      } catch (error) {
        console.error('❌ Related jobs task failed:', error);
      }
    }, {
      scheduled: false,
      timezone: 'Europe/Istanbul'
    });

    task.start();
    this.jobs.set(taskName, task);
    console.log(`📅 Scheduled: ${taskName} - daily at 9:00 AM`);
  }

  // Schedule notification cleanup
  scheduleNotificationCleanup() {
    const taskName = 'notification-cleanup';
    
    // Run weekly on Sundays at 2:00 AM
    const task = cron.schedule('0 2 * * 0', async () => {
      console.log('🧹 Running notification cleanup...');
      try {
        await this.cleanupOldNotifications();
      } catch (error) {
        console.error('❌ Notification cleanup task failed:', error);
      }
    }, {
      scheduled: false,
      timezone: 'Europe/Istanbul'
    });

    task.start();
    this.jobs.set(taskName, task);
    console.log(`📅 Scheduled: ${taskName} - weekly on Sundays at 2:00 AM`);
  }

  // Clean up old notifications (older than 3 months)
  async cleanupOldNotifications() {
    const { Pool } = require('pg');
    const JobSearch = require('../models/jobSearchSchema');
    
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });

    try {
      // Clean PostgreSQL notification logs older than 3 months
      const pgResult = await pool.query(`
        DELETE FROM notification_logs 
        WHERE created_at < NOW() - INTERVAL '3 months'
      `);
      
      console.log(`🗑️ Deleted ${pgResult.rowCount} old notification logs from PostgreSQL`);

      // Clean MongoDB job searches older than 6 months
      const mongoResult = await JobSearch.deleteMany({
        searchedAt: { $lt: new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000) }
      });

      console.log(`🗑️ Deleted ${mongoResult.deletedCount} old job searches from MongoDB`);
      
    } catch (error) {
      console.error('❌ Cleanup failed:', error);
    }
  }

  // Manual trigger for job alerts (for testing)
  async triggerJobAlerts() {
    console.log('🧪 Manually triggering job alerts...');
    try {
      await checkAndSendJobAlerts();
      console.log('✅ Manual job alerts trigger completed');
    } catch (error) {
      console.error('❌ Manual job alerts trigger failed:', error);
      throw error;
    }
  }

  // Manual trigger for related jobs (for testing)
  async triggerRelatedJobs() {
    console.log('🧪 Manually triggering related jobs...');
    try {
      await sendRelatedJobNotifications();
      console.log('✅ Manual related jobs trigger completed');
    } catch (error) {
      console.error('❌ Manual related jobs trigger failed:', error);
      throw error;
    }
  }

  // Get scheduler status
  getStatus() {
    return {
      isRunning: this.isRunning,
      activeTasks: Array.from(this.jobs.keys()),
      taskCount: this.jobs.size,
      uptime: this.isRunning ? Date.now() - this.startTime : 0
    };
  }

  // Add a new custom task
  addCustomTask(name, cronPattern, taskFunction, options = {}) {
    if (this.jobs.has(name)) {
      throw new Error(`Task ${name} already exists`);
    }

    const task = cron.schedule(cronPattern, taskFunction, {
      scheduled: false,
      timezone: options.timezone || 'Europe/Istanbul',
      ...options
    });

    task.start();
    this.jobs.set(name, task);
    console.log(`📅 Added custom task: ${name} - ${cronPattern}`);
  }

  // Remove a task
  removeTask(name) {
    const task = this.jobs.get(name);
    if (task) {
      task.destroy();
      this.jobs.delete(name);
      console.log(`🗑️ Removed task: ${name}`);
      return true;
    }
    return false;
  }
}

// Singleton instance
const schedulerService = new SchedulerService();

module.exports = schedulerService;