const pool = require('../db');

// GET /api/requests - Get all requests
const getRequests = async (req, res) => {
  try {
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

    res.json(formatted);
  } catch (error) {
    console.error('Error fetching requests:', error);
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
};

// GET /api/requests/:id - Get single request
const getRequest = async (req, res) => {
  try {
    const { id } = req.params;
    
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
      return res.status(404).json({ error: "Request not found" });
    }

    const request = result.rows[0];
    const formatted = {
      ...request,
      fromDate: request.departure_time ? request.departure_time.toISOString().split('T')[0] : null,
      fromTime: request.departure_time ? request.departure_time.toISOString().split('T')[1]?.slice(0, 5) : null,
      toDate: request.arrival_time ? request.arrival_time.toISOString().split('T')[0] : null,
      toTime: request.arrival_time ? request.arrival_time.toISOString().split('T')[1]?.slice(0, 5) : null,
    };

    res.json(formatted);
  } catch (error) {
    console.error('Error fetching request:', error);
    res.status(500).json({ error: 'Failed to fetch request' });
  }
};

// POST /api/requests - Create new request
const createRequest = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { 
      departure_time, 
      arrival_time, 
      destination, 
      requesting_office, 
      passenger_names 
    } = req.body;

    // Validate required fields
    if (!departure_time || !arrival_time || !destination || !requesting_office) {
      return res.status(400).json({ 
        error: "Missing required fields: departure_time, arrival_time, destination, requesting_office"
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
        req.user?.userId || null, // From authenticated user
        departure_time,
        arrival_time,
        destination,
        requesting_office,
        passenger_names || [],
        'Pending'
      ]
    );

    const newReq = requestResult.rows[0];

    await client.query('COMMIT');

    // Format for frontend
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

    res.status(201).json(formatted);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Create request error:", error);
    res.status(500).json({ error: "Failed to create request" });
  } finally {
    client.release();
  }
};

// PUT /api/requests/:id/status - Update request status
const updateRequestStatus = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { id } = req.params;
    const { status, driver_name, contact_no, vehicle_type, plate_no, reason_for_decline } = req.body;

    const validStatuses = ["Pending", "Accepted", "Declined"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    await client.query('BEGIN');

    // Update the request
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
      return res.status(404).json({ error: "Request not found" });
    }

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

    res.json(formatted);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Update request error:", error);
    res.status(500).json({ error: "Failed to update request" });
  } finally {
    client.release();
  }
};

// DELETE /api/requests/:id - Delete request
const deleteRequest = async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      'DELETE FROM tbl_requests WHERE request_id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Request not found" });
    }

    res.json({ message: "Request deleted successfully" });
  } catch (error) {
    console.error("Delete request error:", error);
    res.status(500).json({ error: "Failed to delete request" });
  }
};

module.exports = {
  getRequests,
  getRequest,
  createRequest,
  updateRequestStatus,
  deleteRequest
};