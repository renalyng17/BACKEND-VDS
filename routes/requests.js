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
//        GET ALL REQUESTS
// ============================
router.get('/', authenticateToken, async (req, res) => {
  try {
    console.log('📥 Fetching requests...');
    
    const result = await pool.query(`
      SELECT 
        request_id as id,
        user_id,
        departure_time,
        arrival_time,
        destination,
        status,
        passenger_names as names,
        requesting_office as "requestingOffice",
        driver_name as driver,
        contact_no as "driverContact",
        vehicle_type as "vehicleType",
        plate_no as "plateNo",
        created_at,
        updated_at
      FROM tbl_requests
      ORDER BY created_at DESC
    `);

    // Format dates for frontend
    const formatted = result.rows.map(row => ({
      ...row,
      fromDate: row.departure_time ? row.departure_time.toISOString().split('T')[0] : null,
      fromTime: row.departure_time ? row.departure_time.toISOString().split('T')[1]?.slice(0, 5) : null,
      toDate: row.arrival_time ? row.arrival_time.toISOString().split('T')[0] : null,
      toTime: row.arrival_time ? row.arrival_time.toISOString().split('T')[1]?.slice(0, 5) : null,
    }));

    console.log(`✅ Found ${result.rows.length} requests`);
    
    return res.status(200).json({
      status: 'success',
      data: formatted
    });

  } catch (error) {
    console.error("❌ Fetch requests error:", error);
    
    return res.status(500).json({ 
      status: 'error',
      message: "Failed to fetch requests",
      code: 'FETCH_REQUESTS_FAILED'
    });
  }
});

