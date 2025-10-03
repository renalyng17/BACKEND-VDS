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
//        GET ALL DRIVERS
// ============================
router.get('/', authenticateToken, async (req, res) => {
  try {
    console.log('📥 Fetching drivers...');
    
    const result = await pool.query(
      `SELECT 
        driver_id AS id,
        name,
        contact_no AS contact,
        email_address AS email,
        is_assigned
       FROM tbl_drivers_profile
       WHERE archived_at IS NULL
       ORDER BY name`
    );
    
    console.log(`✅ Found ${result.rows.length} drivers`);
    
    return res.status(200).json({
      status: 'success',
      data: result.rows
    });

  } catch (error) {
    console.error('❌ Error fetching drivers:', error);
    
    return res.status(500).json({ 
      status: 'error',
      message: 'Failed to fetch drivers',
      code: 'FETCH_DRIVERS_FAILED'
    });
  }
});

// ============================
//        CREATE DRIVER
// ============================
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, contact, email } = req.body;

    console.log("📥 Create Driver Request:", req.body);

    // Validate required fields
    if (!name || !contact || !email) {
      return res.status(400).json({
        status: 'error',
        message: "Missing required fields: name, contact, email",
        code: 'VALIDATION_ERROR'
      });
    }

    // Check for duplicate email
    const duplicateCheck = await pool.query(
      'SELECT * FROM tbl_drivers_profile WHERE email_address = $1 AND archived_at IS NULL',
      [email.toLowerCase()]
    );

    if (duplicateCheck.rows.length > 0) {
      return res.status(409).json({ 
        status: 'error',
        message: "Driver with this email already exists",
        code: 'DUPLICATE_EMAIL'
      });
    }

    // Insert new driver
    const result = await pool.query(
      `INSERT INTO tbl_drivers_profile 
        (name, contact_no, email_address, is_assigned)
       VALUES ($1, $2, $3, $4) 
       RETURNING 
        driver_id AS id,
        name,
        contact_no AS contact,
        email_address AS email,
        is_assigned`,
      [name.trim(), contact.trim(), email.toLowerCase().trim(), true]
    );

    return res.status(201).json({
      status: 'success',
      message: 'Driver created successfully',
      data: result.rows[0]
    });

  } catch (error) {
    console.error("❌ Create driver error:", error);
    
    return res.status(500).json({ 
      status: 'error',
      message: "Failed to create driver",
      code: 'CREATE_DRIVER_FAILED'
    });
  }
});

// ============================
//        ARCHIVE DRIVER
// ============================
router.patch('/:id/archive', authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    console.log(`📥 Archiving driver ID: ${id}`);

    const result = await pool.query(
      `UPDATE tbl_drivers_profile 
       SET archived_at = NOW(),
           is_assigned = false
       WHERE driver_id = $1 AND archived_at IS NULL 
       RETURNING 
        driver_id AS id,
        name,
        contact_no AS contact,
        email_address AS email,
        is_assigned`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        status: 'error',
        message: "Driver not found or already archived",
        code: 'DRIVER_NOT_FOUND'
      });
    }

    return res.status(200).json({
      status: 'success',
      message: 'Driver archived successfully',
      data: result.rows[0]
    });

  } catch (error) {
    console.error("❌ Archive driver error:", error);
    
    return res.status(500).json({ 
      status: 'error',
      message: "Failed to archive driver",
      code: 'ARCHIVE_DRIVER_FAILED'
    });
  }
});

// ============================
//        RESTORE DRIVER
// ============================
router.put('/:id/restore', authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    console.log(`📥 Restoring driver ID: ${id}`);

    const result = await pool.query(
      `UPDATE tbl_drivers_profile 
       SET archived_at = NULL,
           is_assigned = true
       WHERE driver_id = $1 AND archived_at IS NOT NULL 
       RETURNING 
        driver_id AS id,
        name,
        contact_no AS contact,
        email_address AS email,
        is_assigned`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        status: 'error',
        message: "Archived driver not found",
        code: 'ARCHIVED_DRIVER_NOT_FOUND'
      });
    }

    return res.status(200).json({
      status: 'success',
      message: 'Driver restored successfully',
      data: result.rows[0]
    });

  } catch (error) {
    console.error("❌ Restore driver error:", error);
    
    return res.status(500).json({ 
      status: 'error',
      message: "Failed to restore driver",
      code: 'RESTORE_DRIVER_FAILED'
    });
  }
});

// ============================
//      GET ARCHIVED DRIVERS
// ============================
router.get('/archived', authenticateToken, async (req, res) => {
  try {
    console.log('📥 Fetching archived drivers...');
    
    const result = await pool.query(
      `SELECT 
        driver_id AS id,
        name,
        contact_no AS contact,
        email_address AS email,
        is_assigned
       FROM tbl_drivers_profile
       WHERE archived_at IS NOT NULL
       ORDER BY name`
    );
    
    console.log(`✅ Found ${result.rows.length} archived drivers`);
    
    return res.status(200).json({
      status: 'success',
      data: result.rows
    });

  } catch (error) {
    console.error('❌ Error fetching archived drivers:', error);
    
    return res.status(500).json({ 
      status: 'error',
      message: 'Failed to fetch archived drivers',
      code: 'FETCH_ARCHIVED_DRIVERS_FAILED'
    });
  }
});

module.exports = router;