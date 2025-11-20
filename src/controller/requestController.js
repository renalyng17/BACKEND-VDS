// src/controller/requestController.js

const pool = require('../db'); // Assuming this is your pool

// Helper function to convert time string (HH:MM) to minutes from midnight
const timeToMinutes = (timeStr) => {
  if (!timeStr) return 0;
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
};

// GET /api/requests - Get all requests
const getRequests = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        request_id as id,
        user_id,
        departure_time,
        arrival_time,
        pickup_location, -- <-- NEW: Include pickup_location
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
      // Include pickupLocation in the mapped object
      pickupLocation: row.pickup_location, // Map database column to frontend field
      // Format dates/times
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
        pickup_location,
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
      // Include pickupLocation in the mapped object
      pickupLocation: request.pickup_location, // Map database column to frontend field
      // Format dates/times
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
      pickupLocation, // <-- NEW: Destructure from frontend
      destination, // Use the new frontend fields
      names, // frontend sends 'names' (array of strings)
      requestingOffice, // frontend sends 'requestingOffice'
      fromDate, // frontend sends 'fromDate'
      fromTime, // frontend sends 'fromTime'
      toDate, // frontend sends 'toDate'
      toTime  // frontend sends 'toTime'
    } = req.body;

    // Combine date and time into timestamp for departure_time and arrival_time
    const departureDateTime = new Date(`${fromDate}T${fromTime}`);
    const arrivalDateTime = new Date(`${toDate}T${toTime}`);

    // Validate required fields (using frontend field names)
    if (!pickupLocation || !destination || !names || !requestingOffice || !fromDate || !fromTime || !toDate || !toTime) {
      return res.status(400).json({ 
        error: "Missing required fields: pickupLocation, destination, names, requestingOffice, fromDate, fromTime, toDate, toTime"
      });
    }

    // Validate date/times are valid
    if (isNaN(departureDateTime.getTime()) || isNaN(arrivalDateTime.getTime())) {
      return res.status(400).json({ error: "Invalid date or time format" });
    }

    if (arrivalDateTime < departureDateTime) {
      return res.status(400).json({ error: "Arrival time cannot be before departure time" });
    }

    await client.query('BEGIN');

    // Create the request - Include pickup_location in the INSERT
    const requestResult = await client.query(
      `INSERT INTO tbl_requests (
        user_id,
        departure_time,
        arrival_time,
        pickup_location, 
        destination,
        requesting_office,
        passenger_names,
        status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *;`,
      [
        req.user?.userId || null, // From authenticated user
        departureDateTime,
        arrivalDateTime,
        pickupLocation, // <-- NEW: Pass the value
        destination,
        requestingOffice,
        names, // Pass the array of names directly
        'Pending'
      ]
    );

    const newReq = requestResult.rows[0];

    await client.query('COMMIT');

    // Format for frontend response - Include pickupLocation
    const formatted = {
      id: newReq.request_id,
      user_id: newReq.user_id,
      pickupLocation: newReq.pickup_location, // Include in response
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

    // Fetch the request being updated to get its details (date, time, destination)
    const currentRequestResult = await client.query(
      `SELECT departure_time, arrival_time, destination, pickup_location, passenger_names
       FROM tbl_requests
       WHERE request_id = $1`,
      [id]
    );

    if (currentRequestResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: "Request not found" });
    }

    const currentRequest = currentRequestResult.rows[0];
    const currentDate = currentRequest.departure_time.toISOString().split('T')[0];
    const currentFromTime = currentRequest.departure_time.toISOString().split('T')[1].slice(0, 5);
    const currentToTime = currentRequest.arrival_time.toISOString().split('T')[1].slice(0, 5);

    // If status is being set to 'Accepted', perform conflict checks
    if (status === 'Accepted') {
      // 1. Validate Driver Availability (Allow same trip or sufficient time gap)
      if (driver_name) {
        const driverConflictsResult = await client.query(
          `SELECT request_id, departure_time, arrival_time, destination, pickup_location, plate_no
           FROM tbl_requests
           WHERE driver_name = $1
             AND departure_time::date = $2
             AND status IN ('Pending', 'Accepted')
             AND request_id != $3`, // Exclude the current request itself
          [driver_name, currentDate, id]
        );

        const driverConflicts = driverConflictsResult.rows;

        if (driverConflicts.length > 0) {
          let isSameTrip = false;
          for (const conflict of driverConflicts) {
            const conflictDate = conflict.departure_time.toISOString().split('T')[0];
            const conflictFromTime = conflict.departure_time.toISOString().split('T')[1].slice(0, 5);
            const conflictToTime = conflict.arrival_time.toISOString().split('T')[1].slice(0, 5);

            // Check if it's the EXACT SAME TRIP (date, dest, driver, vehicle)
            if (
              conflict.destination === currentRequest.destination &&
              conflict.pickup_location === currentRequest.pickup_location &&
              conflict.plate_no === plate_no // Check vehicle
            ) {
              isSameTrip = true;
              break; // Found a same trip, no need to check others
            }

            // Check for TIME CONFLICT if it's NOT the same trip
            const currentStartMinutes = timeToMinutes(currentFromTime);
            const currentEndMinutes = timeToMinutes(currentToTime);
            const conflictStartMinutes = timeToMinutes(conflictFromTime);
            const conflictEndMinutes = timeToMinutes(conflictToTime);

            const fourHoursInMinutes = 4 * 60;

            if (
              (currentStartMinutes < conflictEndMinutes && currentEndMinutes > conflictStartMinutes) || // Overlapping
              (currentStartMinutes - conflictEndMinutes > 0 && currentStartMinutes - conflictEndMinutes < fourHoursInMinutes) || // Gap before
              (conflictStartMinutes - currentEndMinutes > 0 && conflictStartMinutes - currentEndMinutes < fourHoursInMinutes) // Gap after
            ) {
              await client.query('ROLLBACK');
              return res.status(409).json({
                error: `Driver "${driver_name}" has a time conflict with another trip on ${currentDate}.`
              });
            }
          }

          // If there are conflicts but none are the same trip, it's a general conflict
          if (!isSameTrip) {
            // This condition should not be reached if the time conflict check above is correct,
            // but it's a safety net if only different trips exist.
            // The time conflict check should catch all non-same-trip conflicts.
            // However, if logic changes, this could be a catch-all.
            // For now, we'll let the same trip pass, and time conflicts will be caught above.
            // The original strict check is commented out below.
          }
        }
      }

      // 2. Validate Vehicle Assignment - A vehicle can only be assigned to one driver per day
      if (plate_no) {
        const vehicleConflictResult = await client.query(
          `SELECT request_id, driver_name
           FROM tbl_requests
           WHERE plate_no = $1
             AND departure_time::date = $2
             AND status IN ('Pending', 'Accepted')
             AND driver_name != $3
             AND request_id != $4`, // Exclude the current request itself
          [plate_no, currentDate, driver_name, id]
        );

        if (vehicleConflictResult.rows.length > 0) {
          await client.query('ROLLBACK');
          return res.status(409).json({
            error: `The vehicle "${plate_no}" is already assigned to another driver on ${currentDate}.`
          });
        }
      }
    }

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
      pickupLocation: updated.pickup_location, // Include in response
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