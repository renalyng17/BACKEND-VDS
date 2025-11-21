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

// === In-Memory Storage ===
let requests = [];
let notifications = [];
let archivedVehicles = [];
let archivedDrivers = [];
let drivers = [];
let vehicles = [];

// === Helper: Get available seats for a vehicle ===
const getAvailableSeats = (plateNo) => {
  const vehicle = vehicles.find(v => v.plateNo === plateNo && !v.archivedAt);
  if (!vehicle) return null;

  const occupied = requests
    .filter(req =>
      req.status === "Accepted" &&
      req.plateNo === plateNo
    )
    .reduce((total, req) => {
      const groupSize = Array.isArray(req.names) ? req.names.length : 1;
      return total + groupSize;
    }, 0);

  return {
    total: vehicle.capacity,
    occupied,
    available: vehicle.capacity - occupied
  };
};

// === Helper: Update request status ===
const updateRequestStatus = (request, updateData) => {
  const {
    status,
    driver, driver_name,
    vehicleType, vehicle_type,
    plateNo, plate_no,
    reason, reason_for_decline
  } = updateData;

  let finalStatus = status;
  if (status === "Accept") finalStatus = "Accepted";
  if (status === "Decline") finalStatus = "Declined";

  if (finalStatus === "Accepted") {
    const selectedDriver = (driver_name || driver)?.trim();
    const selectedPlate = (plate_no || plateNo)?.trim();

    if (!selectedDriver) {
      return { success: false, message: "Driver name is required to accept a request.", code: 400 };
    }
    if (!selectedPlate) {
      return { success: false, message: "Vehicle plate number is required to accept a request.", code: 400 };
    }

    // ✅ DRIVER TIME-RANGE CONFLICT CHECK
    const newFromDate = request.fromDate;
    const newFromTime = request.fromTime;
    const newToTime = request.toTime;

    if (!newFromTime || !newToTime) {
      return { success: false, message: "Trip start and end times are required.", code: 400 };
    }

    const existingAssignment = requests.find(req =>
      req.id !== request.id &&
      (req.status === "Accepted" || req.status === "Pending") &&
      req.driver?.trim() === selectedDriver &&
      req.fromDate === newFromDate &&
      newFromTime < req.toTime &&
      newToTime > req.fromTime
    );

    if (existingAssignment) {
      return {
        success: false,
        code: 409,
        message: `Driver "${selectedDriver}" is already assigned to another trip on ${newFromDate} from ${existingAssignment.fromTime} to ${existingAssignment.toTime}.`
      };
    }

    const seatInfo = getAvailableSeats(selectedPlate);
    if (!seatInfo) {
      return { success: false, message: `Vehicle with plate ${selectedPlate} not found.`, code: 404 };
    }

    const groupSize = Array.isArray(request.names) ? request.names.length : 1;
    if (groupSize > seatInfo.available) {
      return {
        success: false,
        code: 400,
        message: `Not enough seats! Vehicle has ${seatInfo.available} seat(s) left, but group needs ${groupSize}.`
      };
    }
  }

  request.status = finalStatus;
  request.processedDate = new Date().toISOString().split('T')[0];

  if (finalStatus === "Accepted") {
    request.driver = (driver_name || driver)?.trim();
    request.vehicleType = vehicle_type || vehicleType;
    request.plateNo = (plate_no || plateNo)?.trim();
  } else if (finalStatus === "Declined") {
    request.reason = reason_for_decline || reason;
  }

  notifications.push({
    id: Date.now(),
    requestId: request.id,
    type: "status_update",
    message: `Request to ${request.destination} has been ${finalStatus}`,
    timestamp: new Date().toISOString(),
    read: false
  });

  return { success: true, data: request };
};

// === NEW: Real-time Vehicle Status Endpoint ===
app.get('/api/vehicles', (req, res) => {
  try {
    const vehicleStatus = vehicles
      .filter(v => !v.archivedAt)
      .map(v => {
        // Find active assignment for this vehicle
        const activeRequest = requests.find(req => 
          req.status === 'Accepted' && 
          req.plateNo === v.plateNo
        );

        let currentStatus = 'available';
        if (v.status === 'maintenance') {
          currentStatus = 'maintenance';
        } else if (activeRequest) {
          currentStatus = 'in use';
        }

        const totalSeats = v.capacity || 4;
        const occupiedSeats = activeRequest ? 
          (Array.isArray(activeRequest.names) ? activeRequest.names.length : 1) : 0;
        const availableSeats = Math.max(0, totalSeats - occupiedSeats);

        return {
          ...v,
          currentStatus,
          currentDriver: activeRequest?.driver || null,
          availableSeats,
          totalSeats
        };
      });

    res.json(vehicleStatus);
  } catch (error) {
    console.error('Vehicle status error:', error);
    res.status(500).json({ error: 'Failed to fetch vehicle status' });
  }
});

