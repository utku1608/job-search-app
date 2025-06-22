// src/controllers/adminController.js

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Admin middleware - sadece admin kullanıcılar erişebilir
function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Bu işlem için admin yetkisi gerekli' });
  }
  next();
}

// Tüm ilanları getir (admin view)
async function getAllJobs(req, res) {
  try {
    const result = await pool.query(`
      SELECT j.*, u.name as creator_name, u.email as creator_email
      FROM job_postings j
      LEFT JOIN users u ON j.created_by = u.id
      ORDER BY j.created_at DESC
    `);
    
    res.json(result.rows);
  } catch (err) {
    console.error('Admin - ilanları getirme hatası:', err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
}

// İlan silme
async function deleteJob(req, res) {
  const { id } = req.params;
  
  try {
    // Önce ilan var mı kontrol et
    const checkResult = await pool.query('SELECT id FROM job_postings WHERE id = $1', [id]);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'İlan bulunamadı' });
    }

    // İlanı sil
    await pool.query('DELETE FROM job_postings WHERE id = $1', [id]);
    
    res.json({ message: 'İlan başarıyla silindi', deletedId: id });
  } catch (err) {
    console.error('Admin - ilan silme hatası:', err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
}

// İlan güncelleme
async function updateJob(req, res) {
  const { id } = req.params;
  const { title, company, city, country, preference, description } = req.body;
  
  if (!title || !company || !city || !country) {
    return res.status(400).json({ error: 'Başlık, şirket, şehir ve ülke alanları zorunlu' });
  }

  try {
    // Önce ilan var mı kontrol et
    const checkResult = await pool.query('SELECT id FROM job_postings WHERE id = $1', [id]);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'İlan bulunamadı' });
    }

    // İlanı güncelle
    const result = await pool.query(
      `UPDATE job_postings 
       SET title = $1, company = $2, city = $3, country = $4, preference = $5, description = $6, updated_at = NOW()
       WHERE id = $7 
       RETURNING *`,
      [title, company, city, country, preference, description, id]
    );
    
    res.json({ 
      message: 'İlan başarıyla güncellendi', 
      job: result.rows[0] 
    });
  } catch (err) {
    console.error('Admin - ilan güncelleme hatası:', err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
}

// Dashboard istatistikleri
async function getDashboardStats(req, res) {
  try {
    // Toplam ilan sayısı
    const totalJobsResult = await pool.query('SELECT COUNT(*) as count FROM job_postings');
    const totalJobs = parseInt(totalJobsResult.rows[0].count);

    // Toplam kullanıcı sayısı
    const totalUsersResult = await pool.query('SELECT COUNT(*) as count FROM users');
    const totalUsers = parseInt(totalUsersResult.rows[0].count);

    // Toplam başvuru sayısı
    const totalApplicationsResult = await pool.query('SELECT SUM(applications) as total FROM job_postings');
    const totalApplications = parseInt(totalApplicationsResult.rows[0].total) || 0;

    // Bu ay eklenen ilanlar
    const thisMonthJobsResult = await pool.query(`
      SELECT COUNT(*) as count 
      FROM job_postings 
      WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)
    `);
    const thisMonthJobs = parseInt(thisMonthJobsResult.rows[0].count);

    // En çok ilan olan şehirler (top 5)
    const topCitiesResult = await pool.query(`
      SELECT city, COUNT(*) as job_count 
      FROM job_postings 
      WHERE city IS NOT NULL AND city != ''
      GROUP BY city 
      ORDER BY job_count DESC 
      LIMIT 5
    `);

    // En çok ilan olan ülkeler (top 5)
    const topCountriesResult = await pool.query(`
      SELECT country, COUNT(*) as job_count 
      FROM job_postings 
      WHERE country IS NOT NULL AND country != ''
      GROUP BY country 
      ORDER BY job_count DESC 
      LIMIT 5
    `);

    // Çalışma tercihi dağılımı
    const workPreferencesResult = await pool.query(`
      SELECT preference, COUNT(*) as job_count 
      FROM job_postings 
      WHERE preference IS NOT NULL AND preference != ''
      GROUP BY preference 
      ORDER BY job_count DESC
    `);

    res.json({
      totalJobs,
      totalUsers,
      totalApplications,
      thisMonthJobs,
      topCities: topCitiesResult.rows,
      topCountries: topCountriesResult.rows,
      workPreferences: workPreferencesResult.rows
    });

  } catch (err) {
    console.error('Admin - dashboard istatistikleri hatası:', err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
}

// Kullanıcıları listele
async function getAllUsers(req, res) {
  try {
    const result = await pool.query(`
      SELECT id, name, email, role, created_at 
      FROM users 
      ORDER BY created_at DESC
    `);
    
    res.json(result.rows);
  } catch (err) {
    console.error('Admin - kullanıcıları getirme hatası:', err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
}

// Kullanıcı rolü değiştirme
async function updateUserRole(req, res) {
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
    console.error('Admin - kullanıcı rolü güncelleme hatası:', err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
}

module.exports = {
  requireAdmin,
  getAllJobs,
  deleteJob,
  updateJob,
  getDashboardStats,
  getAllUsers,
  updateUserRole
};