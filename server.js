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
let archivedVehicles = [];
let archivedDrivers = [];
let drivers = [];
let vehicles = [];

// === Helper: Update request status (shared logic) ===
const updateRequestStatus = (request, updateData) => {
  const {
    status,
    // Support both frontend styles
    driver, driver_name,
    vehicleType, vehicle_type,
    plateNo, plate_no,
    reason, reason_for_decline
  } = updateData;

  // Normalize status to "Accepted"/"Declined"
  let finalStatus = status;
  if (status === "Accept") finalStatus = "Accepted";
  if (status === "Decline") finalStatus = "Declined";

  request.status = finalStatus;
  request.processedDate = new Date().toISOString().split('T')[0];

  if (finalStatus === "Accepted") {
    request.driver = driver_name || driver;
    request.vehicleType = vehicle_type || vehicleType;
    request.plateNo = plate_no || plateNo;
  } else if (finalStatus === "Declined") {
    request.reason = reason_for_decline || reason;
  }

  // ✅ LOG TO TERMINAL
  if (finalStatus === "Accepted") {
    console.log(`✅ Request ${request.id} ACCEPTED | Driver: ${request.driver} | Vehicle: ${request.vehicleType} (${request.plateNo})`);
  } else if (finalStatus === "Declined") {
    console.log(`❌ Request ${request.id} DECLINED | Reason: ${request.reason || 'No reason provided'}`);
  }

  // Add status update notification
  const notification = {
    id: Date.now(),
    requestId: request.id,
    type: "status_update",
    message: `Request to ${request.destination} has been ${finalStatus}`,
    timestamp: new Date().toISOString(),
    read: false
  };
  notifications.push(notification);

  return request;
};

// === Routes ===

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

    const notification = {
      id: Date.now(),
      requestId: newRequest.id,
      type: "new_request",
      message: `New travel request from ${newRequest.names?.join(', ') || 'Unknown'} (${newRequest.requestingOffice || 'N/A'}) to ${newRequest.destination || 'Unknown'}.`,
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

// Get notifications = pending requests
app.get('/api/notifications', (req, res) => {
  try {
    const pending = requests.filter(req => req.status === "Pending");
    const enriched = pending.map(req => ({
      id: req.id,
      requestId: req.id,
      type: "new_request",
      message: `New travel request from ${req.names?.join(', ') || 'Unknown'} (${req.requestingOffice || 'N/A'}) to ${req.destination || 'Unknown'}.`,
      timestamp: req.date ? new Date(req.date).toISOString() : new Date().toISOString(),
      read: false,
      ...req
    }));
    res.json(enriched);
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Get unread count
app.get('/api/notifications/unread/count', (req, res) => {
  try {
    const count = notifications.filter(n => !n.read).length;
    res.json({ count });
  } catch (error) {
    console.error("Get unread count error:", error);
    res.status(500).json({ error: "Failed to get unread notifications count" });
  }
});

// Update request status — main endpoint
app.put('/api/requests/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const request = requests.find(r => r.id === id);

    if (!request) {
      return res.status(404).json({ error: "Request not found" });
    }

    const updated = updateRequestStatus(request, req.body);
    res.json(updated);
  } catch (error) {
    console.error("Update request error:", error);
    res.status(500).json({ error: "Failed to update request" });
  }
});

// Update request status via /status (for compatibility)
app.put('/api/requests/:id/status', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const request = requests.find(r => r.id === id);

    if (!request) {
      return res.status(404).json({ error: "Request not found" });
    }

    const updated = updateRequestStatus(request, req.body);
    res.json(updated);
  } catch (error) {
    console.error("Update request status error:", error);
    res.status(500).json({ error: "Failed to update request status" });
  }
});

