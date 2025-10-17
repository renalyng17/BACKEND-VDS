// src/services/rideService.js

const db = require('../models'); // assuming you have Sequelize or similar ORM

async function acceptRequest(requestId) {
  try {
    // Step 1: Find the request
    const request = await db.RideRequest.findByPk(requestId);
    if (!request || request.status !== 'pending') {
      throw new Error('Invalid or already processed request');
    }

    const carId = request.carId;
    const groupSize = request.groupSize;

    // Step 2: Calculate available seats
    const occupiedSeats = await db.RideRequest.sum('groupSize', {
      where: { carId, status: 'accepted' }
    });

    const car = await db.Car.findByPk(carId);
    const totalSeats = car.totalSeats;
    const availableSeats = totalSeats - (occupiedSeats || 0);

    if (availableSeats < groupSize) {
      throw new Error(`Not enough seats available. Only ${availableSeats} left.`);
    }

    // Step 3: Accept the request
    await request.update({ status: 'accepted' });

    // Step 4: Return updated car availability
    return {
      carId,
      totalSeats,
      occupiedSeats: occupiedSeats + groupSize,
      availableSeats: availableSeats - groupSize,
      message: 'Request accepted successfully'
    };

  } catch (error) {
    throw new Error(error.message);
  }
}

module.exports = { acceptRequest };