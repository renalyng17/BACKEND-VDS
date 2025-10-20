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

  // Get all requests
  app.get('/api/requests', (req, res) => {
    res.json(requests);
  });

  // Create a new request
  app.post('/api/requests', (req, res) => {
    try {
      const newRequest = {
        id: Date.now(),
        ...req.body,
        status: "Pending",
        date: new Date().toISOString().split('T')[0]
      };

      requests.push(newRequest);

      // Create a notification for the new request
      const notification = {
        id: Date.now(),
        requestId: newRequest.id,
        type: "new_request",
        message: `New travel request to ${newRequest.destination}`,
        timestamp: new Date().toISOString(),
        read: false
      };

      notifications.push(notification);

      res.status(201).json(newRequest);
    } catch (error) {
      console.error("Create request error:", error);
      res.status(500).json({ error: "Failed to create request" });
    }
  });

  // Get all notifications
  app.get('/api/notifications', (req, res) => {
    res.json(notifications);
  });

  // Update notification as read
 // Get pending requests as notifications
app.get('/api/notifications', (req, res) => {
  try {
    const pending = requests.filter(req => req.status === "Pending");
    const enriched = pending.map(req => ({
      ...req,
      message: `New travel request from ${req.name || 'Unknown'} (${req.department || 'N/A'}) to ${req.destination || 'Unknown'}.`,
      timestamp: req.date ? new Date(req.date).toISOString() : new Date().toISOString(),
      read: false
    }));
    res.json(enriched);
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({ error: "Server error" });
  }
});
  // Update request status (Accept/Decline)
  app.put('/api/requests/:id', (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const request = requests.find(r => r.id === id);

      if (request) {
        const { status, driver, vehicleType, plateNo, reason } = req.body;

        request.status = status;
        request.processedDate = new Date().toISOString().split('T')[0];

        if (status === "Accepted") {
          request.driver = driver;
          request.vehicleType = vehicleType;
          request.plateNo = plateNo;
        } else if (status === "Declined") {
          request.reason = reason;
        }

        // Create a notification for the status update
        const notification = {
          id: Date.now(),
          requestId: request.id,
          type: "status_update",
          message: `Request to ${request.destination} has been ${status}`,
          timestamp: new Date().toISOString(),
          read: false
        };

        notifications.push(notification);

        res.json(request);
      } else {
        res.status(404).json({ error: "Request not found" });
      }
    } catch (error) {
      console.error("Update request error:", error);
      res.status(500).json({ error: "Failed to update request" });
    }
  });

  // Get available drivers
  app.get('/api/drivers', (req, res) => {
    res.json(drivers.filter(d => !d.archivedAt));
  });

  // Get available vehicles
  app.get('/api/vehicles', (req, res) => {
    res.json(vehicles.filter(v => !v.archivedAt));
  });

  // Get a specific request by ID
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

  // Delete a request
  app.delete('/api/requests/:id', (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const index = requests.findIndex(r => r.id === id);

      if (index !== -1) {
        requests.splice(index, 1);
        res.json({ message: "Request deleted successfully" });
      } else {
        res.status(404).json({ error: "Request not found" });
      }
    } catch (error) {
      console.error("Delete request error:", error);
      res.status(500).json({ error: "Failed to delete request" });
    }
  });

  // Get unread notifications count
  app.get('/api/notifications/unread/count', (req, res) => {
    try {
      const count = notifications.filter(n => !n.read).length;
      res.json({ count });
    } catch (error) {
      console.error("Get unread count error:", error);
      res.status(500).json({ error: "Failed to get unread notifications count" });
    }
  });

  // ✅ FIXED: Create Vehicle — with validation and duplicate check
  app.post('/api/vehicles', (req, res) => {
    try {
      const { vehicleType, plateNo, capacity, fuelType, fleetCard, rfid } = req.body;

      // Validate required fields
      if (!vehicleType || !plateNo || !capacity || !fuelType) {
        return res.status(400).json({
          error: "Missing required fields: vehicleType, plateNo, capacity, fuelType"
        });
      }

      // Normalize plate number for comparison
      const normalizedPlateNo = plateNo.trim().toUpperCase();

      // Check for duplicate among non-archived vehicles
      const existing = vehicles.find(
        v => v.plateNo && v.plateNo.trim().toUpperCase() === normalizedPlateNo && !v.archivedAt
      );

      if (existing) {
        return res.status(409).json({ error: "Vehicle with this plate number already exists." });
      }

      // Parse capacity safely
      const parsedCapacity = parseInt(capacity, 10);
      if (isNaN(parsedCapacity)) {
        return res.status(400).json({ error: "Invalid capacity value" });
      }

      const newVehicle = {
        id: Date.now(),
        vehicleType: vehicleType.trim(),
        plateNo: normalizedPlateNo,
        capacity: parsedCapacity,
        fuelType: fuelType.trim(),
        fleetCard: (fleetCard || "").trim(), // default to empty string
        rfid: (rfid || "").trim(),           // default to empty string
      };

      vehicles.push(newVehicle);
      console.log("✅ Vehicle created:", newVehicle);
      res.status(201).json(newVehicle);

    } catch (error) {
      console.error("🚨 Create vehicle error:", error);
      res.status(500).json({ error: "Failed to create vehicle" });
    }
  });

  // ✅ FIXED: Create Driver — with validation
  app.post('/api/drivers', (req, res) => {
    try {
      const { name, contact, email } = req.body;

      if (!name || !contact || !email) {
        return res.status(400).json({ error: "Missing required fields: name, contact, email" });
      }

      const newDriver = {
        id: Date.now(),
        name: name.trim(),
        contact: contact.trim(),
        email: email.trim(),
        status: "Active"
      };

      drivers.push(newDriver);
      console.log("✅ Driver created:", newDriver);
      res.status(201).json(newDriver);
    } catch (error) {
      console.error("🚨 Create driver error:", error);
      res.status(500).json({ error: "Failed to create driver" });
    }
  });

  // ✅ FIXED: Archive Vehicle
  app.patch('/api/vehicles/:id/archive', (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const vehicleIndex = vehicles.findIndex(v => v.id === id);

      if (vehicleIndex === -1) {
        return res.status(404).json({ error: "Vehicle not found" });
      }

      const vehicle = { ...vehicles[vehicleIndex] };
      vehicle.archivedAt = new Date().toISOString();

      archivedVehicles.push(vehicle);
      vehicles.splice(vehicleIndex, 1);

      console.log("📦 Vehicle archived:", vehicle);
      res.json(vehicle);
    } catch (error) {
      console.error("🚨 Archive vehicle error:", error);
      res.status(500).json({ error: "Failed to archive vehicle" });
    }
  });

  // ✅ FIXED: Archive Driver
  app.patch('/api/drivers/:id/archive', (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const driverIndex = drivers.findIndex(d => d.id === id);

      if (driverIndex === -1) {
        return res.status(404).json({ error: "Driver not found" });
      }

      const driver = { ...drivers[driverIndex] };
      driver.archivedAt = new Date().toISOString();

      archivedDrivers.push(driver);
      drivers.splice(driverIndex, 1);

      console.log("📦 Driver archived:", driver);
      res.json(driver);
    } catch (error) {
      console.error("🚨 Archive driver error:", error);
      res.status(500).json({ error: "Failed to archive driver" });
    }
  });

  // ✅ FIXED: Restore Vehicle
  app.patch('/api/vehicles/:id/restore', (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const vehicleIndex = archivedVehicles.findIndex(v => v.id === id);

      if (vehicleIndex === -1) {
        return res.status(404).json({ error: "Archived vehicle not found" });
      }

      const vehicle = { ...archivedVehicles[vehicleIndex] };
      delete vehicle.archivedAt;

      vehicles.push(vehicle);
      archivedVehicles.splice(vehicleIndex, 1);

      console.log("↩️ Vehicle restored:", vehicle);
      res.json(vehicle);
    } catch (error) {
      console.error("🚨 Restore vehicle error:", error);
      res.status(500).json({ error: "Failed to restore vehicle" });
    }
  });

  // ✅ FIXED: Restore Driver
  app.patch('/api/drivers/:id/restore', (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const driverIndex = archivedDrivers.findIndex(d => d.id === id);

      if (driverIndex === -1) {
        return res.status(404).json({ error: "Archived driver not found" });
      }

      const driver = { ...archivedDrivers[driverIndex] };
      delete driver.archivedAt;

      drivers.push(driver);
      archivedDrivers.splice(driverIndex, 1);

      console.log("↩️ Driver restored:", driver);
      res.json(driver);
    } catch (error) {
      console.error("🚨 Restore driver error:", error);
      res.status(500).json({ error: "Failed to restore driver" });
    }
  });

  // ✅ Get Archived Vehicles
  app.get('/api/vehicles/archived', (req, res) => {
    res.json(archivedVehicles);
  });

  // ✅ Get Archived Drivers
  app.get('/api/drivers/archived', (req, res) => {
    res.json(archivedDrivers);
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