// === Existing Routes (Unchanged) ===

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK' });
});

// Requests
app.get('/api/requests', (req, res) => {
  res.json(requests);
});

app.post('/api/requests', (req, res) => {
  try {
    const { fromDate, fromTime, toTime, ...otherData } = req.body;

    if (!fromDate || !fromTime || !toTime) {
      return res.status(400).json({ error: "fromDate, fromTime, and toTime are required" });
    }

    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(fromTime) || !timeRegex.test(toTime)) {
      return res.status(400).json({ error: "Times must be in HH:MM format" });
    }

    const newRequest = {
      id: Date.now(),
      ...otherData,
      fromDate,
      fromTime,
      toTime,
      status: "Pending",
      date: new Date().toISOString().split('T')[0]
    };

    requests.push(newRequest);

    notifications.push({
      id: Date.now(),
      requestId: newRequest.id,
      type: "new_request",
      message: `New travel request from ${newRequest.names?.join(', ') || 'Unknown'} (${newRequest.requestingOffice || 'N/A'}) to ${newRequest.destination || 'Unknown'}.`,
      timestamp: new Date().toISOString(),
      read: false
    });

    res.status(201).json(newRequest);
  } catch (error) {
    console.error("Create request error:", error);
    res.status(500).json({ error: "Failed to create request" });
  }
});

// Update request
app.put('/api/requests/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const request = requests.find(r => r.id === id);

  if (!request) {
    return res.status(404).json({ error: "Request not found" });
  }

  const result = updateRequestStatus(request, req.body);

  if (result.success) {
    res.json(result.data);
  } else {
    res.status(result.code || 400).json({ error: result.message });
  }
});

// Get specific request
app.get('/api/requests/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const request = requests.find(r => r.id === id);
  if (request) {
    res.json(request);
  } else {
    res.status(404).json({ error: "Request not found" });
  }
});

// Drivers
app.get('/api/drivers', (req, res) => {
  res.json(drivers.filter(d => !d.archivedAt));
});

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
    res.status(201).json(newDriver);
  } catch {
    res.status(500).json({ error: "Failed to create driver" });
  }
});

// Vehicles (Create)
app.post('/api/vehicles', (req, res) => {
  try {
    const { vehicleType, plateNo, capacity, fuelType, fleetCard, rfid } = req.body;
    if (!vehicleType || !plateNo || !capacity || !fuelType) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const normalizedPlateNo = plateNo.trim().toUpperCase();
    const existing = vehicles.find(v =>
      v.plateNo?.trim().toUpperCase() === normalizedPlateNo && !v.archivedAt
    );

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
      status: "operational" // Add status field
    };

    vehicles.push(newVehicle);
    res.status(201).json(newVehicle);
  } catch {
    res.status(500).json({ error: "Failed to create vehicle" });
  }
});

// Archived
app.get('/api/vehicles/archived', (req, res) => res.json(archivedVehicles));
app.get('/api/drivers/archived', (req, res) => res.json(archivedDrivers));

// Archive & Restore
app.patch('/api/vehicles/:id/archive', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const idx = vehicles.findIndex(v => v.id === id);
  if (idx === -1) return res.status(404).json({ error: "Vehicle not found" });

  const vehicle = { ...vehicles[idx], archivedAt: new Date().toISOString() };
  archivedVehicles.push(vehicle);
  vehicles.splice(idx, 1);
  res.json(vehicle);
});

app.patch('/api/drivers/:id/archive', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const idx = drivers.findIndex(d => d.id === id);
  if (idx === -1) return res.status(404).json({ error: "Driver not found" });

  const driver = { ...drivers[idx], archivedAt: new Date().toISOString() };
  archivedDrivers.push(driver);
  drivers.splice(idx, 1);
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
  res.json(driver);
});

// Notifications
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

app.get('/api/notifications/unread/count', (req, res) => {
  try {
    const count = notifications.filter(n => !n.read).length;
    res.json({ count });
  } catch {
    res.status(500).json({ error: "Failed to get unread notifications count" });
  }
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

app.listen(PORT, () => console.log(` Server running on port ${PORT}`));