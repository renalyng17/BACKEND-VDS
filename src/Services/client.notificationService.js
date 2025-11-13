// src/services/notificationService.js
const pool = require('../../db');

class NotificationService {
  async getRequests() {
    const query = `
      SELECT 
        request_id,
        user_id,
        departure_time AS fromDate,
        arrival_time AS toDate,
        destination,
        status,
        reason_for_decline,
        passenger_names AS names,
        requesting_office,
        driver_name,
        contact_no,
        email,
        vehicle_type,
        plate_no,
        capacity,
        fuel_type,
        created_at
      FROM tbl_requests
      ORDER BY created_at DESC;
    `;
    const result = await pool.query(query);
    return result.rows;
  }

  async getDrivers() {
    const query = `
      SELECT 
        driver_id,
        name,
        contact_no,
        email_address,
        is_assigned,
        archived_at
      FROM tbl_drivers_profile
      WHERE archived_at IS NULL;
    `;
    const result = await pool.query(query);
    return result.rows;
  }

  async getVehicles() {
    const query = `
      SELECT 
        vehicle_id,
        vehicle_model AS vehicleType,
        capacity,
        fuel_type,
        fleet_card_status,
        rfid_status,
        license_plate AS plateNo
      FROM tbl_vehicle_profile;
    `;
    const result = await pool.query(query);
    return result.rows;
  }

  async updateRequestStatus(requestId, updateData) {
    const { status, driver_name, contact_no, vehicle_type, plate_no, reason_for_decline } = updateData;

    const query = `
      UPDATE tbl_requests 
      SET 
        status = $1,
        driver_name = $2,
        contact_no = $3,
        vehicle_type = $4,
        plate_no = $5,
        reason_for_decline = $6,
        updated_at = NOW()
      WHERE request_id = $7
      RETURNING *;
    `;

    const values = [
      status,
      driver_name || '',
      contact_no || '',
      vehicle_type || '',
      plate_no || '',
      reason_for_decline || '',
      requestId
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
  }
}

module.exports = new NotificationService();