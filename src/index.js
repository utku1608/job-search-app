// src/index.js - Updated with Notification Service

const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { Pool } = require('pg');
require('dotenv').config();

// Services
const schedulerService = require('./services/schedulerService');
const queueService = require('./services/queueService');

const app = express();
const PORT = process.env.PORT || 5000;

// Database connections
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// MongoDB connection
mongoose.connect(process.env.MONGODB_URL || 'mongodb://localhost:27017/jobsearch', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB connected'))
.catch(err => console.error('❌ MongoDB connection error:', err));

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Job Search API with Notification Service is running 🚀');
});

// Routes

const jobRoutes = require('./routes/jobPostings');
const authRoutes = require('./routes/auth');
const notificationRoutes = require('./routes/notifications');
const aiRoutes = require('./routes/aiRoutes'); // YENİ!

app.use('/api/jobs', jobRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/ai', aiRoutes); // YENİ!

// Authentication middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token gerekli' });
  }

  jwt.verify(token, process.env.JWT_SECRET, async (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Geçersiz token' });
    }

    try {
      // Kullanıcı bilgilerini database'den al
      const result = await pool.query('SELECT id, name, email, role FROM users WHERE id = $1', [user.userId]);
      
      if (result.rows.length === 0) {
        return res.status(403).json({ error: 'Kullanıcı bulunamadı' });
      }

      req.user = result.rows[0];
      next();
    } catch (dbErr) {
      console.error('Token verification database error:', dbErr);
      return res.status(500).json({ error: 'Sunucu hatası' });
    }
  });
}

// Admin middleware
function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Bu işlem için admin yetkisi gerekli' });
  }
  next();
}

