const express = require('express');
const router = express.Router();
const {
  getDrivers,
  createDriver,
  archiveDriver,
  restoreDriver,
  getArchivedDrivers
} = require('../controllers/driverController');

// GET /api/drivers - Get all active drivers
router.get('/', getDrivers);

// POST /api/drivers - Create new driver
router.post('/', createDriver);

// PATCH /api/drivers/:id/archive - Archive driver
router.patch('/:id/archive', archiveDriver);

// PUT /api/drivers/:id/restore - Restore driver
router.put('/:id/restore', restoreDriver);

// GET /api/drivers/archived - Get archived drivers
router.get('/archived', getArchivedDrivers);

module.exports = router;