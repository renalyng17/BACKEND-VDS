const Vehicle = require('../models/Vehicle');
const ArchivedVehicle = require('../models/ArchivedVehicle');

// GET /api/vehicles
exports.getVehicles = async (req, res) => {
  try {
    const vehicles = await Vehicle.findAll({ where: { archivedAt: null } });
    res.status(200).json(vehicles);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch vehicles' });
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
    console.error(error);
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
    console.error(error);
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
    console.error(error);
    res.status(500).json({ error: 'Failed to restore vehicle' });
  }
};

// GET /api/vehicles/archived
exports.getArchivedVehicles = async (req, res) => {
  try {
    const archivedVehicles = await ArchivedVehicle.findAll();
    res.status(200).json(archivedVehicles);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch archived vehicles' });
  }
};