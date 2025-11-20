// src/routes/notificationRoutes.js
const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');

// GET all requests (notifications)
router.get('/requests', notificationController.getNotifications);

// GET all drivers
router.get('/drivers', notificationController.getDrivers);

// GET all vehicles
router.get('/vehicles', notificationController.getVehicles);

// PUT update request status
router.put('/requests/:id', notificationController.updateRequestStatus);

module.exports = router;