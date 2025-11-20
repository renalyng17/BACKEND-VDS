// routes/requests.js

const express = require('express');
const { authenticateToken } = require('../middleware/auth'); // Assuming you have an auth middleware
const { pool } = require('../utils/db'); // Assuming you have a db config file exporting the pool

const router = express.Router();

// ============================
//      UPDATE REQUEST STATUS (CORRECTED)
// ============================
router.put('/:id/status', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { id } = req.params;
    const { status, driver_name, contact_no, vehicle_type, plate_no, reason_for_decline } = req.body;

    // Normalize inputs
    const cleanDriver = driver_name ? driver_name.trim() : null;
    const cleanPlate = plate_no ? plate_no.trim().toUpperCase() : null;

    const validStatuses = ["Pending", "Accepted", "Declined"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    // Fetch current request to get passenger count, date, and pickup_location
    const currentReq = await client.query(
      `SELECT 
         passenger_names, 
         status AS current_status,
         departure_time,
         pickup_location -- NEW: Fetch pickup_location
       FROM tbl_requests 
       WHERE request_id = $1`,
      [id]
    );

    if (currentReq.rows.length === 0) {
      return res.status(404).json({ error: "Request not found" });
    }

    const { passenger_names, current_status, departure_time, pickup_location } = currentReq.rows[0]; // NEW: Destructure pickup_location
    const groupSize = Array.isArray(passenger_names) 
      ? passenger_names.length 
      : (passenger_names ? passenger_names.toString().split(',').length : 1);

    const fromDate = departure_time ? new Date(departure_time).toISOString().split('T')[0] : null;

    if (status === "Accepted") {
      if (!cleanDriver) {
        return res.status(400).json({ error: "Driver name is required" });
      }
      if (!cleanPlate) {
        return res.status(400).json({ error: "Plate number is required" });
      }

      // Optional: Driver conflict check (uncomment if needed)
      /*
      const driverConflict = await client.query(
        `SELECT request_id FROM tbl_requests
         WHERE driver_name = $1 AND DATE(departure_time) = $2
           AND status IN ('Pending', 'Accepted') AND request_id != $3`,
        [cleanDriver, fromDate, id]
      );
      if (driverConflict.rows.length > 0) {
        return res.status(400).json({ error: "Driver already booked" });
      }
      */

      // Optional: Seat validation
      /*
      const avail = await client.query(
        `SELECT available_seats FROM car_availability WHERE plate_no = $1`,
        [cleanPlate]
      );
      if (avail.rows.length === 0) {
        return res.status(400).json({ error: "Vehicle not found" });
      }
      */
    }

    await client.query('BEGIN');

    // NEW: Include pickup_location in the RETURNING clause to ensure it's available in the response
    const result = await client.query(
      `UPDATE tbl_requests 
       SET 
         status = $1, 
         driver_name = $2, 
         contact_no = $3, 
         vehicle_type = $4, 
         plate_no = $5, 
         reason_for_decline = $6
       WHERE request_id = $7 
       RETURNING 
         request_id, user_id, departure_time, arrival_time, pickup_location, destination, -- NEW: Include pickup_location
         status, passenger_names, requesting_office, driver_name, contact_no, vehicle_type, plate_no;`,
      [status, driver_name, contact_no, vehicle_type, plate_no, reason_for_decline, id]
    );


    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: "Request not found" });
    }

    await client.query(
      `INSERT INTO tbl_notifications (request_id, type, message)
       VALUES ($1, $2, $3)`,
      [
        id,
        'status_update',
        `Request from ${result.rows[0].pickup_location} to ${result.rows[0].destination} has been ${status.toLowerCase()}` // NEW: Include pickup_location in message
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
      pickupLocation: updated.pickup_location, // NEW: Include pickup_location in the response
      destination: updated.destination,
      status: updated.status,
      driver: updated.driver_name,      // for frontend
      plateNo: updated.plate_no,        // for frontend
      // ... other fields as needed
    };

    res.json(formatted);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Update request error:", error);
    res.status(500).json({ error: "Failed to update request" });
  } finally {
    client.release();
  }
}); 

module.exports = router;