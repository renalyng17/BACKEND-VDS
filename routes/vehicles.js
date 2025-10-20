
const express = require("express");
const pool = require("../db");
const jwt = require("jsonwebtoken");

const router = express.Router();

// ============================
//     AUTHENTICATION MIDDLEWARE
// ============================
const authenticateToken = (req, res, next) => {
  const token = req.cookies.token || req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: "Access token required" });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: "Invalid or expired token" });
    }
    req.user = user;
    next();
  });
};

// ============================
//        GET ALL VEHICLES
// ============================
router.get('/', authenticateToken, async (req, res) => {
  try {
    console.log('📥 Fetching vehicles...');
    
    const result = await pool.query(
      `SELECT 
        vehicle_id AS id,
        vehicle_model AS "vehicleType",
        plate_no AS "plateNo",
        capacity,
        fuel_type AS "fuelType",
        fleet_card_status AS "fleetCard",
        rfid_status AS "rfid"
       FROM tbl_vehicle_profile
       WHERE archived_at IS NULL
       ORDER BY vehicle_model`
    );
    
    console.log(`✅ Found ${result.rows.length} vehicles`);
    
    return res.status(200).json({
      status: 'success',
      data: result.rows
    });

  } catch (error) {
    console.error('❌ Error fetching vehicles:', error);
    
    return res.status(500).json({ 
      status: 'error',
      message: 'Failed to fetch vehicles',
      code: 'FETCH_VEHICLES_FAILED'
    });
  }
});

// ============================
//        CREATE VEHICLE
// ============================
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { vehicleType, plateNo, capacity, fuelType, fleetCard, rfid } = req.body;

    console.log("📥 Create Vehicle Request:", req.body);

    // Validate required fields
    if (!vehicleType || !plateNo || !capacity || !fuelType || !fleetCard || !rfid) {
      return res.status(400).json({
        status: 'error',
        message: "Missing required fields: vehicleType, plateNo, capacity, fuelType, fleetCard, rfid",
        code: 'VALIDATION_ERROR'
      });
    }

    // Normalize plate number
    const normalizedPlateNo = plateNo.trim().toUpperCase();

    // Check for duplicate plate number
    const duplicateCheck = await pool.query(
      'SELECT * FROM tbl_vehicle_profile WHERE plate_no = $1 AND archived_at IS NULL',
      [normalizedPlateNo]
    );

    if (duplicateCheck.rows.length > 0) {
      return res.status(409).json({ 
        status: 'error',
        message: "Vehicle with this plate number already exists",
        code: 'DUPLICATE_PLATE'
      });
    }

    // Validate fuel type
    const validFuelTypes = ['BIO-DIESEL', 'DIESEL', 'KEROSENE'];
    if (!validFuelTypes.includes(fuelType.toUpperCase())) {
      return res.status(400).json({ 
        status: 'error',
        message: "Invalid fuel type. Must be BIO-DIESEL, DIESEL, or KEROSENE",
        code: 'INVALID_FUEL_TYPE'
      });
    }

    // Validate status values
    const validStatuses = ['Available', 'Unavailable'];
    if (!validStatuses.includes(fleetCard) || !validStatuses.includes(rfid)) {
      return res.status(400).json({ 
        status: 'error',
        message: "Fleet card and RFID must be 'Available' or 'Unavailable'",
        code: 'INVALID_STATUS'
      });
    }

    // Insert new vehicle
    const result = await pool.query(
      `INSERT INTO tbl_vehicle_profile 
        (vehicle_model, plate_no, capacity, fuel_type, fleet_card_status, rfid_status)
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING 
        vehicle_id AS id,
        vehicle_model AS "vehicleType",
        plate_no AS "plateNo",
        capacity,
        fuel_type AS "fuelType",
        fleet_card_status AS "fleetCard",
        rfid_status AS "rfid"`,
      [
        vehicleType.trim(),
        normalizedPlateNo,
        parseInt(capacity),
        fuelType.toUpperCase(),
        fleetCard,
        rfid
      ]
    );

    return res.status(201).json({
      status: 'success',
      message: 'Vehicle created successfully',
      data: result.rows[0]
    });

  } catch (error) {
    console.error("❌ Create vehicle error:", error);
    
    return res.status(500).json({ 
      status: 'error',
      message: "Failed to create vehicle",
      code: 'CREATE_VEHICLE_FAILED'
    });
  }
});

