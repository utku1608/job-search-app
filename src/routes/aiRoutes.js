// src/routes/aiRoutes.js

const express = require('express');
const { chatWithAI } = require('../controllers/aiController');
const router = express.Router();

// AI Chat endpoint
router.post('/chat', chatWithAI);

module.exports = router;