// ============================
//      UPDATE REQUEST STATUS (WITH SEAT VALIDATION USING VIEW)
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

    // Fetch current request to get passenger count
    const currentReq = await client.query(
      `SELECT passenger_names, status AS current_status FROM tbl_requests WHERE request_id = $1`,
      [id]
    );

    if (currentReq.rows.length === 0) {
      return res.status(404).json({ 
        status: 'error',
        message: "Request not found",
        code: 'REQUEST_NOT_FOUND'
      });
    }

    const { passenger_names, current_status } = currentReq.rows[0];
    const groupSize = Array.isArray(passenger_names) 
      ? passenger_names.length 
      : (passenger_names ? passenger_names.toString().split(',').length : 1);

    // 🔑 SEAT VALIDATION: Only when accepting
    if (status === "Accepted") {
      if (!plate_no) {
        return res.status(400).json({
          status: 'error',
          message: "Vehicle plate number is required when accepting",
          code: 'MISSING_PLATE_NO'
        });
      }

      // ✅ USE YOUR car_availability VIEW HERE
      const availResult = await client.query(
        `SELECT car_id, total_seats, occupied_seats, available_seats 
         FROM car_availability 
         WHERE plate_no = $1`,
        [plate_no]
      );

      if (availResult.rows.length === 0) {
        return res.status(400).json({
          status: 'error',
          message: `Vehicle with plate ${plate_no} not found in fleet`,
          code: 'VEHICLE_NOT_FOUND'
        });
      }

      const { car_id: vehicleId, available_seats: availableSeats, total_seats: totalSeats, occupied_seats: occupiedSeats } = availResult.rows[0];

      if (groupSize > availableSeats) {
        return res.status(400).json({
          status: 'error',
          message: `Not enough seats available. Vehicle has ${availableSeats} seat(s) left, but group needs ${groupSize}.`,
          code: 'INSUFFICIENT_SEATS',
          details: {
            totalSeats,
            occupiedSeats,
            availableSeats,
            requestedGroupSize: groupSize
          }
        });
      }

      // Link request to vehicle_id (car_id from view)
      await client.query(
        `UPDATE tbl_requests SET vehicle_id = $1 WHERE request_id = $2`,
        [vehicleId, id]
      );
    }

    // 🔁 Now proceed with status update (inside transaction)
    await client.query('BEGIN');

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

    // Create notification
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