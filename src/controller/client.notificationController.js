// src/controllers/notificationController.js
const notificationService = require('../services/notificationService');

class NotificationController {
  async getNotifications(req, res) {
    try {
      const requests = await notificationService.getRequests();
      res.json(requests);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      res.status(500).json({ error: 'Failed to fetch notifications' });
    }
  }

  async getDrivers(req, res) {
    try {
      const drivers = await notificationService.getDrivers();
      res.json(drivers);
    } catch (error) {
      console.error('Error fetching drivers:', error);
      res.status(500).json({ error: 'Failed to fetch drivers' });
    }
  }

  async getVehicles(req, res) {
    try {
      const vehicles = await notificationService.getVehicles();
      res.json(vehicles);
    } catch (error) {
      console.error('Error fetching vehicles:', error);
      res.status(500).json({ error: 'Failed to fetch vehicles' });
    }
  }

  async updateRequestStatus(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;
      const updatedRequest = await notificationService.updateRequestStatus(id, updateData);
      res.json(updatedRequest);
    } catch (error) {
      console.error('Error updating request status:', error);
      res.status(500).json({ error: 'Failed to update request status' });
    }
  }
}

module.exports = new NotificationController();