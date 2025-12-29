import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PickupRequest, Driver } from '../services/api';

interface Location {
  latitude: number;
  longitude: number;
  address: string;
}

interface AppState {
  // Auth
  isAdminLoggedIn: boolean;
  adminToken: string | null;
  setAdminLoggedIn: (loggedIn: boolean, token?: string) => void;
  logout: () => void;

  // Location
  currentLocation: Location | null;
  setCurrentLocation: (location: Location | null) => void;

  // Pickup form state
  pickupLocation: Location | null;
  wasteImage: string | null;
  wasteType: string | null;
  quantity: string | null;
  userContact: string;
  notes: string;
  setPickupLocation: (location: Location | null) => void;
  setWasteImage: (image: string | null) => void;
  setWasteType: (type: string | null) => void;
  setQuantity: (qty: string | null) => void;
  setUserContact: (contact: string) => void;
  setNotes: (notes: string) => void;
  resetPickupForm: () => void;

  // Recent requests
  recentRequests: PickupRequest[];
  setRecentRequests: (requests: PickupRequest[]) => void;

  // Tracking
  trackingRequestId: string | null;
  setTrackingRequestId: (id: string | null) => void;

  // Admin data
  drivers: Driver[];
  setDrivers: (drivers: Driver[]) => void;
  allRequests: PickupRequest[];
  setAllRequests: (requests: PickupRequest[]) => void;

  // Loading states
  isLoading: boolean;
  setLoading: (loading: boolean) => void;
}

export const useStore = create<AppState>((set, get) => ({
  // Auth
  isAdminLoggedIn: false,
  adminToken: null,
  setAdminLoggedIn: async (loggedIn, token) => {
    if (token) {
      await AsyncStorage.setItem('admin_token', token);
    }
    set({ isAdminLoggedIn: loggedIn, adminToken: token || null });
  },
  logout: async () => {
    await AsyncStorage.removeItem('admin_token');
    set({ isAdminLoggedIn: false, adminToken: null });
  },

  // Location
  currentLocation: null,
  setCurrentLocation: (location) => set({ currentLocation: location }),

  // Pickup form state
  pickupLocation: null,
  wasteImage: null,
  wasteType: null,
  quantity: null,
  userContact: '',
  notes: '',
  setPickupLocation: (location) => set({ pickupLocation: location }),
  setWasteImage: (image) => set({ wasteImage: image }),
  setWasteType: (type) => set({ wasteType: type }),
  setQuantity: (qty) => set({ quantity: qty }),
  setUserContact: (contact) => set({ userContact: contact }),
  setNotes: (notes) => set({ notes: notes }),
  resetPickupForm: () => set({
    pickupLocation: null,
    wasteImage: null,
    wasteType: null,
    quantity: null,
    userContact: '',
    notes: '',
  }),

  // Recent requests
  recentRequests: [],
  setRecentRequests: (requests) => set({ recentRequests: requests }),

  // Tracking
  trackingRequestId: null,
  setTrackingRequestId: (id) => set({ trackingRequestId: id }),

  // Admin data
  drivers: [],
  setDrivers: (drivers) => set({ drivers }),
  allRequests: [],
  setAllRequests: (requests) => set({ allRequests: requests }),

  // Loading
  isLoading: false,
  setLoading: (loading) => set({ isLoading: loading }),
}));