// Enhanced job creation with queue integration
app.post('/api/jobs', authenticateToken, async (req, res) => {
  const { title, company, city, country, preference, description } = req.body;

  if (!title || !company || !city || !country || !preference) {
    return res.status(400).json({ error: 'Gerekli alanlar eksik: title, company, city, country, preference' });
  }

  try {
    // Create job
    const result = await pool.query(
      `INSERT INTO jobs (title, company, city, country, preference, description, applications) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [title, company, city, country, preference, description || '', 0]
    );

    const newJob = result.rows[0];

    // Add to notification queue
    await queueService.addJob(newJob.id, 'new_job_posting', 1, {
      action: 'job_created',
      userId: req.user.id,
      timestamp: new Date().toISOString()
    });

    res.status(201).json(newJob);
  } catch (err) {
    console.error('Job creation error:', err);
    res.status(500).json({ error: 'Veri eklenemedi' });
  }
});

// Enhanced job application with queue integration
app.post('/api/jobs/:id/apply', authenticateToken, async (req, res) => {
  const { id } = req.params;
  
  try {
    const result = await pool.query(
      'UPDATE jobs SET applications = applications + 1 WHERE id = $1 RETURNING *',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'İlan bulunamadı' });
    }
    
    const job = result.rows[0];

    // Add application to queue for processing
    await queueService.addJob(job.id, 'job_application', 2, {
      action: 'job_application',
      userId: req.user.id,
      jobId: job.id,
      userEmail: req.user.email,
      userName: req.user.name,
      timestamp: new Date().toISOString()
    });
    
    res.json({ message: 'Başvuru başarıyla gönderildi', job });
  } catch (err) {
    console.error('Application error:', err);
    res.status(500).json({ error: 'Başvuru sırasında hata oluştu' });
  }
});

// Enhanced search with history tracking
app.get('/api/jobs/search', async (req, res) => {
  const { term, city, country, preference, limit = 50, offset = 0 } = req.query;
  
  let query = 'SELECT * FROM jobs WHERE 1=1';
  let params = [];
  let paramIndex = 1;
  
  if (term) {
    query += ` AND (title ILIKE $${paramIndex} OR company ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`;
    params.push(`%${term}%`);
    paramIndex++;
  }
  
  if (city) {
    query += ` AND city ILIKE $${paramIndex}`;
    params.push(`%${city}%`);
    paramIndex++;
  }
  
  if (country) {
    query += ` AND country = $${paramIndex}`;
    params.push(country);
    paramIndex++;
  }
  
  if (preference) {
    query += ` AND preference = $${paramIndex}`;
    params.push(preference);
    paramIndex++;
  }
  
  query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  params.push(limit, offset);
  
  try {
    const result = await pool.query(query, params);
    const jobs = result.rows;

    // Store search in MongoDB (for logged-in users)
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Store search asynchronously
        const JobSearch = require('./models/jobSearchSchema');
        const jobSearch = new JobSearch({
          userId: decoded.userId,
          searchQuery: { term, city, country, preference },
          resultsCount: jobs.length,
          searchResults: jobs.slice(0, 5).map(job => ({
            jobId: job.id,
            title: job.title,
            company: job.company,
            city: job.city,
            country: job.country,
            preference: job.preference
          })),
          searchMetadata: {
            userAgent: req.headers['user-agent'],
            ipAddress: req.ip,
            source: 'search_page'
          }
        });
        
        jobSearch.save().catch(err => console.error('Search storage error:', err));
      } catch (tokenErr) {
        // Token invalid, skip search storage
      }
    }
    
    res.json(jobs);
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'Arama sırasında hata oluştu' });
  }
});

// Admin dashboard route
app.get('/api/admin/dashboard', authenticateToken, requireAdmin, async (req, res) => {
  try {
    // Toplam ilan sayısı
    const totalJobsResult = await pool.query('SELECT COUNT(*) as count FROM jobs');
    const totalJobs = parseInt(totalJobsResult.rows[0].count);

    // Toplam kullanıcı sayısı
    const totalUsersResult = await pool.query('SELECT COUNT(*) as count FROM users');
    const totalUsers = parseInt(totalUsersResult.rows[0].count);

    // Toplam başvuru sayısı
    const totalApplicationsResult = await pool.query('SELECT COALESCE(SUM(applications), 0) as total FROM jobs');
    const totalApplications = parseInt(totalApplicationsResult.rows[0].total) || 0;

    // Bu ay eklenen ilanlar
    const thisMonthJobsResult = await pool.query(`
      SELECT COUNT(*) as count 
      FROM jobs 
      WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)
    `);
    const thisMonthJobs = parseInt(thisMonthJobsResult.rows[0].count);

    // En çok ilan olan şehirler (top 5)
    const topCitiesResult = await pool.query(`
      SELECT city, COUNT(*) as job_count 
      FROM jobs 
      WHERE city IS NOT NULL AND city != ''
      GROUP BY city 
      ORDER BY job_count DESC 
      LIMIT 5
    `);

    // En çok ilan olan ülkeler (top 5)
    const topCountriesResult = await pool.query(`
      SELECT country, COUNT(*) as job_count 
      FROM jobs 
      WHERE country IS NOT NULL AND country != ''
      GROUP BY country 
      ORDER BY job_count DESC 
      LIMIT 5
    `);

    // Notification statistics
    const notificationStatsResult = await pool.query(`
      SELECT 
        COUNT(*) as total_notifications,
        COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent_notifications,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_notifications,
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '24 hours' THEN 1 END) as notifications_24h
      FROM notification_logs
    `);

    const notificationStats = notificationStatsResult.rows[0] || {
      total_notifications: 0,
      sent_notifications: 0,
      failed_notifications: 0,
      notifications_24h: 0
    };

    // Active job alerts count
    const activeAlertsResult = await pool.query(`
      SELECT COUNT(*) as count FROM job_alerts WHERE is_active = true
    `);
    const activeAlerts = parseInt(activeAlertsResult.rows[0].count);

    // Queue statistics
    const queueStats = await queueService.getQueueStats();

    res.json({
      totalJobs,
      totalUsers,
      totalApplications,
      thisMonthJobs,
      topCities: topCitiesResult.rows,
      topCountries: topCountriesResult.rows,
      notifications: {
        total: parseInt(notificationStats.total_notifications),
        sent: parseInt(notificationStats.sent_notifications),
        failed: parseInt(notificationStats.failed_notifications),
        last24h: parseInt(notificationStats.notifications_24h)
      },
      activeAlerts,
      queueStats
    });

  } catch (err) {
    console.error('Admin dashboard hatası:', err);
    res.status(500).json({ error: 'Dashboard verileri yüklenemedi: ' + err.message });
  }
});

// Admin jobs route
app.get('/api/admin/jobs', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM jobs
      ORDER BY created_at DESC
    `);
    
    res.json(result.rows);
  } catch (err) {
    console.error('Admin jobs hatası:', err);
    res.status(500).json({ error: 'İlanlar yüklenemedi: ' + err.message });
  }
});

