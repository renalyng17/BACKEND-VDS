const express = require('express');
const router = express.Router();
const { getProfile, updateProfile } = require('../src/controller/profileController');

router.get('/', getProfile);
router.patch('/', updateProfile);

module.exports = router;