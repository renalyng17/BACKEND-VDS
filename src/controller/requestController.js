const pool = require('../db');

// Helper to normalize passenger count
const getPassengerCount = (passenger_names) => {
  if (!passenger_names) return 1;
  if (Array.isArray(passenger_names)) return passenger_names.length;
  return passenger_names.toString().split(',').filter(n => n.trim()).length || 1;
};

// GET /api/requests
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

// GET /api/requests/:id
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

// POST /api/requests
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

    if (!departure_time || !arrival_time || !destination || !requesting_office) {
      return res.status(400).json({ 
        error: "Missing required fields"
      });
    }

    await client.query('BEGIN');

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
        req.user?.userId || null,
        departure_time,
        arrival_time,
        destination,
        requesting_office,
        passenger_names || [],
        'Pending'
      ]
    );

    await client.query('COMMIT');
    const newReq = requestResult.rows[0];

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

// PUT /api/requests/:id/status — FULL LOGIC WITH VALIDATION & CORRECT SQL
const updateRequestStatus = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { status, driver_name, contact_no, vehicle_type, plate_no, reason_for_decline } = req.body;

    const validStatuses = ["Pending", "Accepted", "Declined"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    // Fetch current request
    const currentReq = await client.query(
      `SELECT 
        passenger_names, 
        status AS current_status,
        departure_time
      FROM tbl_requests 
      WHERE request_id = $1`,
      [id]
    );

    if (currentReq.rows.length === 0) {
      return res.status(404).json({ error: "Request not found" });
    }

    const { passenger_names, departure_time } = currentReq.rows[0];
    const groupSize = getPassengerCount(passenger_names);
    const fromDate = departure_time ? new Date(departure_time).toISOString().split('T')[0] : null;

    // Validation only for "Accepted"
    if (status === "Accepted") {
      if (!driver_name?.trim()) {
        return res.status(400).json({ error: "Driver name is required when accepting" });
      }
      if (!plate_no?.trim()) {
        return res.status(400).json({ error: "Vehicle plate number is required when accepting" });
      }

      // Optional: Add driver conflict check (uncomment if needed)
      /*
      const driverConflict = await client.query(
        `SELECT request_id FROM tbl_requests
         WHERE driver_name = $1 AND DATE(departure_time) = $2
           AND status IN ('Pending', 'Accepted') AND request_id != $3`,
        [driver_name.trim(), fromDate, id]
      );
      if (driverConflict.rows.length > 0) {
        return res.status(400).json({ error: "Driver already booked on this date" });
      }
      */

      // Optional: Seat validation via car_availability (uncomment if needed)
      /*
      const avail = await client.query(
        `SELECT available_seats FROM car_availability WHERE plate_no = $1`,
        [plate_no]
      );
      if (avail.rows.length === 0) {
        return res.status(400).json({ error: "Vehicle not found" });
      }
      if (groupSize > (avail.rows[0].available_seats || 0)) {
        return res.status(400).json({ error: "Not enough seats available" });
      }
      */
    }

    await client.query('BEGIN');

    // ✅ CORRECT SQL — NO TYPO!
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
      [status, driver_name?.trim() || null, contact_no, vehicle_type, plate_no?.trim() || null, reason_for_decline, id]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: "Request not found" });
    }

    // Create notification
    await client.query(
      `INSERT INTO tbl_notifications (request_id, type, message)
       VALUES ($1, $2, $3)`,
      [id, 'status_update', `Request to ${result.rows[0].destination} has been ${status.toLowerCase()}`]
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

    res.json(formatted);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Update request error:", error);
    res.status(500).json({ error: "Failed to update request" });
  } finally {
    client.release();
  }
};

// DELETE /api/requests/:id
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