// src/controllers/notificationController.js
const notificationService = require('../services/notificationService');

// Helper: validate if a string looks like a valid integer ID
const isValidId = (id) => {
  return id != null && String(id).trim() !== '' && /^\d+$/.test(String(id).trim());
};

// Allowed fields for status update (prevent overposting)
const ALLOWED_UPDATE_FIELDS = [
  'status',
  'driver_name',
  'contact_no',
  'vehicle_type',
  'plate_no',
  'reason_for_decline'
];

class NotificationController {
  async getNotifications(req, res) {
    try {
      const requests = await notificationService.getRequests();
      res.json(requests);
    } catch (error) {
      console.error('Error fetching notifications:', {
        error: error.message,
        stack: error.stack,
        userId: req.user?.id
      });
      res.status(500).json({ error: 'Failed to fetch notifications' });
    }
  }

  async getDrivers(req, res) {
    try {
      const drivers = await notificationService.getDrivers();
      res.json(drivers);
    } catch (error) {
      console.error('Error fetching drivers:', {
        error: error.message,
        stack: error.stack,
        userId: req.user?.id
      });
      res.status(500).json({ error: 'Failed to fetch drivers' });
    }
  }

  async getVehicles(req, res) {
    try {
      const vehicles = await notificationService.getVehicles();
      res.json(vehicles);
    } catch (error) {
      console.error('Error fetching vehicles:', {
        error: error.message,
        stack: error.stack,
        userId: req.user?.id
      });
      res.status(500).json({ error: 'Failed to fetch vehicles' });
    }
  }

  async updateRequestStatus(req, res) {
    try {
      const { id } = req.params;

      // ✅ Validate request ID
      if (!isValidId(id)) {
        return res.status(400).json({ error: 'Valid numeric request ID is required' });
      }

      const updateData = req.body;

      // ✅ Validate status if provided
      if (updateData.status) {
        const allowedStatuses = ['Accepted', 'Declined'];
        if (!allowedStatuses.includes(updateData.status)) {
          return res.status(400).json({ error: 'Status must be either "Accepted" or "Declined"' });
        }
      }

      // ✅ Whitelist allowed fields to prevent overposting
      const sanitizedData = {};
      for (const field of ALLOWED_UPDATE_FIELDS) {
        if (field in updateData) {
          sanitizedData[field] = updateData[field];
        }
      }

      // Optional: Require at least one field to update
      if (Object.keys(sanitizedData).length === 0) {
        return res.status(400).json({ error: 'No valid update fields provided' });
      }

      const updatedRequest = await notificationService.updateRequestStatus(id, sanitizedData);

      if (!updatedRequest) {
        return res.status(404).json({ error: 'Request not found' });
      }

      res.json(updatedRequest);
    } catch (error) {
      console.error('Error updating request status:', {
        error: error.message,
        stack: error.stack,
        requestId: req.params.id,
        userId: req.user?.id,
        body: req.body
      });

      // Return generic error to client (avoid leaking internal details)
      res.status(500).json({ error: 'Failed to update request status' });
    }
  }
}

module.exports = new NotificationController();