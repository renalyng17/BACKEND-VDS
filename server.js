// server.js (or app.js)
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

    const existingAssignment = requests.find(req =>
      req.id !== request.id &&
      (req.status === "Accepted" || req.status === "Pending") &&
      req.driver?.trim() === selectedDriver &&
      req.fromDate === request.fromDate
    );

    if (existingAssignment) {
      return {
        success: false,
        code: 409,
        message: `Driver "${selectedDriver}" is already assigned to another trip on ${request.fromDate} (Vehicle: ${existingAssignment.plateNo})`
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

// === Routes ===

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK' });
});

// Get all requests
app.get('/api/requests', (req, res) => {
  res.json(requests);
});

// Create request
app.post('/api/requests', (req, res) => {
  try {
    const newRequest = {
      id: Date.now(),
      ...req.body,
      status: "Pending",
      date: new Date().toISOString().split('T')[0]
    };

    if (!newRequest.fromDate) {
      return res.status(400).json({ error: "fromDate is required" });
    }

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

// Unread notifications count
app.get('/api/notifications/unread/count', (req, res) => {
  try {
    const count = notifications.filter(n => !n.read).length;
    res.json({ count });
  } catch {
    res.status(500).json({ error: "Failed to get unread notifications count" });
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

// Update request via /status
app.put('/api/requests/:id/status', (req, res) => {
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
  } catch {
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
  } catch {
    res.status(500).json({ error: "Failed to delete request" });
  }
});

// Drivers
app.get('/api/drivers', (req, res) => {
  res.json(drivers.filter(d => !d.archivedAt));
});

// Vehicles
app.get('/api/vehicles', (req, res) => {
  res.json(vehicles.filter(v => !v.archivedAt));
});

// Archived
app.get('/api/vehicles/archived', (req, res) => res.json(archivedVehicles));
app.get('/api/drivers/archived', (req, res) => res.json(archivedDrivers));

// Create Vehicle
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
    };

    vehicles.push(newVehicle);
    res.status(201).json(newVehicle);
  } catch {
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
    res.status(201).json(newDriver);
  } catch {
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

// Check vehicle seat availability
app.get('/api/vehicles/:plateNo/availability', (req, res) => {
  try {
    const { plateNo } = req.params;
    const normalized = plateNo.trim().toUpperCase();
    const info = getAvailableSeats(normalized);
    if (!info) return res.status(404).json({ error: "Vehicle not found" });

    res.json({
      plateNo: normalized,
      totalSeats: info.total,
      occupiedSeats: info.occupied,
      availableSeats: info.available
    });
  } catch {
    res.status(500).json({ error: "Failed to fetch availability" });
  }
});

// Auth Router
try {
  const authRouter = require('./routes/auth');
  app.use('/api/auth', authRouter);
} catch (err) {
  console.warn('Auth router not loaded:', err.message);
}

// Profile Router
try {
  const profileRouter = require('./routes/profile');
  app.use('/profile', profileRouter);
} catch (err) {
  console.warn('Profile router not loaded:', err.message);
}

// Dashboard Stats
app.get('/api/stats', (req, res) => {
  try {
    const totalRequests = requests.length;
    const pendingApproval = requests.filter(req => req.status === "Pending").length;
    const completedTrips = requests.filter(req => req.status === "Completed").length;

    const now = new Date();
    const thisMonth = requests.filter(req => {
      if (!req.date) return false;
      const reqDate = new Date(req.date);
      return (
        reqDate.getMonth() === now.getMonth() &&
        reqDate.getFullYear() === now.getFullYear()
      );
    }).length;

    const recentRequests = requests
      .filter(req => ['Pending', 'Accepted', 'Completed', 'Declined'].includes(req.status))
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 3)
      .map(req => {
        const reqDate = new Date(req.date);
        const diffMs = Date.now() - reqDate.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        let timeAgo = 'Today';
        if (diffDays === 1) timeAgo = '1 day ago';
        else if (diffDays > 1 && diffDays < 7) timeAgo = `${diffDays} days ago`;
        else if (diffDays >= 7) timeAgo = req.date;

        return {
          id: `TR-${req.id}`,
          status: req.status.toLowerCase(),
          destination: req.destination || 'N/A',
          passenger: Array.isArray(req.names)
            ? req.names.join(', ')
            : (req.names || req.requestingOffice || 'Unknown'),
          timeAgo
        };
      });

    const vehicleStatus = vehicles
      .filter(v => !v.archivedAt)
      .slice(0, 3)
      .map((v, idx) => {
        const isAssigned = requests.some(req =>
          req.status === 'Accepted' &&
          req.plateNo === v.plateNo
        );

        return {
          id: `V-${v.id}`,
          status: isAssigned ? 'in use' : 'available',
          model: `${v.vehicleType} (${v.plateNo})`,
          driver: (() => {
            const assigned = requests.find(req =>
              req.status === 'Accepted' &&
              req.plateNo === v.plateNo
            );
            return assigned?.driver || 'Unassigned';
          })(),
          fuel: 85 - (idx * 10)
        };
      });

    while (vehicleStatus.length < 3) {
      const id = vehicleStatus.length + 1;
      vehicleStatus.push({
        id: `V-${Date.now() + id}`,
        status: 'maintenance',
        model: `Vehicle ${id}`,
        driver: 'Unassigned',
        fuel: 95
      });
    }

    res.json({
      totalRequests,
      pendingApproval,
      completedTrips,
      thisMonth,
      recentRequests,
      vehicleStatus
    });
  } catch {
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

// Error Handlers
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err.stack);
  res.status(500).json({ error: 'Server error' });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
