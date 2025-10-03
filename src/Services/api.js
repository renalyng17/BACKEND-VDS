// src/services/api.js
const API_BASE_URL = 'http://localhost:3001/api'; // Adjust to your backend URL

export const addVehicle = async (vehicleData) => {
  const response = await fetch(`${API_BASE_URL}/vehicles`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: vehicleData.vehicleType,
      capacity: vehicleData.capacity,
      fuelType: vehicleData.fuelType,
      fleetCardAvailable: vehicleForm.fleetCard === 'Available',
      rfidBalance: vehicleForm.rfid === 'Available',
    }),
  });
  if (!response.ok) {
    throw new Error('Failed to add vehicle');
  }
  return await response.json();
};

export const addDriver = async (driverData) => {
  const response = await fetch(`${API_BASE_URL}/drivers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: driverData.name,
      contactNo: driverData.contact,
      emailAddress: driverData.email,
    }),
  });
  if (!response.ok) {
    throw new Error('Failed to add driver');
  }
  return await response.json();
};

export const getVehicles = async () => {
  const response = await fetch(`${API_BASE_URL}/vehicles`);
  if (!response.ok) {
    throw new Error('Failed to fetch vehicles');
  }
  return await response.json();
};

export const getDrivers = async () => {
  const response = await fetch(`${API_BASE_URL}/drivers`);
  if (!response.ok) {
    throw new Error('Failed to fetch drivers');
  }
  return await response.json();
};