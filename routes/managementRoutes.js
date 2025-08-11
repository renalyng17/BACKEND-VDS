const express = require('express');
const router = express.Router();
const pool = require('../db');

// Vehicle Routes
// Update your backend route
router.post('/vehicles', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { model, plateNo, capacity, fuelType, fleetCardAvailable, rfidBalance } = req.body;

    // Insert vehicle
    const result = await client.query(
      `INSERT INTO tbl_vehicle_profile (
        model, plate_no, capacity, fuel_type, fleet_card_available, rfid_balance
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING 
        vehicle_id,
        model,
        plate_no AS "plateNo",
        capacity,
        fuel_type AS "fuelType",
        fleet_card_available AS "fleetCardAvailable",
        rfid_balance AS "rfidBalance"`,
      [model, plateNo, capacity, fuelType, fleetCardAvailable, rfidBalance]
    );

    await client.query('COMMIT');
    res.status(201).json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Database error:', err);
    res.status(500).json({ error: 'Database operation failed' });
  } finally {
    client.release();
  }
});

router.get('/vehicles', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        vehicle_id,
        model,
        capacity,
        fuel_type AS "fuelType",
        fleet_card_available AS "fleetCardAvailable",
        rfid_balance AS "rfidBalance"
       FROM tbl_vehicle_profile`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch vehicles' });
  }
});

// Driver Routes
router.post('/drivers', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { name, contactNo, emailAddress } = req.body;

    // Check for duplicate email
    const emailCheck = await client.query(
      'SELECT 1 FROM tbl_drivers_profile WHERE email_address = $1',
      [emailAddress]
    );
    if (emailCheck.rows.length > 0) {
      return res.status(409).json({ error: 'Driver with this email already exists' });
    }

    // Insert driver
    const result = await client.query(
      `INSERT INTO tbl_drivers_profile (
        name, contact_no, email_address
      ) VALUES ($1, $2, $3)
      RETURNING 
        driver_id,
        name,
        contact_no AS "contactNo",
        email_address AS "emailAddress",
        is_assigned AS "isAssigned"`,
      [name, contactNo, emailAddress]
    );

    await client.query('COMMIT');
    res.status(201).json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Database error:', err);
    res.status(500).json({ error: 'Database operation failed' });
  } finally {
    client.release();
  }
});

router.get('/drivers', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        driver_id,
        name,
        contact_no AS "contactNo",
        email_address AS "emailAddress",
        is_assigned AS "isAssigned"
       FROM tbl_drivers_profile`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch drivers' });
  }
});

module.exports = router;