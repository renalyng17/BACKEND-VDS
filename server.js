const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

const corsOptions = {
  origin: 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// In-memory storage (replace with database in production)
let requests = [];
let notifications = [];

// Add archived arrays
let archivedVehicles = [];
let archivedDrivers = [];

// Initialize main arrays
let drivers = [];
let vehicles = [];

// Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK' });
});

// ========================
// VEHICLE ROUTES
// ========================

// Get all active vehicles
app.get('/api/vehicles', (req, res) => {
  res.json(vehicles.filter(v => !v.archivedAt));
});

// Create new vehicle
app.post('/api/vehicles', (req, res) => {
  try {
    const { vehicleType, plateNo, capacity, fuelType, fleetCard, rfid } = req.body;

    // Validate required fields
    if (!vehicleType || !plateNo || !capacity || !fuelType) {
      return res.status(400).json({
        error: "Missing required fields: vehicleType, plateNo, capacity, fuelType"
      });
    }

    // Normalize plate number
    const normalizedPlateNo = plateNo.trim().toUpperCase();

    // Check for duplicate plate number
    const existingVehicle = vehicles.find(
      v => v.plateNo && v.plateNo.toUpperCase() === normalizedPlateNo && !v.archivedAt
    );

    if (existingVehicle) {
      return res.status(409).json({ error: "Vehicle with this plate number already exists" });
    }

    const newVehicle = {
      id: Date.now(),
      vehicleType: vehicleType.trim(),
      plateNo: normalizedPlateNo,
      capacity: parseInt(capacity),
      fuelType: fuelType,
      fleetCard: fleetCard || "Unavailable",
      rfid: rfid || "Unavailable",
      createdAt: new Date().toISOString()
    };

    vehicles.push(newVehicle);
    res.status(201).json(newVehicle);

  } catch (error) {
    console.error("Create vehicle error:", error);
    res.status(500).json({ error: "Failed to create vehicle" });
  }
});

// Archive vehicle
app.patch('/api/vehicles/:id/archive', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const vehicleIndex = vehicles.findIndex(v => v.id === id && !v.archivedAt);

    if (vehicleIndex === -1) {
      return res.status(404).json({ error: "Vehicle not found or already archived" });
    }

    vehicles[vehicleIndex].archivedAt = new Date().toISOString();
    res.json(vehicles[vehicleIndex]);

  } catch (error) {
    console.error("Archive vehicle error:", error);
    res.status(500).json({ error: "Failed to archive vehicle" });
  }
});

// Restore vehicle
app.patch('/api/vehicles/:id/restore', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const vehicleIndex = vehicles.findIndex(v => v.id === id && v.archivedAt);

    if (vehicleIndex === -1) {
      return res.status(404).json({ error: "Archived vehicle not found" });
    }

    delete vehicles[vehicleIndex].archivedAt;
    res.json(vehicles[vehicleIndex]);

  } catch (error) {
    console.error("Restore vehicle error:", error);
    res.status(500).json({ error: "Failed to restore vehicle" });
  }
});

// Get archived vehicles
app.get('/api/vehicles/archived', (req, res) => {
  res.json(vehicles.filter(v => v.archivedAt));
});

// ========================
// DRIVER ROUTES
// ========================

// Get all active drivers
app.get('/api/drivers', (req, res) => {
  res.json(drivers.filter(d => !d.archivedAt));
});

// Create new driver
app.post('/api/drivers', (req, res) => {
  try {
    const { name, contact, email } = req.body;

    if (!name || !contact || !email) {
      return res.status(400).json({ error: "Missing required fields: name, contact, email" });
    }

    // Check for duplicate email
    const existingDriver = drivers.find(
      d => d.email && d.email.toLowerCase() === email.toLowerCase() && !d.archivedAt
    );

    if (existingDriver) {
      return res.status(409).json({ error: "Driver with this email already exists" });
    }

    const newDriver = {
      id: Date.now(),
      name: name.trim(),
      contact: contact.trim(),
      email: email.toLowerCase().trim(),
      is_assigned: true,
      createdAt: new Date().toISOString()
    };

    drivers.push(newDriver);
    res.status(201).json(newDriver);

  } catch (error) {
    console.error("Create driver error:", error);
    res.status(500).json({ error: "Failed to create driver" });
  }
});

// Archive driver
app.patch('/api/drivers/:id/archive', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const driverIndex = drivers.findIndex(d => d.id === id && !d.archivedAt);

    if (driverIndex === -1) {
      return res.status(404).json({ error: "Driver not found or already archived" });
    }

    drivers[driverIndex].archivedAt = new Date().toISOString();
    drivers[driverIndex].is_assigned = false;
    res.json(drivers[driverIndex]);

  } catch (error) {
    console.error("Archive driver error:", error);
    res.status(500).json({ error: "Failed to archive driver" });
  }
});

// Restore driver
app.patch('/api/drivers/:id/restore', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const driverIndex = drivers.findIndex(d => d.id === id && d.archivedAt);

    if (driverIndex === -1) {
      return res.status(404).json({ error: "Archived driver not found" });
    }

    delete drivers[driverIndex].archivedAt;
    drivers[driverIndex].is_assigned = true;
    res.json(drivers[driverIndex]);

  } catch (error) {
    console.error("Restore driver error:", error);
    res.status(500).json({ error: "Failed to restore driver" });
  }
});

// Get archived drivers
app.get('/api/drivers/archived', (req, res) => {
  res.json(drivers.filter(d => d.archivedAt));
});

