const express = require('express');
const router = express.Router();
const {
  getVehicles,
  createVehicle,
  archiveVehicle,
  restoreVehicle,
  getArchivedVehicles
} = require('../controllers/vehicleController');

// GET /api/vehicles - Get all active vehicles
router.get('/', getVehicles);

// POST /api/vehicles - Create new vehicle
router.post('/', createVehicle);

// PATCH /api/vehicles/:id/archive - Archive vehicle
router.patch('/:id/archive', archiveVehicle);

// PUT /api/vehicles/:id/restore - Restore vehicle
router.put('/:id/restore', restoreVehicle);

// GET /api/vehicles/archived - Get archived vehicles
router.get('/archived', getArchivedVehicles);

module.exports = router;