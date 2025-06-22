// src/controllers/notificationController.js

const { Pool } = require('pg');
const JobSearch = require('../models/jobSearchSchema');
const nodemailer = require('nodemailer');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Email transporter setup
const transporter = nodemailer.createTransport({
  service: 'gmail', // or your preferred email service
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

// Create Job Alert
async function createJobAlert(req, res) {
  try {
    console.log('🔔 Creating job alert - START');
    console.log('👤 req.user:', req.user);
    console.log('📤 Request body:', req.body);
    console.log('🔑 Authorization header:', req.headers.authorization);
    
    // Eğer req.user yoksa hata ver
    if (!req.user || !req.user.id) {
      console.log('❌ No user found in request');
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    const { alert_name, keywords, city, country, preference, min_salary, max_salary, frequency, is_active } = req.body;
    
    console.log('💾 About to insert with user_id:', req.user.id);
    
    const result = await pool.query(
      `INSERT INTO job_alerts (user_id, alert_name, keywords, city, country, preference, min_salary, max_salary, frequency, is_active, created_at, updated_at) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) 
       RETURNING *`,
      [
        req.user.id,
        alert_name,
        keywords,
        city,
        country,
        preference,
        min_salary,
        max_salary,
        frequency || 'daily',
        is_active !== false,
        new Date(),
        new Date()
      ]
    );
    
    console.log('✅ Database insert successful:', result.rows[0]);
    
    res.status(201).json({
      message: 'Job alert oluşturuldu',
      alert: result.rows[0]
    });
    
  } catch (error) {
    console.error('❌ Create job alert error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

// Get User's Job Alerts
async function getUserJobAlerts(req, res) {
  const userId = req.user.id;

  try {
    const result = await pool.query(
      'SELECT * FROM job_alerts WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Get job alerts error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// Update Job Alert
async function updateJobAlert(req, res) {
  const { id } = req.params;
  const userId = req.user.id;
  const {
    alert_name,
    keywords,
    city,
    country,
    preference,
    company,
    min_salary,
    max_salary,
    is_active
  } = req.body;

  try {
    const result = await pool.query(
      `UPDATE job_alerts 
       SET alert_name = $1, keywords = $2, city = $3, country = $4, 
           preference = $5, company = $6, min_salary = $7, max_salary = $8, 
           is_active = $9, updated_at = NOW()
       WHERE id = $10 AND user_id = $11 
       RETURNING *`,
      [alert_name, keywords, city, country, preference, company, min_salary, max_salary, is_active, id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Job alert not found' });
    }

    res.json({
      message: 'Job alert updated successfully',
      alert: result.rows[0]
    });
  } catch (err) {
    console.error('Update job alert error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// Delete Job Alert
async function deleteJobAlert(req, res) {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    const result = await pool.query(
      'DELETE FROM job_alerts WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Job alert not found' });
    }

    res.json({ message: 'Job alert deleted successfully' });
  } catch (err) {
    console.error('Delete job alert error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// Store Job Search (MongoDB)
async function storeJobSearch(req, res) {
  const userId = req.user ? req.user.id : null;
  const {
    searchQuery,
    resultsCount,
    searchResults,
    searchMetadata
  } = req.body;

  try {
    const jobSearch = new JobSearch({
      userId,
      searchQuery,
      resultsCount,
      searchResults,
      searchMetadata
    });

    await jobSearch.save();

    res.status(201).json({
      message: 'Search stored successfully',
      searchId: jobSearch._id
    });
  } catch (err) {
    console.error('Store job search error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// Get User's Search History
async function getUserSearchHistory(req, res) {
  const userId = req.user.id;
  const { limit = 20, page = 1 } = req.query;

  try {
    const skip = (page - 1) * limit;
    
    const searches = await JobSearch
      .find({ userId })
      .sort({ searchedAt: -1 })
      .limit(parseInt(limit))
      .skip(skip)
      .select('searchQuery resultsCount searchedAt searchSummary');

    const total = await JobSearch.countDocuments({ userId });

    res.json({
      searches,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error('Get search history error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// Check for matching jobs and send notifications
async function checkAndSendJobAlerts() {
  try {
    console.log('🔍 Starting job alert check...');

    // Get all active job alerts
    const alertsResult = await pool.query(`
      SELECT ja.*, u.email, u.name 
      FROM job_alerts ja
      JOIN users u ON ja.user_id = u.id
      WHERE ja.is_active = true
    `);

    const alerts = alertsResult.rows;
    console.log(`📋 Found ${alerts.length} active job alerts`);

    for (const alert of alerts) {
      await processJobAlert(alert);
    }

    console.log('✅ Job alert check completed');
  } catch (err) {
    console.error('❌ Job alert check error:', err);
  }
}

// Process individual job alert
async function processJobAlert(alert) {
  try {
    // Build query to find matching jobs
    let query = `
      SELECT * FROM jobs 
      WHERE created_at > COALESCE($1, '1970-01-01'::timestamp)
    `;
    const params = [alert.last_notification_sent];
    let paramIndex = 2;

    // Add filters based on alert criteria
    if (alert.keywords) {
      query += ` AND (title ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`;
      params.push(`%${alert.keywords}%`);
      paramIndex++;
    }

    if (alert.city) {
      query += ` AND city ILIKE $${paramIndex}`;
      params.push(`%${alert.city}%`);
      paramIndex++;
    }

    if (alert.country) {
      query += ` AND country = $${paramIndex}`;
      params.push(alert.country);
      paramIndex++;
    }

    if (alert.preference) {
      query += ` AND preference = $${paramIndex}`;
      params.push(alert.preference);
      paramIndex++;
    }

    if (alert.company) {
      query += ` AND company ILIKE $${paramIndex}`;
      params.push(`%${alert.company}%`);
      paramIndex++;
    }

    query += ' ORDER BY created_at DESC LIMIT 10';

    const matchingJobs = await pool.query(query, params);

    if (matchingJobs.rows.length > 0) {
      await sendJobAlertNotification(alert, matchingJobs.rows);
      
      // Update last notification sent time
      await pool.query(
        'UPDATE job_alerts SET last_notification_sent = NOW() WHERE id = $1',
        [alert.id]
      );
    }
  } catch (err) {
    console.error(`❌ Error processing alert ${alert.id}:`, err);
  }
}

// Send job alert notification
async function sendJobAlertNotification(alert, jobs) {
  try {
    const subject = `🔔 ${jobs.length} new job${jobs.length > 1 ? 's' : ''} matching "${alert.alert_name}"`;
    
    let emailBody = `
      <h2>Hi ${alert.name}!</h2>
      <p>We found ${jobs.length} new job posting${jobs.length > 1 ? 's' : ''} that match your alert "<strong>${alert.alert_name}</strong>":</p>
      <div style="margin: 20px 0;">
    `;

    jobs.forEach(job => {
      emailBody += `
        <div style="border: 1px solid #ddd; padding: 15px; margin: 10px 0; border-radius: 5px;">
          <h3 style="margin: 0 0 10px 0; color: #007bff;">${job.title}</h3>
          <p style="margin: 5px 0;"><strong>${job.company}</strong></p>
          <p style="margin: 5px 0;">📍 ${job.city}, ${job.country}</p>
          <p style="margin: 5px 0;">💼 ${job.preference}</p>
          <p style="margin: 10px 0; color: #666;">${job.description ? job.description.substring(0, 200) + '...' : ''}</p>
          <a href="${process.env.FRONTEND_URL}/jobs/${job.id}" style="background-color: #007bff; color: white; padding: 8px 16px; text-decoration: none; border-radius: 4px;">View Job</a>
        </div>
      `;
    });

    emailBody += `
      </div>
      <p style="color: #666; font-size: 14px;">
        You're receiving this because you have an active job alert. 
        <a href="${process.env.FRONTEND_URL}/profile/alerts">Manage your alerts</a>
      </p>
    `;

   // DEMO: Email gönderimi yerine console log
console.log('📧 DEMO: Email would be sent to:', alert.email);
console.log('📧 DEMO: Subject:', subject);
console.log('📧 DEMO: Email content preview:', emailBody.substring(0, 200) + '...');
console.log('🔔 DEMO: Job alert notification prepared for', jobs.length, 'jobs');

    // Log notification
    for (const job of jobs) {
      await pool.query(
        `INSERT INTO notification_logs (user_id, job_alert_id, job_id, type, title, message, status, sent_at)
         VALUES ($1, $2, $3, 'job_alert', $4, $5, 'sent', NOW())`,
        [alert.user_id, alert.id, job.id, subject, `Job alert notification for ${job.title}`]
      );
    }

    console.log(`📧 Sent job alert notification to ${alert.email} for ${jobs.length} jobs`);
  } catch (err) {
    console.error(`❌ Error sending notification to ${alert.email}:`, err);
    
    // Log failed notification
    await pool.query(
      `INSERT INTO notification_logs (user_id, job_alert_id, type, title, message, status, error_message)
       VALUES ($1, $2, 'job_alert', $3, $4, 'failed', $5)`,
      [alert.user_id, alert.id, 'Job Alert Failed', 'Failed to send job alert notification', err.message]
    );
  }
}

// Send related job notifications based on search history
async function sendRelatedJobNotifications() {
  try {
    console.log('🔍 Starting related job notifications check...');

    // Get recent search patterns
    const recentSearches = await JobSearch.aggregate([
      {
        $match: {
          searchedAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Last 7 days
        }
      },
      {
        $group: {
          _id: '$userId',
          searches: { $push: '$searchQuery' },
          lastSearch: { $max: '$searchedAt' }
        }
      },
      {
        $match: {
          _id: { $ne: null } // Only logged-in users
        }
      }
    ]);

    console.log(`📊 Found ${recentSearches.length} users with recent searches`);

    for (const userSearchData of recentSearches) {
      await processRelatedJobNotifications(userSearchData);
    }

    console.log('✅ Related job notifications check completed');
  } catch (err) {
    console.error('❌ Related job notifications error:', err);
  }
}

// Process related job notifications for a user
async function processRelatedJobNotifications(userSearchData) {
  try {
    const userId = userSearchData._id;
    
    // Get user details
    const userResult = await pool.query(
      'SELECT name, email FROM users WHERE id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) return;
    
    const user = userResult.rows[0];
    
    // Analyze search patterns and find related jobs
    const searchPatterns = userSearchData.searches;
    const relatedJobs = await findRelatedJobs(searchPatterns);
    
    if (relatedJobs.length > 0) {
      await sendRelatedJobsEmail(user, relatedJobs, userId);
    }
  } catch (err) {
    console.error(`❌ Error processing related jobs for user ${userSearchData._id}:`, err);
  }
}

// Find related jobs based on search patterns
async function findRelatedJobs(searchPatterns) {
  try {
    // Extract common search terms, cities, preferences
    const cities = [...new Set(searchPatterns.map(s => s.city).filter(Boolean))];
    const countries = [...new Set(searchPatterns.map(s => s.country).filter(Boolean))];
    const preferences = [...new Set(searchPatterns.map(s => s.preference).filter(Boolean))];
    const terms = searchPatterns.map(s => s.term).filter(Boolean);
    
    let query = `
      SELECT DISTINCT j.* FROM jobs j
      WHERE j.created_at > NOW() - INTERVAL '3 days'
    `;
    const params = [];
    let paramIndex = 1;
    const conditions = [];

    // Add location-based matching
    if (cities.length > 0) {
      conditions.push(`j.city = ANY($${paramIndex})`);
      params.push(cities);
      paramIndex++;
    }

    if (countries.length > 0) {
      conditions.push(`j.country = ANY($${paramIndex})`);
      params.push(countries);
      paramIndex++;
    }

    // Add preference matching
    if (preferences.length > 0) {
      conditions.push(`j.preference = ANY($${paramIndex})`);
      params.push(preferences);
      paramIndex++;
    }

    // Add keyword matching
    if (terms.length > 0) {
      const keywordConditions = terms.map(term => {
        const condition = `(j.title ILIKE $${paramIndex} OR j.description ILIKE $${paramIndex})`;
        params.push(`%${term}%`);
        paramIndex++;
        return condition;
      });
      conditions.push(`(${keywordConditions.join(' OR ')})`);
    }

    if (conditions.length > 0) {
      query += ` AND (${conditions.join(' OR ')})`;
    }

    query += ' ORDER BY j.created_at DESC LIMIT 5';

    const result = await pool.query(query, params);
    return result.rows;
  } catch (err) {
    console.error('Error finding related jobs:', err);
    return [];
  }
}

// Send related jobs email
async function sendRelatedJobsEmail(user, jobs, userId) {
  try {
    const subject = `💡 Jobs you might be interested in`;
    
    let emailBody = `
      <h2>Hi ${user.name}!</h2>
      <p>Based on your recent job searches, we found some positions that might interest you:</p>
      <div style="margin: 20px 0;">
    `;

    jobs.forEach(job => {
      emailBody += `
        <div style="border: 1px solid #ddd; padding: 15px; margin: 10px 0; border-radius: 5px;">
          <h3 style="margin: 0 0 10px 0; color: #28a745;">${job.title}</h3>
          <p style="margin: 5px 0;"><strong>${job.company}</strong></p>
          <p style="margin: 5px 0;">📍 ${job.city}, ${job.country}</p>
          <p style="margin: 5px 0;">💼 ${job.preference}</p>
          <p style="margin: 10px 0; color: #666;">${job.description ? job.description.substring(0, 200) + '...' : ''}</p>
          <a href="${process.env.FRONTEND_URL}/jobs/${job.id}" style="background-color: #28a745; color: white; padding: 8px 16px; text-decoration: none; border-radius: 4px;">View Job</a>
        </div>
      `;
    });

    emailBody += `
      </div>
      <p style="color: #666; font-size: 14px;">
        These recommendations are based on your search history. 
        <a href="${process.env.FRONTEND_URL}/profile/alerts">Create job alerts</a> to get notified about new relevant positions.
      </p>
    `;

    // DEMO: Email gönderimi yerine console log
console.log('📧 DEMO: Related jobs email would be sent to:', user.email);
console.log('📧 DEMO: Subject:', subject);
console.log('📧 DEMO: Related jobs count:', jobs.length);
console.log('💡 DEMO: Related job notification prepared');

    // Log notification
    for (const job of jobs) {
      await pool.query(
        `INSERT INTO notification_logs (user_id, job_id, type, title, message, status, sent_at)
         VALUES ($1, $2, 'related_job', $3, $4, 'sent', NOW())`,
        [userId, job.id, subject, `Related job recommendation: ${job.title}`]
      );
    }

    console.log(`📧 Sent related jobs notification to ${user.email} for ${jobs.length} jobs`);
  } catch (err) {
    console.error(`❌ Error sending related jobs to ${user.email}:`, err);
  }
}

module.exports = {
  createJobAlert,
  getUserJobAlerts,
  updateJobAlert,
  deleteJobAlert,
  storeJobSearch,
  getUserSearchHistory,
  checkAndSendJobAlerts,
  sendRelatedJobNotifications
};