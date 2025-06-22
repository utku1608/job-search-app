const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// GET /api/jobs
async function getAllJobs(req, res) {
  try {
    const result = await pool.query('SELECT * FROM jobs ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Veri çekme hatası:', err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
}

// GET /api/jobs/:id
async function getJobById(req, res) {
  const { id } = req.params;
  
  try {
    const result = await pool.query('SELECT * FROM jobs WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'İlan bulunamadı' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('İlan detay çekme hatası:', err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
}

// POST /api/jobs
async function createJob(req, res) {
  const { title, company, city, country, preference, description } = req.body;

  if (!title || !company || !city || !country || !preference) {
    return res.status(400).json({ error: 'Gerekli alanlar eksik: title, company, city, country, preference' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO jobs (title, company, city, country, preference, description, applications) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [title, company, city, country, preference, description || '', 0]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Ekleme hatası:', err);
    res.status(500).json({ error: 'Veri eklenemedi' });
  }
}

// PUT /api/jobs/:id
async function updateJob(req, res) {
  const { id } = req.params;
  const { title, company, city, country, preference, description } = req.body;

  try {
    const result = await pool.query(
      `UPDATE jobs 
       SET title = $1, company = $2, city = $3, country = $4, preference = $5, description = $6, updated_at = CURRENT_TIMESTAMP
       WHERE id = $7 
       RETURNING *`,
      [title, company, city, country, preference, description, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'İlan bulunamadı' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Güncelleme hatası:', err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
}

// DELETE /api/jobs/:id
async function deleteJob(req, res) {
  const { id } = req.params;

  try {
    const result = await pool.query(
      'DELETE FROM jobs WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'İlan bulunamadı' });
    }

    res.json({ message: 'İlan başarıyla silindi', deletedJob: result.rows[0] });
  } catch (err) {
    console.error('Silme hatası:', err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
}

// Search jobs with filters
async function searchJobs(req, res) {
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
    res.json(result.rows);
  } catch (err) {
    console.error('Arama hatası:', err);
    res.status(500).json({ error: 'Arama sırasında hata oluştu' });
  }
}

// Increment application count
async function applyToJob(req, res) {
  const { id } = req.params;
  
  try {
    const result = await pool.query(
      'UPDATE jobs SET applications = applications + 1 WHERE id = $1 RETURNING *',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'İlan bulunamadı' });
    }
    
    res.json({ message: 'Başvuru başarıyla gönderildi', job: result.rows[0] });
  } catch (err) {
    console.error('Başvuru hatası:', err);
    res.status(500).json({ error: 'Başvuru sırasında hata oluştu' });
  }
}

module.exports = {
  getAllJobs,
  getJobById,
  createJob,
  updateJob,
  deleteJob,
  searchJobs,
  applyToJob
};