// ========================
// REQUEST ROUTES
// ========================

// Get all requests
app.get('/api/requests', (req, res) => {
  res.json(requests);
});

// Get single request
app.get('/api/requests/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const request = requests.find(r => r.id === id);

    if (request) {
      res.json(request);
    } else {
      res.status(404).json({ error: "Request not found" });
    }
  } catch (error) {
    console.error("Get request error:", error);
    res.status(500).json({ error: "Failed to fetch request" });
  }
});

// Create new request
app.post('/api/requests', (req, res) => {
  try {
    const { destination, names, requestingOffice, fromDate, fromTime, toDate, toTime } = req.body;

    // Validate required fields
    if (!destination || !names || !requestingOffice || !fromDate || !toDate) {
      return res.status(400).json({ 
        error: "Missing required fields: destination, names, requestingOffice, fromDate, toDate" 
      });
    }

    const newRequest = {
      id: Date.now(),
      destination: destination.trim(),
      names: Array.isArray(names) ? names : [names],
      requestingOffice: requestingOffice.trim(),
      fromDate,
      fromTime: fromTime || "",
      toDate,
      toTime: toTime || "",
      status: "Pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    requests.push(newRequest);

    // Create notification
    const notification = {
      id: Date.now(),
      requestId: newRequest.id,
      type: "new_request",
      message: `New travel request to ${newRequest.destination} from ${newRequest.requestingOffice}`,
      read: false,
      createdAt: new Date().toISOString()
    };

    notifications.push(notification);

    res.status(201).json(newRequest);

  } catch (error) {
    console.error("Create request error:", error);
    res.status(500).json({ error: "Failed to create request" });
  }
});

// Update request status
app.put('/api/requests/:id/status', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const requestIndex = requests.findIndex(r => r.id === id);

    if (requestIndex === -1) {
      return res.status(404).json({ error: "Request not found" });
    }

    const { status, driver_name, contact_no, vehicle_type, plate_no, reason_for_decline } = req.body;

    // Update request
    requests[requestIndex].status = status;
    requests[requestIndex].updatedAt = new Date().toISOString();

    if (status === "Accepted") {
      requests[requestIndex].driver = driver_name;
      requests[requestIndex].driverContact = contact_no;
      requests[requestIndex].vehicleType = vehicle_type;
      requests[requestIndex].plateNo = plate_no;
      // Clear decline reason if any
      delete requests[requestIndex].reason;
    } else if (status === "Declined") {
      requests[requestIndex].reason = reason_for_decline;
      // Clear driver/vehicle info if any
      delete requests[requestIndex].driver;
      delete requests[requestIndex].driverContact;
      delete requests[requestIndex].vehicleType;
      delete requests[requestIndex].plateNo;
    }

    // Create status notification
    const notification = {
      id: Date.now(),
      requestId: id,
      type: "status_update",
      message: `Request to ${requests[requestIndex].destination} has been ${status.toLowerCase()}`,
      read: false,
      createdAt: new Date().toISOString()
    };

    // Add driver and vehicle info to notification for accepted requests
    if (status === "Accepted") {
      notification.driver = driver_name;
      notification.vehicleType = vehicle_type;
      notification.plateNo = plate_no;
    } else if (status === "Declined") {
      notification.reason = reason_for_decline;
    }

    notifications.push(notification);

    res.json(requests[requestIndex]);

  } catch (error) {
    console.error("Update request error:", error);
    res.status(500).json({ error: "Failed to update request" });
  }
});

// Delete request
app.delete('/api/requests/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const requestIndex = requests.findIndex(r => r.id === id);

    if (requestIndex === -1) {
      return res.status(404).json({ error: "Request not found" });
    }

    requests.splice(requestIndex, 1);
    res.json({ message: "Request deleted successfully" });

  } catch (error) {
    console.error("Delete request error:", error);
    res.status(500).json({ error: "Failed to delete request" });
  }
});

// ========================
// NOTIFICATION ROUTES
// ========================

// Get all notifications
app.get('/api/notifications', (req, res) => {
  res.json(notifications);
});

// Mark notification as read
app.put('/api/notifications/:id/read', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const notificationIndex = notifications.findIndex(n => n.id === id);

    if (notificationIndex === -1) {
      return res.status(404).json({ error: "Notification not found" });
    }

    notifications[notificationIndex].read = true;
    res.json(notifications[notificationIndex]);

  } catch (error) {
    console.error("Mark notification as read error:", error);
    res.status(500).json({ error: "Failed to update notification" });
  }
});

// Get unread notifications count
app.get('/api/notifications/unread/count', (req, res) => {
  try {
    const count = notifications.filter(n => !n.read).length;
    res.json({ count });
  } catch (error) {
    console.error("Get unread count error:", error);
    res.status(500).json({ error: "Failed to get unread count" });
  }
});

// Mark all notifications as read
app.put('/api/notifications/mark-all-read', (req, res) => {
  try {
    notifications.forEach(notification => {
      notification.read = true;
    });
    
    res.json({ message: "All notifications marked as read" });
  } catch (error) {
    console.error("Mark all as read error:", error);
    res.status(500).json({ error: "Failed to mark all notifications as read" });
  }
});

// Mount the auth router (if exists)
try {
  const authRouter = require('./routes/auth');
  console.log("Mounting /api/auth");
  app.use('/api/auth', authRouter);
} catch (err) {
  console.warn('Auth router not found or failed to load:', err.message);
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err.stack);
  res.status(500).json({ error: 'Something went wrong on the server!' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));