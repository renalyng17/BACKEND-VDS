// controllers/vehicleController.js
const Vehicle = require('../models/Vehicle');
const pool = require('../db'); // Make sure this exports pool directly

exports.getVehicles = async (req, res) => {
  try {
    const vehicles = await Vehicle.findAll({ where: { archivedAt: null } });
    if (vehicles.length === 0) return res.json([]);

    const plateNos = vehicles.map(v => v.plateNo);

    // ✅ Get active trips with passenger counts
    const activeTripsQuery = `
      SELECT 
        r.plate_no,
        r.driver_name,
        r.passenger_names
      FROM tbl_requests r
      WHERE 
        r.plate_no = ANY($1)
        AND r.status = 'Accepted'
        AND r.departure_time <= NOW()
        AND r.arrival_time >= NOW()
    `;

    const { rows: activeTrips } = await pool.query(activeTripsQuery, [plateNos]);

    // Create map: plate_no → { driver, passengerCount }
    const tripMap = {};
    activeTrips.forEach(trip => {
      let passengerCount = 0;
      if (Array.isArray(trip.passenger_names)) {
        passengerCount = trip.passenger_names.length;
      } else if (trip.passenger_names) {
        passengerCount = trip.passenger_names.toString().split(',').length;
      } else {
        passengerCount = 1;
      }

      tripMap[trip.plate_no] = {
        driver: trip.driver_name,
        passengerCount: passengerCount
      };
    });

    // Enrich vehicles
    const enrichedVehicles = vehicles.map(vehicle => {
      const isActive = tripMap.hasOwnProperty(vehicle.plateNo);
      const realTimeStatus = 
        vehicle.status === 'maintenance' 
          ? 'maintenance'
          : isActive 
            ? 'in use'
            : 'available';

      const passengerCount = isActive ? tripMap[vehicle.plateNo].passengerCount : 0;
      const availableSeats = Math.max(0, vehicle.capacity - passengerCount);

      return {
        ...vehicle.toJSON(),
        currentStatus: realTimeStatus,
        currentDriver: isActive ? tripMap[vehicle.plateNo].driver : null,
        availableSeats: availableSeats,
        totalSeats: vehicle.capacity,
        model: `${vehicle.vehicleType} (${vehicle.plateNo})`
      };
    });

    res.status(200).json(enrichedVehicles);
  } catch (error) {
    console.error('Vehicle status error:', error);
    res.status(500).json({ error: 'Failed to fetch vehicle status' });
  }
};