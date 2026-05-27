// controllers/vehicleController.js
const Vehicle = require('../models/Vehicle');
const ArchivedVehicle = require('../models/ArchivedVehicle');
const pool = require('../db'); // Make sure your db.js exports the pool directly

// GET /api/vehicles — with real-time driver and capacity
exports.getVehicles = async (req, res) => {
  try {
    // Fetch all active (non-archived) vehicles
    const vehicles = await Vehicle.findAll({ where: { archivedAt: null } });
    
    if (vehicles.length === 0) {
      return res.status(200).json([]);
    }

    // Get plate numbers for querying assignments
    const plateNos = vehicles.map(v => v.plateNo).filter(p => p && p.trim() !== '');

    let assignmentMap = {};

    if (plateNos.length > 0) {
      // Query: Get the latest accepted request per vehicle (even if trip hasn't started)
      const query = `
        SELECT DISTINCT ON (plate_no)
          plate_no,
          driver_name,
          passenger_names
        FROM tbl_requests
        WHERE 
          plate_no = ANY($1)
          AND status = 'Accepted'
          AND driver_name IS NOT NULL
          AND TRIM(driver_name) != ''
        ORDER BY plate_no, created_at DESC;
      `;

      const result = await pool.query(query, [plateNos]);

      // Build a lookup map: plate_no → { driver, passengerCount }
      assignmentMap = {};
      result.rows.forEach(row => {
        let passengerCount = 1;
        if (Array.isArray(row.passenger_names)) {
          passengerCount = row.passenger_names.length;
        } else if (row.passenger_names) {
          // Handle comma-separated string
          passengerCount = String(row.passenger_names).split(',').length;
        }
        assignmentMap[row.plate_no] = {
          driver: row.driver_name.trim(),
          passengerCount: passengerCount
        };
      });
    }

    // Enrich each vehicle with real-time status
    const enrichedVehicles = vehicles.map(vehicle => {
      const assignment = assignmentMap[vehicle.plateNo];
      const isAssigned = !!assignment;

      // Determine real-time status
      let currentStatus = 'available';
      if (vehicle.status === 'maintenance') {
        currentStatus = 'maintenance';
      } else if (isAssigned) {
        currentStatus = 'in use';
      }

      // Calculate available seats
      const totalSeats = vehicle.capacity || 4;
      const occupiedSeats = isAssigned ? assignment.passengerCount : 0;
      const availableSeats = Math.max(0, totalSeats - occupiedSeats);

      return {
        ...vehicle.toJSON(),
        currentStatus,
        currentDriver: isAssigned ? assignment.driver : null,
        availableSeats,
        totalSeats
      };
    });

    res.status(200).json(enrichedVehicles);
  } catch (error) {
    console.error('❌ Real-time vehicle status error:', error);
    res.status(500).json({ error: 'Failed to fetch vehicle status' });
  }
};

// POST /api/vehicles
exports.createVehicle = async (req, res) => {
  try {
    const { vehicleType, plateNo, capacity, fuelType, fleetCard, rfid } = req.body;

    if (!vehicleType || !plateNo || !capacity || !fuelType) {
      return res.status(400).json({ error: 'Required fields missing' });
    }

    const existing = await Vehicle.findOne({
      where: { plateNo: plateNo.trim().toUpperCase(), archivedAt: null }
    });

    if (existing) {
      return res.status(409).json({ error: 'Vehicle with this plate number already exists' });
    }

    const newVehicle = await Vehicle.create({
      vehicleType,
      plateNo: plateNo.trim().toUpperCase(),
      capacity: parseInt(capacity),
      fuelType,
      fleetCard,
      rfid
    });

    res.status(201).json(newVehicle);
  } catch (error) {
    console.error('❌ Create vehicle error:', error);
    res.status(500).json({ error: 'Failed to create vehicle' });
  }
};

// PATCH /api/vehicles/:id/archive
exports.archiveVehicle = async (req, res) => {
  try {
    const vehicleId = req.params.id;
    const vehicle = await Vehicle.findByPk(vehicleId);

    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }

    await ArchivedVehicle.create({
      ...vehicle.toJSON(),
      archivedAt: new Date()
    });

    await vehicle.destroy();

    res.status(200).json({ message: 'Vehicle archived successfully' });
  } catch (error) {
    console.error('❌ Archive vehicle error:', error);
    res.status(500).json({ error: 'Failed to archive vehicle' });
  }
};

// PUT /api/vehicles/:id/restore
exports.restoreVehicle = async (req, res) => {
  try {
    const vehicleId = req.params.id;
    const archivedVehicle = await ArchivedVehicle.findByPk(vehicleId);

    if (!archivedVehicle) {
      return res.status(404).json({ error: 'Archived vehicle not found' });
    }

    await Vehicle.create({
      ...archivedVehicle.toJSON(),
      archivedAt: null
    });

    await archivedVehicle.destroy();

    res.status(200).json({ message: 'Vehicle restored successfully' });
  } catch (error) {
    console.error('❌ Restore vehicle error:', error);
    res.status(500).json({ error: 'Failed to restore vehicle' });
  }
};

// GET /api/vehicles/archived
exports.getArchivedVehicles = async (req, res) => {
  try {
    const archivedVehicles = await ArchivedVehicle.findAll();
    res.status(200).json(archivedVehicles);
  } catch (error) {
    console.error('❌ Fetch archived vehicles error:', error);
    res.status(500).json({ error: 'Failed to fetch archived vehicles' });
  }
};