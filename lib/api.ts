import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// API base URL - configure in .env
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

// Create axios instance
const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// Request interceptor to add auth token
api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid - clear storage
      await AsyncStorage.removeItem('authToken');
      await AsyncStorage.removeItem('user');
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  signup: async (data: {
    email: string;
    password: string;
    name: string;
    phone?: string;
  }) => {
    const response = await api.post('/auth/signup', data);
    return response.data;
  },

  login: async (data: { email: string; password: string }) => {
    const response = await api.post('/auth/login', data);
    return response.data;
  },
};

// Stations API
export const stationsApi = {
  list: async (params?: {
    lat?: number;
    lng?: number;
    radius?: number;
    city?: string;
    state?: string;
    fuelType?: string;
  }) => {
    const response = await api.get('/stations', { params });
    return response.data;
  },
};

// Suggest pumps API
export const suggestPumpsApi = {
  suggest: async (data: {
    plate?: string;
    lat: number;
    lng: number;
    fuelType?: string;
    radiusKm?: number;
    searchQuery?: string;
    sortBy?: 'distance' | 'rating' | 'name';
  }) => {
    const response = await api.post('/suggest-pumps', data);
    return response.data;
  },
};

// Search stations API (Google Maps style)
export const searchStationsApi = {
  search: async (data: {
    query: string;
    lat?: number;
    lng?: number;
    fuelTypes?: string[];
    radiusKm?: number;
    limit?: number;
  }) => {
    const response = await api.post('/stations/search', data);
    return response.data;
  },
};

// Route planning API (travel from origin to destination)
export const routePlanningApi = {
  planRoute: async (data: {
    origin: {
      lat: number;
      lng: number;
      address?: string;
    };
    destination: {
      lat: number;
      lng: number;
      address?: string;
    };
    travelMode?: 'driving' | 'motorcycle' | 'transit' | 'walking' | 'bicycling';
    fuelType?: string;
    avoidTolls?: boolean;
    avoidHighways?: boolean;
  }) => {
    const response = await api.post('/routes/plan', data);
    return response.data;
  },
};

// Places API (autocomplete and details)
export const placesApi = {
  autocomplete: async (data: {
    input: string;
    lat?: number;
    lng?: number;
    radius?: number;
    types?: string;
  }) => {
    const response = await api.post('/places/autocomplete', data);
    return response.data;
  },
  
  getDetails: async (placeId: string) => {
    const response = await api.post('/places/details', { placeId });
    return response.data;
  },
};

export default api;
