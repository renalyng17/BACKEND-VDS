const Driver = require('../models/Driver');
const ArchivedDriver = require('../models/ArchivedDriver');

// GET /api/drivers
exports.getDrivers = async (req, res) => {
  try {
    const drivers = await Driver.findAll({ where: { archivedAt: null } });
    res.status(200).json(drivers);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch drivers' });
  }
};

// POST /api/drivers
exports.createDriver = async (req, res) => {
  try {
    const { name, contact, email } = req.body;

    if (!name || !contact || !email) {
      return res.status(400).json({ error: 'Name, contact, and email are required' });
    }

    const newDriver = await Driver.create({
      name,
      contact,
      email,
      status: 'Active'
    });

    res.status(201).json(newDriver);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create driver' });
  }
};

// PATCH /api/drivers/:id/archive
exports.archiveDriver = async (req, res) => {
  try {
    const driverId = req.params.id;
    const driver = await Driver.findByPk(driverId);

    if (!driver) {
      return res.status(404).json({ error: 'Driver not found' });
    }

    // Move to archived table
    await ArchivedDriver.create({
      ...driver.toJSON(),
      archivedAt: new Date()
    });

    await driver.destroy();

    res.status(200).json({ message: 'Driver archived successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to archive driver' });
  }
};

// PUT /api/drivers/:id/restore
exports.restoreDriver = async (req, res) => {
  try {
    const driverId = req.params.id;
    const archivedDriver = await ArchivedDriver.findByPk(driverId);

    if (!archivedDriver) {
      return res.status(404).json({ error: 'Archived driver not found' });
    }

    // Restore to main table
    await Driver.create({
      ...archivedDriver.toJSON(),
      archivedAt: null
    });

    await archivedDriver.destroy();

    res.status(200).json({ message: 'Driver restored successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to restore driver' });
  }
};

// GET /api/drivers/archived
exports.getArchivedDrivers = async (req, res) => {
  try {
    const archivedDrivers = await ArchivedDriver.findAll();
    res.status(200).json(archivedDrivers);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch archived drivers' });
  }
};