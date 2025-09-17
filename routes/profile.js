// routes/profile.js
const express = require('express');
const router = express.Router();
const profileController = require('../src/controller/profileController');
const { protect } = require('../middleware/authMiddleware');

// Protected routes
router.get('/', protect, profileController.getProfile);
router.put('/', protect, profileController.updateProfile);

module.exports = router;