// src/services/rideService.js

async function acceptRequest(requestId) {
  const request = await Request.findById(requestId).populate('driver vehicle');
  if (!request) throw new Error('Request not found');

  // ✅ VALIDATE: DRIVER IS NOT ALREADY BOOKED ON THIS DATE
  const { fromDate, driver } = request;
  if (!driver) throw new Error('Driver not assigned');

  const existingAssignment = await Request.findOne({
    driver: driver._id,
    fromDate: fromDate,
    status: { $in: ['Pending', 'Accepted'] },
    _id: { $ne: requestId } // exclude current request
  });

  if (existingAssignment) {
    throw new Error(`Driver ${driver.name} is already assigned to another trip on ${fromDate}`);
  }

  // ✅ VALIDATE: VEHICLE HAS ENOUGH SEATS
  const vehicle = request.vehicle;
  if (!vehicle) throw new Error('Vehicle not assigned');

  const totalPassengers = request.names?.length || 1;

  const occupiedSeatsOnDate = await Request.aggregate([
    {
      $match: {
        vehicle: vehicle._id,
        fromDate: fromDate,
        status: 'Accepted',
        _id: { $ne: requestId }
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: { $size: "$names" } }
      }
    }
  ]);

  const currentOccupied = occupiedSeatsOnDate[0]?.total || 0;
  const availableSeats = vehicle.capacity - currentOccupied - totalPassengers;

  if (availableSeats < 0) {
    throw new Error(`Vehicle ${vehicle.plateNo} does not have enough seats for this request`);
  }

  // ✅ ACCEPT THE REQUEST
  await request.update({ status: 'Accepted' });

  // ✅ RETURN UPDATED CAR AVAILABILITY
  return {
    carId: vehicle._id,
    totalSeats: vehicle.capacity,
    occupiedSeats: currentOccupied + totalPassengers,
    availableSeats: Math.max(0, availableSeats),
    plateNo: vehicle.plateNo,
    vehicleType: vehicle.vehicleType,
    driverName: driver.name
  };
}