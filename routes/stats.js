// server.js or routes/stats.js
const express = require('express');
const router = express.Router();

// Mock database – replace with real DB queries
const getStatsData = () => {
  return {
    totalRequests: 12,
    pendingApproval: 3,
    completedTrips: 8,
    thisMonth: 5,
    recentRequests: [
      { id: "TR-001", status: "approved", destination: "Airport Terminal 3", passenger: "John Smith", timeAgo: "2 hours ago" },
      { id: "TR-002", status: "pending", destination: "Downtown Office", passenger: "Sarah Wilson", timeAgo: "4 hours ago" },
      { id: "TR-003", status: "completed", destination: "Client Meeting - Plaza", passenger: "Mike Johnson", timeAgo: "1 day ago" }
    ],
    vehicleStatus: [
      { id: "V-101", status: "available", model: "Toyota Camry", driver: "Robert Chen", fuel: 85 },
      { id: "V-102", status: "in use", model: "Honda Civic", driver: "Maria Garcia", fuel: 62 },
      { id: "V-103", status: "maintenance", model: "Ford Explorer", driver: "Unassigned", fuel: 95 }
    ]
  };
};

router.get('/api/stats', (req, res) => {
  try {
    const data = getStatsData(); // Replace with DB call
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

module.exports = router;