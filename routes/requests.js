// backend/routes/requests.js
const express = require("express");
const client = require("../db");

const router = express.Router();

// GET all requests
router.get("/", async (req, res) => {
  try {
    const result = await client.query(`
      SELECT 
        request_id,
        user_id,
        departure_time,
        arrival_time,
        destination,
        trip_duration_days,
        status,
        passenger_names,
        requesting_office,
        driver_name,
        contact_no,
        email,
        vehicle_type,
        plate_no,
        capacity,
        fuel_type,
        created_at,
        updated_at
      FROM tbl_requests
      ORDER BY created_at DESC
    `);

    // Format response for frontend
    const formattedRequests = result.rows.map((row) => ({
      id: row.request_id,
      user_id: row.user_id,
      fromDate: row.departure_time.toISOString().split("T")[0],
      fromTime: row.departure_time.toISOString().split("T")[1].slice(0, 5),
      toDate: row.arrival_time.toISOString().split("T")[0],
      toTime: row.arrival_time.toISOString().split("T")[1].slice(0, 5),
      destination: row.destination,
      trip_duration_days: row.trip_duration_days,
      status: row.status,
      names: row.passenger_names || [],
      requestingOffice: row.requesting_office,
      driver: row.driver_name,
      driverContact: row.contact_no,
      email: row.email,
      vehicleType: row.vehicle_type,
      plateNo: row.plate_no,
      capacity: row.capacity,
      fuelType: row.fuel_type,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    res.json(formattedRequests);
  } catch (error) {
    console.error("Error fetching requests:", error);
    res.status(500).json({ message: "Failed to fetch requests" });
  }
});
// PUT /requests/:id/status
router.put("/:id/status", async (req, res) => {
  const { status, reason_for_decline, driver_name, contact_no, vehicle_type, plate_no } = req.body;

  const query = `
    UPDATE tbl_requests 
    SET 
      status = $1,
      reason_for_decline = $2,
      driver_name = $3,
      contact_no = $4,
      vehicle_type = $5,
      plate_no = $6,
      updated_at = CURRENT_TIMESTAMP
    WHERE request_id = $7
    RETURNING *
  `;
  const values = [status, reason_for_decline, driver_name, contact_no, vehicle_type, plate_no, req.params.id];

  const result = await client.query(query, values);
  res.json(result.rows[0]);
});

// POST create new request
router.post("/", async (req, res) => {
  try {
    const {
      user_id,
      departure_time,
      arrival_time,
      destination,
      trip_duration_days,
      passenger_names,
      requesting_office,
      status = "Pending",
      reason_for_decline,
      driver_name,
      contact_no,
      email,
      vehicle_type,
      plate_no,
      capacity,
      fuel_type,
    } = req.body;

    // Insert into tbl_requests
    const query = `
      INSERT INTO tbl_requests (
        user_id,
        departure_time,
        arrival_time,
        destination,
        trip_duration_days,
        status,
        reason_for_decline,
        passenger_names,
        requesting_office,
        driver_name,
        contact_no,
        email,
        vehicle_type,
        plate_no,
        capacity,
        fuel_type
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
      ) RETURNING *
    `;

    const values = [
      user_id,
      new Date(departure_time),
      new Date(arrival_time),
      destination,
      trip_duration_days,
      status,
      reason_for_decline || null,
      passenger_names || [],
      requesting_office,
      driver_name || null,
      contact_no || null,
      email || null,
      vehicle_type || null,
      plate_no || null,
      capacity || null,
      fuel_type || null,
    ];

    const result = await client.query(query, values);

    const newRequest = result.rows[0];

    // Format response for frontend
    const formatted = {
      ...newRequest,
      fromDate: newRequest.departure_time.toISOString().split("T")[0],
      fromTime: newRequest.departure_time.toISOString().split("T")[1].slice(0, 5),
      toDate: newRequest.arrival_time.toISOString().split("T")[0],
      toTime: newRequest.arrival_time.toISOString().split("T")[1].slice(0, 5),
      names: newRequest.passenger_names || [],
      requestingOffice: newRequest.requesting_office,
      status: newRequest.status,
      driver: newRequest.driver_name,
      driverContact: newRequest.contact_no,
      email: newRequest.email,
      vehicleType: newRequest.vehicle_type,
      plateNo: newRequest.plate_no,
      capacity: newRequest.capacity,
      fuelType: newRequest.fuel_type,
    };

    res.status(201).json(formatted);
  } catch (error) {
    console.error("Error creating request:", error);
    res.status(500).json({ message: "Failed to create request" });
  }
});

module.exports = router;