// Admin delete job route
app.delete('/api/admin/jobs/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  
  try {
    const result = await pool.query('DELETE FROM jobs WHERE id = $1 RETURNING id', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'İlan bulunamadı' });
    }
    
    res.json({ message: 'İlan başarıyla silindi', deletedId: id });
  } catch (err) {
    console.error('Admin delete job hatası:', err);
    res.status(500).json({ error: 'İlan silinemedi: ' + err.message });
  }
});

// Admin update job route
app.put('/api/admin/jobs/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { title, company, city, country, preference, description } = req.body;
  
  if (!title || !company || !city || !country) {
    return res.status(400).json({ error: 'Başlık, şirket, şehir ve ülke alanları zorunlu' });
  }

  try {
    const result = await pool.query(
      `UPDATE jobs 
       SET title = $1, company = $2, city = $3, country = $4, preference = $5, description = $6, updated_at = NOW()
       WHERE id = $7 
       RETURNING *`,
      [title, company, city, country, preference, description, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'İlan bulunamadı' });
    }
    
    res.json({ 
      message: 'İlan başarıyla güncellendi', 
      job: result.rows[0] 
    });
  } catch (err) {
    console.error('Admin update job hatası:', err);
    res.status(500).json({ error: 'İlan güncellenemedi: ' + err.message });
  }
});

// Admin users route
app.get('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, name, email, role, created_at 
      FROM users 
      ORDER BY created_at DESC
    `);
    
    res.json(result.rows);
  } catch (err) {
    console.error('Admin users hatası:', err);
    res.status(500).json({ error: 'Kullanıcılar yüklenemedi: ' + err.message });
  }
});

// Admin update user role route
app.put('/api/admin/users/:id/role', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;
  
  if (!['user', 'admin', 'company'].includes(role)) {
    return res.status(400).json({ error: 'Geçersiz rol. user, admin veya company olmalı' });
  }

  try {
    const result = await pool.query(
      'UPDATE users SET role = $1 WHERE id = $2 RETURNING id, name, email, role',
      [role, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
    }
    
    res.json({ 
      message: 'Kullanıcı rolü başarıyla güncellendi', 
      user: result.rows[0] 
    });
  } catch (err) {
    console.error('Admin update user role hatası:', err);
    res.status(500).json({ error: 'Kullanıcı rolü güncellenemedi: ' + err.message });
  }
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    // Check PostgreSQL
    await pool.query('SELECT 1');
    
    // Check MongoDB
    const mongoState = mongoose.connection.readyState;
    
    // Check services
    const schedulerStatus = schedulerService.getStatus();
    const queueStats = await queueService.getQueueStats();

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        postgresql: 'connected',
        mongodb: mongoState === 1 ? 'connected' : 'disconnected',
        scheduler: schedulerStatus.isRunning ? 'running' : 'stopped',
        queue: 'active'
      },
      statistics: {
        scheduler: schedulerStatus,
        queue: queueStats
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Initialize services
async function initializeServices() {
  try {
    console.log('🔧 Initializing services...');
    
    // Initialize queue system
    await queueService.initialize();
    
    // Start queue processing
    queueService.startProcessing(30000); // Process every 30 seconds
    
    // Start scheduler
    schedulerService.start();
    
    console.log('✅ All services initialized successfully');
  } catch (error) {
    console.error('❌ Service initialization failed:', error);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully...');
  
  schedulerService.stop();
  queueService.stopProcessing();
  
  setTimeout(() => {
    process.exit(0);
  }, 5000);
});

process.on('SIGINT', () => {
  console.log('🛑 Received SIGINT, shutting down gracefully...');
  
  schedulerService.stop();
  queueService.stopProcessing();
  
  setTimeout(() => {
    process.exit(0);
  }, 5000);
});

// Start server
app.listen(PORT, async () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  
  // Initialize services after server starts
  await initializeServices();
});