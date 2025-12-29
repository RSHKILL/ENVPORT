// EcoPort Design System

export const Colors = {
  primary: '#43A047',      // Primary Green
  secondary: '#1E88E5',    // Secondary Blue
  ctaGold: '#FFD700',      // CTA Gold
  backgroundStart: '#F8FAFF',
  backgroundEnd: '#E3F2FD',
  textDark: '#2C3E50',
  textGray: '#7F8C8D',
  white: '#FFFFFF',
  black: '#000000',
  error: '#E53935',
  success: '#43A047',
  warning: '#FB8C00',
  cardBackground: '#FFFFFF',
  border: '#E0E0E0',
  overlay: 'rgba(0, 0, 0, 0.5)',
};

export const Spacing = {
  xs: 8,
  sm: 16,
  md: 24,
  lg: 32,
  xl: 40,
  xxl: 48,
};

export const Typography = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 24,
  xxl: 32,
};

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  round: 999,
};

export const Shadows = {
  elevation2: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  elevation4: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  elevation6: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },
};

export const WasteTypes = [
  { id: 'Organic', label: 'Organic', icon: 'leaf' },
  { id: 'Plastic', label: 'Plastic', icon: 'water' },
  { id: 'Metal', label: 'Metal', icon: 'construct' },
  { id: 'E-Waste', label: 'E-Waste', icon: 'phone-portrait' },
  { id: 'Mixed', label: 'Mixed', icon: 'layers' },
];

export const Quantities = [
  { id: 'Small', label: 'Small', description: 'Up to 5kg' },
  { id: 'Medium', label: 'Medium', description: '5-20kg' },
  { id: 'Large', label: 'Large', description: '20-50kg' },
  { id: 'Bulk', label: 'Bulk', description: '50kg+' },
];

export const StatusColors: Record<string, string> = {
  Pending: '#FB8C00',
  Approved: '#1E88E5',
  Assigned: '#7B1FA2',
  Completed: '#43A047',
};
