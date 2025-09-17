const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

const corsOptions = {
  origin: 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// In-memory storage (replace with database in production)
let requests = [];
let notifications = [];
let drivers = [
  { id: 1, name: "Juan Dela Cruz", contact: "09123456789", email: "juan@example.com" },
  { id: 2, name: "Maria Santos", contact: "09987654321", email: "maria@example.com" }
];
let vehicles = [
  { id: 1, type: "Van", plateNo: "ABC-1234", fuelType: "Diesel", capacity: 10, rfid: "RFID001" },
  { id: 2, type: "Car", plateNo: "XYZ-5678", fuelType: "Gasoline", capacity: 4, rfid: "RFID002" },
  { id: 3, type: "Truck", plateNo: "DEF-9012", fuelType: "Diesel", capacity: 3, rfid: "RFID003" }
];

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
    res.status(500).json({ error: "Failed to create request" });
  }
});

// Get all notifications
app.get('/api/notifications', (req, res) => {
  res.json(notifications);
});

// Update notification as read
app.put('/api/notifications/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const notification = notifications.find(n => n.id === id);

    if (notification) {
      notification.read = true;
      res.json(notification);
    } else {
      res.status(404).json({ error: "Notification not found" });
    }
  } catch (error) {
    res.status(500).json({ error: "Failed to update notification" });
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
    res.status(500).json({ error: "Failed to update request" });
  }
});

// Get available drivers
app.get('/api/drivers', (req, res) => {
  res.json(drivers);
});

// Get available vehicles
app.get('/api/vehicles', (req, res) => {
  res.json(vehicles);
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
    res.status(500).json({ error: "Failed to delete request" });
  }
});

// Get unread notifications count
app.get('/api/notifications/unread/count', (req, res) => {
  try {
    const count = notifications.filter(n => !n.read).length;
    res.json({ count });
  } catch (error) {
    res.status(500).json({ error: "Failed to get unread notifications count" });
  }
});

// Mount the auth router
try {
  const authRouter = require('./routes/auth');
  console.log("Mounting /api/auth");
  app.use('/api/auth', authRouter);
} catch (err) {
  console.error('Error in authRouter:', err.message);
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler (must come last, no '*')
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