// ============================
//        GET SINGLE REQUEST
// ============================
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`📥 Fetching request ID: ${id}`);
    
    const result = await pool.query(
      `SELECT 
        request_id as id,
        user_id,
        departure_time,
        arrival_time,
        destination,
        status,
        passenger_names as names,
        requesting_office as "requestingOffice",
        driver_name as driver,
        contact_no as "driverContact",
        vehicle_type as "vehicleType",
        plate_no as "plateNo",
        created_at,
        updated_at
       FROM tbl_requests 
       WHERE request_id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        status: 'error',
        message: "Request not found",
        code: 'REQUEST_NOT_FOUND'
      });
    }

    const request = result.rows[0];
    const formatted = {
      ...request,
      fromDate: request.departure_time ? request.departure_time.toISOString().split('T')[0] : null,
      fromTime: request.departure_time ? request.departure_time.toISOString().split('T')[1]?.slice(0, 5) : null,
      toDate: request.arrival_time ? request.arrival_time.toISOString().split('T')[0] : null,
      toTime: request.arrival_time ? request.arrival_time.toISOString().split('T')[1]?.slice(0, 5) : null,
    };

    return res.status(200).json({
      status: 'success',
      data: formatted
    });

  } catch (error) {
    console.error("❌ Fetch request error:", error);
    
    return res.status(500).json({ 
      status: 'error',
      message: "Failed to fetch request",
      code: 'FETCH_REQUEST_FAILED'
    });
  }
});

// ============================
//        CREATE REQUEST
// ============================
router.post('/', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { 
      departure_time, 
      arrival_time, 
      destination, 
      requesting_office, 
      passenger_names 
    } = req.body;

    console.log("📥 Create Request:", req.body);

    // Validate required fields
    if (!departure_time || !arrival_time || !destination || !requesting_office) {
      return res.status(400).json({ 
        status: 'error',
        message: "Missing required fields: departure_time, arrival_time, destination, requesting_office",
        code: 'VALIDATION_ERROR'
      });
    }

    await client.query('BEGIN');

    // Create the request
    const requestResult = await client.query(
      `INSERT INTO tbl_requests (
        user_id,
        departure_time,
        arrival_time,
        destination,
        requesting_office,
        passenger_names,
        status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *;`,
      [
        req.user.userId,
        departure_time,
        arrival_time,
        destination,
        requesting_office,
        passenger_names || [],
        'Pending'
      ]
    );

    const newReq = requestResult.rows[0];

    // Create notification
    await client.query(
      `INSERT INTO tbl_notifications (request_id, type, message)
       VALUES ($1, $2, $3)`,
      [
        newReq.request_id,
        'new_request',
        `New travel request to ${destination} from ${requesting_office}`
      ]
    );

    await client.query('COMMIT');

    // Format response
    const formatted = {
      id: newReq.request_id,
      user_id: newReq.user_id,
      fromDate: newReq.departure_time.toISOString().split('T')[0],
      fromTime: newReq.departure_time.toISOString().split('T')[1].slice(0, 5),
      toDate: newReq.arrival_time.toISOString().split('T')[0],
      toTime: newReq.arrival_time.toISOString().split('T')[1].slice(0, 5),
      destination: newReq.destination,
      names: Array.isArray(newReq.passenger_names) ? newReq.passenger_names : [],
      requestingOffice: newReq.requesting_office,
      status: newReq.status,
    };

    console.log(`✅ Created request ID: ${newReq.request_id}`);
    
    return res.status(201).json({
      status: 'success',
      message: 'Request created successfully',
      data: formatted
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error("❌ Create request error:", error);
    
    return res.status(500).json({ 
      status: 'error',
      message: "Failed to create request",
      code: 'CREATE_REQUEST_FAILED'
    });
  } finally {
    client.release();
  }
});

// ============================
//      UPDATE REQUEST STATUS
// ============================
router.put('/:id/status', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { id } = req.params;
    const { status, driver_name, contact_no, vehicle_type, plate_no, reason_for_decline } = req.body;

    console.log(`📥 Update Request Status:`, { id, ...req.body });

    const validStatuses = ["Pending", "Accepted", "Declined"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        status: 'error',
        message: "Invalid status",
        code: 'INVALID_STATUS'
      });
    }

    await client.query('BEGIN');

    // Update request
    const result = await client.query(
      `UPDATE tbl_requests
       SET status = $1, 
           driver_name = $2, 
           contact_no = $3, 
           vehicle_type = $4, 
           plate_no = $5,
           reason_for_decline = $6,
           updated_at = CURRENT_TIMESTAMP
       WHERE request_id = $7
       RETURNING *;`,
      [status, driver_name, contact_no, vehicle_type, plate_no, reason_for_decline, id]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ 
        status: 'error',
        message: "Request not found",
        code: 'REQUEST_NOT_FOUND'
      });
    }

    // Create status notification
    await client.query(
      `INSERT INTO tbl_notifications (request_id, type, message)
       VALUES ($1, $2, $3)`,
      [
        id,
        'status_update',
        `Request to ${result.rows[0].destination} has been ${status.toLowerCase()}`
      ]
    );

    await client.query('COMMIT');

    const updated = result.rows[0];
    const formatted = {
      id: updated.request_id,
      user_id: updated.user_id,
      fromDate: updated.departure_time ? updated.departure_time.toISOString().split('T')[0] : null,
      fromTime: updated.departure_time ? updated.departure_time.toISOString().split('T')[1]?.slice(0, 5) : null,
      toDate: updated.arrival_time ? updated.arrival_time.toISOString().split('T')[0] : null,
      toTime: updated.arrival_time ? updated.arrival_time.toISOString().split('T')[1]?.slice(0, 5) : null,
      destination: updated.destination,
      status: updated.status,
      names: Array.isArray(updated.passenger_names) ? updated.passenger_names : [],
      requestingOffice: updated.requesting_office,
      driver: updated.driver_name,
      driverContact: updated.contact_no,
      vehicleType: updated.vehicle_type,
      plateNo: updated.plate_no,
    };

    console.log(`✅ Updated request ID: ${id} to status: ${status}`);
    
    return res.status(200).json({
      status: 'success',
      message: `Request ${status.toLowerCase()} successfully`,
      data: formatted
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error("❌ Update request error:", error);
    
    return res.status(500).json({ 
      status: 'error',
      message: "Failed to update request",
      code: 'UPDATE_REQUEST_FAILED'
    });
  } finally {
    client.release();
  }
});

// ============================
//        DELETE REQUEST
// ============================
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`📥 Deleting request ID: ${id}`);
    
    const result = await pool.query(
      'DELETE FROM tbl_requests WHERE request_id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        status: 'error',
        message: "Request not found",
        code: 'REQUEST_NOT_FOUND'
      });
    }

    return res.status(200).json({
      status: 'success',
      message: "Request deleted successfully"
    });

  } catch (error) {
    console.error("❌ Delete request error:", error);
    
    return res.status(500).json({ 
      status: 'error',
      message: "Failed to delete request",
      code: 'DELETE_REQUEST_FAILED'
    });
  }
});

module.exports = router;