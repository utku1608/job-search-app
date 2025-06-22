// src/controllers/authController.js

const { Pool } = require('pg');
const bcrypt = require("bcryptjs");
const jwt = require('jsonwebtoken');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';

// Register new user
async function register(req, res) {
  const { name, email, password, role = 'user' } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'İsim, email ve şifre gerekli' });
  }

  try {
    // Check if user already exists
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Bu email zaten kullanılıyor' });
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user
    const result = await pool.query(
      'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role',
      [name, email, hashedPassword, role]
    );

    const user = result.rows[0];

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      message: 'Kullanıcı başarıyla oluşturuldu',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      token
    });

  } catch (err) {
    console.error('Kayıt hatası:', err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
}

// Login user
async function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email ve şifre gerekli' });
  }

  try {
    // Find user
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Geçersiz email veya şifre' });
    }

    const user = result.rows[0];

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Geçersiz email veya şifre' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Giriş başarılı',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      token
    });

  } catch (err) {
    console.error('Giriş hatası:', err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
}

// Get current user info
async function getMe(req, res) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'Token gerekli' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const result = await pool.query(
      'SELECT id, name, email, role FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
    }

    res.json({ user: result.rows[0] });

  } catch (err) {
    console.error('Token doğrulama hatası:', err);
    res.status(401).json({ error: 'Geçersiz token' });
  }
}

// Middleware to verify JWT token
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token gerekli' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      console.error('🔴 JWT verification error:', err);
      return res.status(403).json({ error: 'Geçersiz token' });
    }
    
    console.log('🔐 Decoded token:', decoded);
    
    // Token'dan gelen userId'yi id'ye çevir
    req.user = {
      id: decoded.userId,    // userId -> id
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role
    };
    
    console.log('👤 Set req.user:', req.user);
    next();
  });
}

module.exports = {
  register,
  login,
  getMe,
  authenticateToken
};