// ============================
//        ARCHIVE VEHICLE
// ============================
router.patch('/:id/archive', authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    console.log(`📥 Archiving vehicle ID: ${id}`);

    const result = await pool.query(
      `UPDATE tbl_vehicle_profile 
       SET archived_at = NOW() 
       WHERE vehicle_id = $1 AND archived_at IS NULL 
       RETURNING 
        vehicle_id AS id,
        vehicle_model AS "vehicleType",
        plate_no AS "plateNo",
        capacity,
        fuel_type AS "fuelType",
        fleet_card_status AS "fleetCard",
        rfid_status AS "rfid"`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        status: 'error',
        message: "Vehicle not found or already archived",
        code: 'VEHICLE_NOT_FOUND'
      });
    }

    return res.status(200).json({
      status: 'success',
      message: 'Vehicle archived successfully',
      data: result.rows[0]
    });

  } catch (error) {
    console.error("❌ Archive vehicle error:", error);
    
    return res.status(500).json({ 
      status: 'error',
      message: "Failed to archive vehicle",
      code: 'ARCHIVE_VEHICLE_FAILED'
    });
  }
});

// ============================
//        RESTORE VEHICLE
// ============================
router.put('/:id/restore', authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    console.log(`📥 Restoring vehicle ID: ${id}`);

    const result = await pool.query(
      `UPDATE tbl_vehicle_profile 
       SET archived_at = NULL 
       WHERE vehicle_id = $1 AND archived_at IS NOT NULL 
       RETURNING 
        vehicle_id AS id,
        vehicle_model AS "vehicleType",
        plate_no AS "plateNo",
        capacity,
        fuel_type AS "fuelType",
        fleet_card_status AS "fleetCard",
        rfid_status AS "rfid"`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        status: 'error',
        message: "Archived vehicle not found",
        code: 'ARCHIVED_VEHICLE_NOT_FOUND'
      });
    }

    return res.status(200).json({
      status: 'success',
      message: 'Vehicle restored successfully',
      data: result.rows[0]
    });

  } catch (error) {
    console.error("❌ Restore vehicle error:", error);
    
    return res.status(500).json({ 
      status: 'error',
      message: "Failed to restore vehicle",
      code: 'RESTORE_VEHICLE_FAILED'
    });
  }
});

// ============================
//      GET ARCHIVED VEHICLES
// ============================
router.get('/archived', authenticateToken, async (req, res) => {
  try {
    console.log('📥 Fetching archived vehicles...');
    
    const result = await pool.query(
      `SELECT 
        vehicle_id AS id,
        vehicle_model AS "vehicleType",
        plate_no AS "plateNo",
        capacity,
        fuel_type AS "fuelType",
        fleet_card_status AS "fleetCard",
        rfid_status AS "rfid"
       FROM tbl_vehicle_profile
       WHERE archived_at IS NOT NULL
       ORDER BY vehicle_model`
    );
    
    console.log(`✅ Found ${result.rows.length} archived vehicles`);
    
    return res.status(200).json({
      status: 'success',
      data: result.rows
    });

  } catch (error) {
    console.error('❌ Error fetching archived vehicles:', error);
    
    return res.status(500).json({ 
      status: 'error',
      message: 'Failed to fetch archived vehicles',
      code: 'FETCH_ARCHIVED_VEHICLES_FAILED'
    });
  }
});

module.exports = router;