// Get a specific request
app.get('/api/requests/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
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
    const id = parseInt(req.params.id, 10);
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

// Get available drivers
app.get('/api/drivers', (req, res) => {
  res.json(drivers.filter(d => !d.archivedAt));
});

// Get available vehicles
app.get('/api/vehicles', (req, res) => {
  res.json(vehicles.filter(v => !v.archivedAt));
});

// Get archived
app.get('/api/vehicles/archived', (req, res) => {
  res.json(archivedVehicles);
});
app.get('/api/drivers/archived', (req, res) => {
  res.json(archivedDrivers);
});

// Create Vehicle
app.post('/api/vehicles', (req, res) => {
  try {
    const { vehicleType, plateNo, capacity, fuelType, fleetCard, rfid } = req.body;
    if (!vehicleType || !plateNo || !capacity || !fuelType) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    const normalizedPlateNo = plateNo.trim().toUpperCase();
    const existing = vehicles.find(v => v.plateNo?.trim().toUpperCase() === normalizedPlateNo && !v.archivedAt);
    if (existing) {
      return res.status(409).json({ error: "Vehicle with this plate number already exists." });
    }
    const parsedCapacity = parseInt(capacity, 10);
    if (isNaN(parsedCapacity)) {
      return res.status(400).json({ error: "Invalid capacity" });
    }
    const newVehicle = {
      id: Date.now(),
      vehicleType: vehicleType.trim(),
      plateNo: normalizedPlateNo,
      capacity: parsedCapacity,
      fuelType: fuelType.trim(),
      fleetCard: (fleetCard || "").trim(),
      rfid: (rfid || "").trim(),
    };
    vehicles.push(newVehicle);
    console.log("✅ Vehicle created:", newVehicle); // Already present
    res.status(201).json(newVehicle);
  } catch (error) {
    console.error("Create vehicle error:", error);
    res.status(500).json({ error: "Failed to create vehicle" });
  }
});

// Create Driver
app.post('/api/drivers', (req, res) => {
  try {
    const { name, contact, email } = req.body;
    if (!name || !contact || !email) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    const newDriver = {
      id: Date.now(),
      name: name.trim(),
      contact: contact.trim(),
      email: email.trim(),
      status: "Active"
    };
    drivers.push(newDriver);
    console.log("✅ Driver created:", newDriver); // Already present
    res.status(201).json(newDriver);
  } catch (error) {
    console.error("Create driver error:", error);
    res.status(500).json({ error: "Failed to create driver" });
  }
});

// Archive & Restore
app.patch('/api/vehicles/:id/archive', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const idx = vehicles.findIndex(v => v.id === id);
  if (idx === -1) return res.status(404).json({ error: "Vehicle not found" });
  const vehicle = { ...vehicles[idx], archivedAt: new Date().toISOString() };
  archivedVehicles.push(vehicle);
  vehicles.splice(idx, 1);
  console.log("📦 Vehicle archived:", vehicle);
  res.json(vehicle);
});

app.patch('/api/drivers/:id/archive', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const idx = drivers.findIndex(d => d.id === id);
  if (idx === -1) return res.status(404).json({ error: "Driver not found" });
  const driver = { ...drivers[idx], archivedAt: new Date().toISOString() };
  archivedDrivers.push(driver);
  drivers.splice(idx, 1);
  console.log("📦 Driver archived:", driver);
  res.json(driver);
});

app.patch('/api/vehicles/:id/restore', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const idx = archivedVehicles.findIndex(v => v.id === id);
  if (idx === -1) return res.status(404).json({ error: "Archived vehicle not found" });
  const vehicle = { ...archivedVehicles[idx] };
  delete vehicle.archivedAt;
  vehicles.push(vehicle);
  archivedVehicles.splice(idx, 1);
  console.log("↩️ Vehicle restored:", vehicle);
  res.json(vehicle);
});

app.patch('/api/drivers/:id/restore', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const idx = archivedDrivers.findIndex(d => d.id === id);
  if (idx === -1) return res.status(404).json({ error: "Archived driver not found" });
  const driver = { ...archivedDrivers[idx] };
  delete driver.archivedAt;
  drivers.push(driver);
  archivedDrivers.splice(idx, 1);
  console.log("↩️ Driver restored:", driver);
  res.json(driver);
});

// Auth (optional)
try {
  const authRouter = require('./routes/auth');
  app.use('/api/auth', authRouter);
} catch (err) {
  console.warn('Auth router not loaded:', err.message);
}

// Error handlers
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err.stack);
  res.status(500).json({ error: 'Server error' });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));