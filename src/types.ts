export type RideStatus = 'IDLE' | 'STARTED' | 'PAUSED' | 'COMPLETED';

export interface GPSPoint {
  latitude: number;
  longitude: number;
  accuracy: number; // in meters
  timestamp: number; // ms
  speed?: number | null; // m/s or km/h
  heading?: number | null;
  altitude?: number | null;
  isMoving?: boolean;
}

export interface RideLocationHistoryItem extends GPSPoint {
  accumulatedDistanceKm: number;
  deltaDistanceKm: number;
  isFilteredOut?: boolean;
  filterReason?: string;
  isMoving?: boolean;
}

export interface Ride {
  ride_id: string;
  passenger_id: string;
  passenger_name: string;
  bike_id: string;
  bike_name: string;
  bike_type: 'Motorcycle' | 'Standard City' | 'Electric Boost' | 'Cruiser Pro' | 'Cargo Eco' | string;
  status: RideStatus;
  start_time: string; // ISO
  end_time: string | null; // ISO
  start_latitude: number;
  start_longitude: number;
  start_address?: string;
  end_latitude: number | null;
  end_longitude: number | null;
  end_address?: string;
  total_distance_km: number;
  rate_per_km: number;
  base_unlock_fee: number;
  minimum_fare: number;
  final_fare: number;
  locations: RideLocationHistoryItem[];
  duration_seconds: number;
  pause_duration_seconds: number;
  max_speed_kmh: number;
  avg_speed_kmh: number;
  created_at: string;
  updated_at: string;
  payment_status?: 'UNPAID' | 'PAID';
}

export interface PricingSettings {
  rate_per_km: number; // default: 10
  base_unlock_fee: number; // default: 0
  minimum_fare: number; // default: 10
  currency_symbol: string; // '₹'
  max_gps_accuracy_threshold_m: number; // default: 45 meters
  max_speed_kmh: number; // default: 45 km/h (bikes won't exceed this realistically)
  min_movement_threshold_m: number; // default: 3 meters (ignores stationary jitter)
  auto_sync_interval_ms: number; // 2000 ms
  keep_screen_on?: boolean; // Keep screen awake / do not turn screen off
}

export interface BikeInfo {
  id: string;
  name: string;
  type: 'Motorcycle' | 'Standard City' | 'Electric Boost' | 'Cruiser Pro' | 'Cargo Eco' | string;
  battery_level: number; // 0 - 100
  location_name: string;
  latitude: number;
  longitude: number;
  is_available: boolean;
  qr_code: string;
  distance_from_user_m?: number;
}

export interface GPSSignalStatus {
  hasPermission: boolean;
  isTracking: boolean;
  accuracy: number | null; // meters
  quality: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'SEARCHING' | 'DENIED' | 'UNAVAILABLE';
  lastPingTimestamp: number | null;
  errorMessage?: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role?: string;
  memberSince: string;
  totalRides?: number;
  walletBalance?: number;
  preferredVehicle?: string;
}

export interface TestResultItem {
  id: string;
  title: string;
  description: string;
  expected: string | number;
  actual: string | number;
  passed: boolean;
  details?: string;
}
