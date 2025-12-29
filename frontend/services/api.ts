import axios from 'axios';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8001';

const api = axios.create({
  baseURL: `${BASE_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('admin_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Types
export interface Location {
  latitude: number;
  longitude: number;
  address: string;
}

export interface PickupRequest {
  id: string;
  location: Location;
  waste_image: string;
  waste_type: string;
  quantity: string;
  estimated_cost: number;
  actual_cost: number | null;
  distance_km: number;
  status: 'Pending' | 'Approved' | 'Assigned' | 'Completed';
  user_contact: string | null;
  notes: string | null;
  driver_id: string | null;
  payment_method: string | null;
  payment_status: string;
  created_at: string;
  updated_at: string;
}

export interface Driver {
  id: string;
  name: string;
  phone: string;
  vehicle_type: string;
  vehicle_number: string;
  status: 'Available' | 'Busy' | 'Offline';
  created_at: string;
}

export interface Rating {
  id: string;
  pickup_id: string;
  rating: number;
  feedback: string | null;
  created_at: string;
}

export interface Stats {
  pending: number;
  approved: number;
  assigned: number;
  completed: number;
  total: number;
}

// Auth API
export const authApi = {
  login: async (username: string, password: string) => {
    const response = await api.post('/auth/login', { username, password });
    return response.data;
  },
  getMe: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },
};

// Pickup Requests API
export const pickupApi = {
  create: async (data: {
    location: Location;
    waste_image: string;
    waste_type: string;
    quantity: string;
    user_contact?: string;
    notes?: string;
    payment_method?: string;
  }) => {
    const response = await api.post('/pickup-requests', data);
    return response.data as PickupRequest;
  },
  getAll: async (status?: string, limit = 50, skip = 0) => {
    const params: any = { limit, skip };
    if (status) params.status = status;
    const response = await api.get('/pickup-requests', { params });
    return response.data as PickupRequest[];
  },
  getById: async (id: string) => {
    const response = await api.get(`/pickup-requests/${id}`);
    return response.data as PickupRequest;
  },
  update: async (id: string, data: {
    status?: string;
    actual_cost?: number;
    notes?: string;
    payment_status?: string;
  }) => {
    const response = await api.put(`/pickup-requests/${id}`, data);
    return response.data as PickupRequest;
  },
  assignDriver: async (requestId: string, driverId: string) => {
    const response = await api.post(`/pickup-requests/${requestId}/assign-driver?driver_id=${driverId}`);
    return response.data as PickupRequest;
  },
};

// Drivers API
export const driversApi = {
  create: async (data: {
    name: string;
    phone: string;
    vehicle_type: string;
    vehicle_number: string;
  }) => {
    const response = await api.post('/drivers', data);
    return response.data as Driver;
  },
  getAll: async (status?: string) => {
    const params: any = {};
    if (status) params.status = status;
    const response = await api.get('/drivers', { params });
    return response.data as Driver[];
  },
  getById: async (id: string) => {
    const response = await api.get(`/drivers/${id}`);
    return response.data as Driver;
  },
  updateStatus: async (id: string, status: string) => {
    const response = await api.put(`/drivers/${id}/status?status=${status}`);
    return response.data as Driver;
  },
};

// Ratings API
export const ratingsApi = {
  create: async (data: {
    pickup_id: string;
    rating: number;
    feedback?: string;
  }) => {
    const response = await api.post('/ratings', data);
    return response.data as Rating;
  },
  getByPickupId: async (pickupId: string) => {
    const response = await api.get(`/ratings/${pickupId}`);
    return response.data as Rating;
  },
};

// Stats API
export const statsApi = {
  get: async () => {
    const response = await api.get('/stats');
    return response.data as Stats;
  },
};

// Calculate cost preview
export const calculateCost = async (
  latitude: number,
  longitude: number,
  quantity: string,
  waste_type: string
) => {
  const response = await api.post('/calculate-cost', null, {
    params: { latitude, longitude, quantity, waste_type }
  });
  return response.data;
};

export default api;
