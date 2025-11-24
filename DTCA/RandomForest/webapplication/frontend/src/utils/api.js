// API Configuration and Helper Functions

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Helper function to get auth token
export const getAuthToken = () => {
  return localStorage.getItem('authToken');
};

// Helper function to set auth token
export const setAuthToken = (token) => {
  localStorage.setItem('authToken', token);
};

// Helper function to remove auth token
export const removeAuthToken = () => {
  localStorage.removeItem('authToken');
};

// Helper function to get user data
export const getUserData = () => {
  const userData = localStorage.getItem('userData');
  return userData ? JSON.parse(userData) : null;
};

// Helper function to set user data
export const setUserData = (user) => {
  localStorage.setItem('userData', JSON.stringify(user));
};

// Helper function to remove user data
export const removeUserData = () => {
  localStorage.removeItem('userData');
};

// Generic API request function
const apiRequest = async (endpoint, options = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
      ...(getAuthToken() ? { 'Authorization': `Bearer ${getAuthToken()}` } : {}),
    },
    cache: 'no-store', // Disable caching
  };

  // Merge headers properly
  const mergedOptions = {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...options.headers,
    },
  };

  try {
    const response = await fetch(url, mergedOptions);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'API request failed');
    }

    return data;
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
};

// Auth API calls
export const authAPI = {
  signup: async (username, email, password) => {
    return apiRequest('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ username, email, password }),
    });
  },

  login: async (username, password) => {
    return apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  },

  verify: async () => {
    return apiRequest('/auth/verify', {
      method: 'GET',
    });
  },

  logout: async () => {
    return apiRequest('/auth/logout', {
      method: 'POST',
    });
  },
};

// User API calls
export const userAPI = {
  getProfile: async () => {
    return apiRequest('/user/profile', {
      method: 'GET',
    });
  },
};

// ML Model API calls
export const mlAPI = {
  predict: async (windSpeed) => {
    console.log(`API: Requesting prediction for wind speed ${windSpeed} m/s`);
    const requestTime = Date.now();
    
    const response = await apiRequest('/ml/predict', {
      method: 'POST',
      body: JSON.stringify({ windSpeed }),
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
    
    console.log(`API: Received response for wind speed ${windSpeed} m/s (${Date.now() - requestTime}ms)`, response);
    return response;
  },

  predictBatch: async (windSpeeds) => {
    return apiRequest('/ml/predict-batch', {
      method: 'POST',
      body: JSON.stringify({ windSpeeds }),
    });
  },

  getModelInfo: async () => {
    return apiRequest('/ml/model-info', {
      method: 'GET',
    });
  },
};

// Health check
export const checkHealth = async () => {
  return apiRequest('/health', {
    method: 'GET',
  });
};

export default {
  authAPI,
  userAPI,
  mlAPI,
  checkHealth,
  getAuthToken,
  setAuthToken,
  removeAuthToken,
  getUserData,
  setUserData,
  removeUserData,
};
