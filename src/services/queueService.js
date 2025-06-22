// src/services/queueService.js

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

class QueueService {
  constructor() {
    this.isProcessing = false;
    this.processingInterval = null;
  }

  // Initialize queue tables if not exists
  async initialize() {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS job_queue (
  id SERIAL PRIMARY KEY,
  job_id INTEGER REFERENCES jobs(id) ON DELETE CASCADE,
  queue_type VARCHAR(50) NOT NULL DEFAULT 'new_job_posting',
  status VARCHAR(20) DEFAULT 'pending',
  priority INTEGER DEFAULT 1,
  payload JSONB,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  processed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_job_queue_status ON job_queue(status);
CREATE INDEX IF NOT EXISTS idx_job_queue_priority ON job_queue(priority);
CREATE INDEX IF NOT EXISTS idx_job_queue_created_at ON job_queue(created_at);
CREATE INDEX IF NOT EXISTS idx_job_queue_status_priority ON job_queue(status, priority, created_at);
      `);
      console.log('✅ Queue tables initialized');
    } catch (error) {
      console.error('❌ Queue initialization failed:', error);
    }
  }

  // Add job to queue
  async addJob(jobId, queueType = 'new_job_posting', priority = 1, payload = {}) {
    try {
      const result = await pool.query(`
        INSERT INTO job_queue (job_id, queue_type, priority, payload)
        VALUES ($1, $2, $3, $4)
        RETURNING id
      `, [jobId, queueType, priority, JSON.stringify(payload)]);

      console.log(`📥 Added job ${jobId} to queue (${queueType}) with ID: ${result.rows[0].id}`);
      return result.rows[0].id;
    } catch (error) {
      console.error('❌ Failed to add job to queue:', error);
      throw error;
    }
  }

  // Process queue
  async processQueue() {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;
    
    try {
      // Get pending jobs ordered by priority and creation time
      const result = await pool.query(`
        SELECT * FROM job_queue 
        WHERE status = 'pending' AND attempts < max_attempts
        ORDER BY priority DESC, created_at ASC
        LIMIT 10
      `);

      const queueItems = result.rows;
      
      if (queueItems.length > 0) {
        console.log(`🔄 Processing ${queueItems.length} queue items...`);
        
        for (const item of queueItems) {
          await this.processQueueItem(item);
        }
      }
    } catch (error) {
      console.error('❌ Queue processing error:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  // Process individual queue item
  async processQueueItem(item) {
    try {
      // Mark as processing
      await pool.query(`
        UPDATE job_queue 
        SET status = 'processing', attempts = attempts + 1
        WHERE id = $1
      `, [item.id]);

      let success = false;

      // Process based on queue type
      switch (item.queue_type) {
        case 'new_job_posting':
          success = await this.processNewJobPosting(item);
          break;
        case 'job_application':
          success = await this.processJobApplication(item);
          break;
        case 'notification':
          success = await this.processNotification(item);
          break;
        default:
          console.warn(`⚠️ Unknown queue type: ${item.queue_type}`);
          success = false;
      }

      // Update queue item status
      if (success) {
        await pool.query(`
          UPDATE job_queue 
          SET status = 'completed', processed_at = NOW()
          WHERE id = $1
        `, [item.id]);
        console.log(`✅ Queue item ${item.id} processed successfully`);
      } else {
        const status = item.attempts >= item.max_attempts ? 'failed' : 'pending';
        await pool.query(`
          UPDATE job_queue 
          SET status = $1, error_message = $2
          WHERE id = $3
        `, [status, 'Processing failed', item.id]);
        
        if (status === 'failed') {
          console.error(`❌ Queue item ${item.id} failed permanently after ${item.attempts} attempts`);
        }
      }

    } catch (error) {
      console.error(`❌ Error processing queue item ${item.id}:`, error);
      
      // Mark as failed if max attempts reached
      const status = item.attempts >= item.max_attempts ? 'failed' : 'pending';
      await pool.query(`
        UPDATE job_queue 
        SET status = $1, error_message = $2
        WHERE id = $3
      `, [status, error.message, item.id]);
    }
  }

  // Process new job posting - trigger job alerts
  async processNewJobPosting(item) {
    try {
      const { checkAndSendJobAlerts } = require('../controllers/notificationController');
      
      // Get job details
      const jobResult = await pool.query('SELECT * FROM jobs WHERE id = $1', [item.job_id]);
      
      if (jobResult.rows.length === 0) {
        console.warn(`⚠️ Job ${item.job_id} not found`);
        return false;
      }

      const job = jobResult.rows[0];
      console.log(`🔔 Processing new job posting: ${job.title} at ${job.company}`);

      // Find matching job alerts and send notifications
      const alertsResult = await pool.query(`
        SELECT ja.*, u.email, u.name 
        FROM job_alerts ja
        JOIN users u ON ja.user_id = u.id
        WHERE ja.is_active = true
      `);

      const alerts = alertsResult.rows;
      let notificationsSent = 0;

      for (const alert of alerts) {
        const matches = this.checkJobAlertMatch(job, alert);
        if (matches) {
          await this.sendJobAlertNotification(alert, [job]);
          notificationsSent++;
        }
      }

      console.log(`📧 Sent ${notificationsSent} notifications for job ${job.title}`);
      return true;

    } catch (error) {
      console.error('❌ Error processing new job posting:', error);
      return false;
    }
  }

  // Check if job matches alert criteria
  checkJobAlertMatch(job, alert) {
    // Keywords match
    if (alert.keywords) {
      const keywords = alert.keywords.toLowerCase().split(',').map(k => k.trim());
      const jobText = `${job.title} ${job.description}`.toLowerCase();
      const hasKeywordMatch = keywords.some(keyword => 
        jobText.includes(keyword)
      );
      if (!hasKeywordMatch) return false;
    }

    // Location match
    if (alert.city && job.city.toLowerCase() !== alert.city.toLowerCase()) {
      return false;
    }

    if (alert.country && job.country !== alert.country) {
      return false;
    }

    // Preference match
    if (alert.preference && job.preference !== alert.preference) {
      return false;
    }

    // Company match
    if (alert.company && !job.company.toLowerCase().includes(alert.company.toLowerCase())) {
      return false;
    }

    return true;
  }

  // Send job alert notification
  async sendJobAlertNotification(alert, jobs) {
    const nodemailer = require('nodemailer');
    
const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      }
    });

    try {
      const subject = `🔔 New job matching "${alert.alert_name}"`;
      
      let emailBody = `
        <h2>Hi ${alert.name}!</h2>
        <p>A new job posting matches your alert "<strong>${alert.alert_name}</strong>":</p>
      `;

      jobs.forEach(job => {
        emailBody += `
          <div style="border: 1px solid #ddd; padding: 15px; margin: 10px 0; border-radius: 5px;">
            <h3 style="color: #007bff;">${job.title}</h3>
            <p><strong>${job.company}</strong></p>
            <p>📍 ${job.city}, ${job.country}</p>
            <p>💼 ${job.preference}</p>
            <a href="${process.env.FRONTEND_URL}/jobs/${job.id}" style="background-color: #007bff; color: white; padding: 8px 16px; text-decoration: none; border-radius: 4px;">View Job</a>
          </div>
        `;
      });

     // DEMO: Email gönderimi yerine console log
console.log('📧 DEMO: Queue email would be sent to:', alert.email);
console.log('📧 DEMO: Queue notification subject:', subject);
console.log('⚡ DEMO: Queue-based notification prepared');

      // Log notification
      await pool.query(`
        INSERT INTO notification_logs (user_id, job_alert_id, job_id, type, title, message, status, sent_at)
        VALUES ($1, $2, $3, 'job_alert', $4, $5, 'sent', NOW())
      `, [alert.user_id, alert.id, jobs[0].id, subject, `New job alert: ${jobs[0].title}`]);

      console.log(`📧 Sent job alert to ${alert.email}`);

    } catch (error) {
      console.error(`❌ Failed to send notification to ${alert.email}:`, error);
      throw error;
    }
  }

  // Process job application
  async processJobApplication(item) {
    try {
      // This could handle application confirmations, employer notifications, etc.
      console.log(`📝 Processing job application for job ${item.job_id}`);
      return true;
    } catch (error) {
      console.error('❌ Error processing job application:', error);
      return false;
    }
  }

  // Process notification
  async processNotification(item) {
    try {
      console.log(`📱 Processing notification: ${JSON.stringify(item.payload)}`);
      return true;
    } catch (error) {
      console.error('❌ Error processing notification:', error);
      return false;
    }
  }

  // Start automatic queue processing
  startProcessing(intervalMs = 30000) { // 30 seconds
    if (this.processingInterval) {
      console.log('⚠️ Queue processing already started');
      return;
    }

    console.log(`🚀 Starting queue processing (interval: ${intervalMs}ms)`);
    
    this.processingInterval = setInterval(() => {
      this.processQueue();
    }, intervalMs);
  }

  // Stop automatic queue processing
  stopProcessing() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
      console.log('🛑 Queue processing stopped');
    }
  }

  // Get queue statistics
  async getQueueStats() {
    try {
      const result = await pool.query(`
        SELECT 
          status,
          queue_type,
          COUNT(*) as count
        FROM job_queue 
        GROUP BY status, queue_type
        ORDER BY status, queue_type
      `);

      return result.rows;
    } catch (error) {
      console.error('❌ Error getting queue stats:', error);
      return [];
    }
  }

  // Clean up old completed/failed items
  async cleanup(olderThanDays = 7) {
    try {
      const result = await pool.query(`
        DELETE FROM job_queue 
        WHERE status IN ('completed', 'failed') 
        AND created_at < NOW() - INTERVAL '${olderThanDays} days'
      `);

      console.log(`🧹 Cleaned up ${result.rowCount} old queue items`);
      return result.rowCount;
    } catch (error) {
      console.error('❌ Queue cleanup error:', error);
      return 0;
    }
  }
}

// Singleton instance
const queueService = new QueueService();

module.exports = queueService;