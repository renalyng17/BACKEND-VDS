// src/services/api.js
const API_BASE_URL = 'http://localhost:3001/api'; // Adjust to your backend URL

// === Vehicles ===
export const getVehicles = async () => {
  const response = await fetch(`${API_BASE_URL}/vehicles`);
  if (!response.ok) throw new Error('Failed to fetch vehicles');
  return await response.json();
};

export const getArchivedVehicles = async () => {
  const response = await fetch(`${API_BASE_URL}/vehicles/archived`);
  if (!response.ok) throw new Error('Failed to fetch archived vehicles');
  return await response.json();
};

export const createVehicle = async (vehicleData) => {
  const response = await fetch(`${API_BASE_URL}/vehicles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      vehicleType: vehicleData.vehicleType,
      plateNo: vehicleData.plateNo,
      capacity: Number(vehicleData.capacity),
      fuelType: vehicleData.fuelType,
      fleetCard: vehicleData.fleetCard,      // "Available" or "Unavailable"
      rfid: vehicleData.rfid,                // "Available" or "Unavailable"
    }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to create vehicle');
  }
  return await response.json();
};

export const archiveVehicle = async (id) => {
  const response = await fetch(`${API_BASE_URL}/vehicles/${id}/archive`, {
    method: 'PATCH',
  });
  if (!response.ok) throw new Error('Failed to archive vehicle');
  return await response.json();
};

export const restoreVehicle = async (id) => {
  const response = await fetch(`${API_BASE_URL}/vehicles/${id}/restore`, {
    method: 'PATCH',
  });
  if (!response.ok) throw new Error('Failed to restore vehicle');
  return await response.json();
};

// === Drivers ===
export const getDrivers = async () => {
  const response = await fetch(`${API_BASE_URL}/drivers`);
  if (!response.ok) throw new Error('Failed to fetch drivers');
  return await response.json();
};

export const getArchivedDrivers = async () => {
  const response = await fetch(`${API_BASE_URL}/drivers/archived`);
  if (!response.ok) throw new Error('Failed to fetch archived drivers');
  return await response.json();
};

export const createDriver = async (driverData) => {
  const response = await fetch(`${API_BASE_URL}/drivers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: driverData.name,
      contact: driverData.contact,    // Should be in E.164 format (e.g., +639123456789)
      email: driverData.email,
    }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to create driver');
  }
  return await response.json();
};

export const archiveDriver = async (id) => {
  const response = await fetch(`${API_BASE_URL}/drivers/${id}/archive`, {
    method: 'PATCH',
  });
  if (!response.ok) throw new Error('Failed to archive driver');
  return await response.json();
};

export const restoreDriver = async (id) => {
  const response = await fetch(`${API_BASE_URL}/drivers/${id}/restore`, {
    method: 'PATCH',
  });
  if (!response.ok) throw new Error('Failed to restore driver');
  return await response.json();
};

// === Requests (for NotificationBar) ===
export const getRequests = async () => {
  const response = await fetch(`${API_BASE_URL}/requests`);
  if (!response.ok) throw new Error('Failed to fetch requests');
  return await response.json();
};

export const updateRequestStatus = async (id, data) => {
  const response = await fetch(`${API_BASE_URL}/requests/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to update request');
  }
  return await response.json();
};

// === Unified API object (optional, for compatibility) ===
export const api = {
  getVehicles,
  getArchivedVehicles,
  createVehicle,
  archiveVehicle,
  restoreVehicle,

  getDrivers,
  getArchivedDrivers,
  createDriver,
  archiveDriver,
  restoreDriver,

  getRequests,
  updateRequestStatus,
};