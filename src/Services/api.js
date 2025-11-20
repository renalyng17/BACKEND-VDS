const API_BASE_URL = 'http://localhost:3001/api';

// Helper: Get auth token
const getAuthToken = () => {
  return localStorage.getItem('token');
};

// Enhanced API request handler
const apiRequest = async (endpoint, options = {}) => {
  const token = getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` }),
    ...options.headers,
  };

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
      credentials: 'include',
    });

    // Parse JSON, but be safe if response is empty or not JSON
    let data;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      // Use the backend's error message directly if available
      let errorMessage = 'An unknown error occurred';
      
      if (typeof data === 'object' && data !== null && data.error) {
        errorMessage = data.error; // This is your snackbar message!
      } else if (typeof data === 'string' && data) {
        errorMessage = data;
      } else {
        errorMessage = `Request failed: ${response.status} ${response.statusText}`;
      }

      // Throw with ONLY the message — no extra wrapping
      const error = new Error(errorMessage);
      error.status = response.status;
      error.isApiError = true; // Optional flag for UI to distinguish
      throw error;
    }

    return data;
  } catch (error) {
    // Handle network-level errors (e.g., server down)
    if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
      const networkError = new Error('Network error: Unable to connect to server');
      networkError.isNetworkError = true;
      throw networkError;
    }
    // Re-throw API or other errors
    throw error;
  }
};

// Export all API methods
export const api = {
  // Authentication
  login: (credentials) => apiRequest('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
  register: (userData) => apiRequest('/auth/register', { method: 'POST', body: JSON.stringify(userData) }),
  logout: () => apiRequest('/auth/logout', { method: 'POST' }),
  getProfile: () => apiRequest('/auth/profile'),
  resetPassword: (data) => apiRequest('/auth/reset-password', { method: 'POST', body: JSON.stringify(data) }),

  // REQUESTS
  getRequests: () => apiRequest('/requests'),
  getRequest: (id) => apiRequest(`/requests/${id}`),
  createRequest: (data) => apiRequest('/requests', { method: 'POST', body: JSON.stringify(data) }),
  
  // FIXED: Match backend route (PUT /requests/:id)
  updateRequestStatus: (id, data) => {
    const payload = {
      status: data.status,
      driver: data.driver_name,
      vehicleType: data.vehicle_type,
      plateNo: data.plate_no,
      reason: data.reason_for_decline,
    };
    return apiRequest(`/requests/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
  },
  
  deleteRequest: (id) => apiRequest(`/requests/${id}`, { method: 'DELETE' }),

  // NOTIFICATIONS
  getNotifications: () => apiRequest('/notifications'),
  markNotificationAsRead: (id) => 
    apiRequest(`/notifications/${id}/read`, { method: 'PUT' }),
  getUnreadNotificationsCount: () => apiRequest('/notifications/unread/count'),
  markAllNotificationsAsRead: () => 
    apiRequest('/notifications/mark-all-read', { method: 'PUT' }),

  // VEHICLES
  getVehicles: async () => {
    try {
      const data = await apiRequest('/vehicles');
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error('Error in getVehicles:', error);
      return [];
    }
  },
  
  createVehicle: (data) => apiRequest('/vehicles', { method: 'POST', body: JSON.stringify(data) }),
  archiveVehicle: (id) => apiRequest(`/vehicles/${id}/archive`, { method: 'PATCH' }),
  restoreVehicle: (id) => apiRequest(`/vehicles/${id}/restore`, { method: 'PATCH' }), // ⚠️ Fixed: was PUT, but backend uses PATCH
  getArchivedVehicles: async () => {
    try {
      const data = await apiRequest('/vehicles/archived');
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error('Error in getArchivedVehicles:', error);
      return [];
    }
  },

  // DRIVERS
  getDrivers: async () => {
    try {
      const data = await apiRequest('/drivers');
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error('Error in getDrivers:', error);
      return [];
    }
  },
  
  createDriver: (data) => apiRequest('/drivers', { method: 'POST', body: JSON.stringify(data) }),
  archiveDriver: (id) => apiRequest(`/drivers/${id}/archive`, { method: 'PATCH' }),
  restoreDriver: (id) => apiRequest(`/drivers/${id}/restore`, { method: 'PATCH' }), // ⚠️ Fixed: was PUT, but backend uses PATCH
  getArchivedDrivers: async () => {
    try {
      const data = await apiRequest('/drivers/archived');
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error('Error in getArchivedDrivers:', error);
      return [];
    }
  },
};