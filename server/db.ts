import { Ride, BikeInfo, PricingSettings, RideLocationHistoryItem } from '../src/types';
import { backendCalculateFare, backendHaversineDistanceKm } from './fareEngine';

// Default global pricing settings (Configurable via Admin API)
export let pricingSettings: PricingSettings = {
  rate_per_km: 10.0, // Default ₹10 per km
  base_unlock_fee: 0.0,
  minimum_fare: 0.0, // 0.0 allows pure proportional distance billing (e.g. ₹1 for 0.1km, ₹5 for 0.5km)
  currency_symbol: '₹',
  max_gps_accuracy_threshold_m: 150,
  max_speed_kmh: 80,
  min_movement_threshold_m: 0.5,
  auto_sync_interval_ms: 2000,
  keep_screen_on: true, // Default: Keep screen awake (do not screen off)
};

export function updatePricingSettings(newSettings: Partial<PricingSettings>): PricingSettings {
  pricingSettings = {
    ...pricingSettings,
    ...newSettings,
    rate_per_km: Number(newSettings.rate_per_km ?? pricingSettings.rate_per_km),
    base_unlock_fee: Number(newSettings.base_unlock_fee ?? pricingSettings.base_unlock_fee),
    minimum_fare: Number(newSettings.minimum_fare ?? pricingSettings.minimum_fare),
    keep_screen_on:
      newSettings.keep_screen_on !== undefined
        ? Boolean(newSettings.keep_screen_on)
        : pricingSettings.keep_screen_on,
  };
  return pricingSettings;
}

// Available bikes fleet
export const bikesCatalog: BikeInfo[] = [
  {
    id: 'PB65AA1257',
    name: 'Mahindra Centuro PB65AA1257',
    type: 'Motorcycle',
    battery_level: 100,
    location_name: 'Origin Base Station',
    latitude: 12.971598,
    longitude: 77.594562,
    is_available: true,
    qr_code: 'PB65AA1257',
  },
];

// Rides history store (Starts empty for fresh rides)
export const ridesStore: Map<string, Ride> = new Map();

export function getAllRides(): Ride[] {
  return Array.from(ridesStore.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

export function getRideById(id: string): Ride | undefined {
  return ridesStore.get(id);
}

export function saveRide(ride: Ride): Ride {
  ride.updated_at = new Date().toISOString();
  ridesStore.set(ride.ride_id, ride);
  return ride;
}

export function updateBikeAvailability(bikeId: string, isAvailable: boolean) {
  const bike = bikesCatalog.find((b) => b.id === bikeId);
  if (bike) {
    bike.is_available = isAvailable;
  }
}

// User accounts store
export interface UserAccount {
  id: string;
  name: string;
  email: string;
  password?: string;
  phone?: string;
  role?: 'admin' | 'rider';
  memberSince: string;
  totalRides: number;
  walletBalance: number;
  preferredVehicle?: string;
}

const usersStore = new Map<string, UserAccount>();

export function findUserByEmail(email: string): UserAccount | undefined {
  return usersStore.get(email.toLowerCase().trim());
}

export function createUser(user: UserAccount): UserAccount {
  usersStore.set(user.email.toLowerCase().trim(), user);
  return user;
}

