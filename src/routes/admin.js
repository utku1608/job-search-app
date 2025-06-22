// src/routes/admin.js

const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const authController = require('../controllers/authController');

// Tüm admin route'ları için authentication ve admin kontrolü
router.use(authController.authenticateToken);
router.use(adminController.requireAdmin);

// Dashboard istatistikleri
router.get('/dashboard', adminController.getDashboardStats);

// İlan yönetimi
router.get('/jobs', adminController.getAllJobs);
router.delete('/jobs/:id', adminController.deleteJob);
router.put('/jobs/:id', adminController.updateJob);

// Kullanıcı yönetimi
router.get('/users', adminController.getAllUsers);
router.put('/users/:id/role', adminController.updateUserRole);

module.exports = router;