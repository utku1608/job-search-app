const express = require('express');
const router = express.Router();
const controller = require('../controllers/jobPostingsController');

// ÖNEMLI: /search route'u /:id'den ÖNCE olmalı
router.get('/search', controller.searchJobs);
router.get('/', controller.getAllJobs);
router.post('/', controller.createJob);
router.get('/:id', controller.getJobById);
router.put('/:id', controller.updateJob);
router.delete('/:id', controller.deleteJob);

// Job application
router.post('/:id/apply', controller.applyToJob);

module.exports = router;