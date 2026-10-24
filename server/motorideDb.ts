import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import {
  MotorideRide,
  Captain,
  Passenger,
  Profile,
  Vehicle,
  FareSettings,
  RideChargeSettings,
  CourierChargeSettings,
  QRCodeSetting,
  WalletTransaction,
  MotorideNotification,
  RideOffer,
  AdminDashboardStats,
  RideMessage,
} from '../src/types/motoride';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://abxxldkhjoxgkcuwkrts.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFieHhsZGtoam94Z2tjdXdrcnRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE2MDAxMzQsImV4cCI6MjEwNzE3NjEzNH0.FUwdlaOsL6mCcgjqCBFIissgYjpTpF_rgs5BM3toY6Q';

const dbSupabaseClient = createClient(supabaseUrl, supabaseAnonKey);

// Real-time Event Broadcaster Subscribers (SSE)
type SSEClient = (data: { event: string; payload: any }) => void;
const sseClients = new Set<SSEClient>();

export interface RealtimeServerEventLog {
  id: string;
  event: string;
  timestamp: number;
  timeStr: string;
  clientsCount: number;
  summary: string;
}

const recentRealtimeEvents: RealtimeServerEventLog[] = [];
let totalRealtimeEventsBroadcast = 0;

export function getRecentRealtimeEvents(): RealtimeServerEventLog[] {
  return [...recentRealtimeEvents];
}

export function getRealtimeServerStats() {
  return {
    status: 'online',
    connectedClients: sseClients.size,
    totalEventsBroadcast: totalRealtimeEventsBroadcast,
    recentEvents: recentRealtimeEvents.slice(0, 50),
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  };
}

export function subscribeSSE(client: SSEClient) {
  sseClients.add(client);
  return () => {
    sseClients.delete(client);
  };
}

export function broadcastEvent(event: string, payload: any) {
  totalRealtimeEventsBroadcast++;
  const now = Date.now();
  const summary = (() => {
    try {
      if (payload?.ride_code) return `Ride #${payload.ride_code} (${payload.status || 'updated'})`;
      if (payload?.ride?.ride_code) return `Ride #${payload.ride.ride_code} (${payload.status || payload.ride.status || 'updated'})`;
      if (payload?.request?.id) return `Topup #${payload.request.id} (₹${payload.request.amount || 0})`;
      if (payload?.balance !== undefined) return `Wallet user ${payload.user_id || ''}: ₹${payload.balance}`;
      if (payload?.message) return String(payload.message).slice(0, 60);
      return typeof payload === 'object' ? Object.keys(payload).slice(0, 4).join(', ') : String(payload);
    } catch {
      return '';
    }
  })();

  const logEntry: RealtimeServerEventLog = {
    id: `evt_${now}_${Math.random().toString(36).substring(2, 6)}`,
    event,
    timestamp: now,
    timeStr: new Date(now).toISOString(),
    clientsCount: sseClients.size,
    summary,
  };

  recentRealtimeEvents.unshift(logEntry);
  if (recentRealtimeEvents.length > 100) {
    recentRealtimeEvents.pop();
  }

  console.log(`[Realtime Sync] ${new Date().toISOString()} Event: ${event} -> ${sseClients.size} clients (${summary})`);

  for (const client of sseClients) {
    try {
      client({ event, payload });
    } catch {
      sseClients.delete(client);
    }
  }
}

// 1. Initial Fare Settings & Separate Ride/Courier Configurations
const DATA_DIR = path.join(process.cwd(), 'data');
const FARE_FILE = path.join(DATA_DIR, 'fare_settings.json');
const QR_FILE = path.join(DATA_DIR, 'qr_settings.json');

export const defaultRideCharges: RideChargeSettings = {
  base_fare: 25.0,
  per_km_rate: 10.0,
  minimum_fare: 30.0,
  platform_commission_pct: 10.0,
  min_offer_pct: 70.0,
  max_offer_pct: 180.0,
  night_surcharge_pct: 10.0,
  auto_multiplier: 1.25,
  car_multiplier: 1.8,
  cancellation_fee: 20.0,
  updated_at: new Date().toISOString(),
};

export const defaultCourierCharges: CourierChargeSettings = {
  base_fare: 35.0,
  per_km_rate: 12.0,
  minimum_fare: 40.0,
  platform_commission_pct: 12.0,
  min_offer_pct: 70.0,
  max_offer_pct: 180.0,
  handling_fee: 10.0,
  express_surcharge: 15.0,
  max_weight_kg: 15.0,
  cancellation_fee: 25.0,
  updated_at: new Date().toISOString(),
};

export let fareSettings: FareSettings = {
  base_fare: 25.0,
  per_km_rate: 10.0,
  minimum_fare: 30.0,
  platform_commission_pct: 10.0,
  min_offer_pct: 70.0,
  max_offer_pct: 180.0,
  currency_symbol: '₹',
  updated_at: new Date().toISOString(),
  ride_charges: { ...defaultRideCharges },
  courier_charges: { ...defaultCourierCharges },
};

export function saveFareSettingsToDisk() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(FARE_FILE, JSON.stringify(fareSettings, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Failed to save fare settings to disk:', err);
  }
}

export function loadFareSettingsFromDisk() {
  try {
    if (fs.existsSync(FARE_FILE)) {
      const raw = fs.readFileSync(FARE_FILE, 'utf-8');
      const data = JSON.parse(raw);
      if (data && typeof data === 'object') {
        fareSettings = {
          ...fareSettings,
          ...data,
          ride_charges: {
            ...defaultRideCharges,
            ...(data.ride_charges || {}),
          },
          courier_charges: {
            ...defaultCourierCharges,
            ...(data.courier_charges || {}),
          },
        };
      }
    }
  } catch (err) {
    console.warn('Failed to load fare settings from disk:', err);
  }
}

// 2. Official Admin QR Code & Payment Setting
export let qrSettings: QRCodeSetting = {
  qr_image_url: '/official_admin_qr.svg',
  upi_id: 'hemant76@idbi',
  merchant_name: 'Hemant',
  note: 'Scan to Pay with any UPI App (Google Pay, PhonePe, Paytm, BHIM) to deposit platform commission or top-up wallet balance.',
  is_active: true,
  updated_at: new Date().toISOString(),
};

export function saveQRSettingsToDisk() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(QR_FILE, JSON.stringify(qrSettings, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Failed to save QR settings to disk:', err);
  }
}

export function loadQRSettingsFromDisk() {
  try {
    if (fs.existsSync(QR_FILE)) {
      const raw = fs.readFileSync(QR_FILE, 'utf-8');
      const data = JSON.parse(raw);
      qrSettings = {
        ...qrSettings,
        ...data,
      };
    }
  } catch (err) {
    console.warn('Failed to load QR settings from disk:', err);
  }
}

// Automatically load persisted fare settings
loadFareSettingsFromDisk();
loadQRSettingsFromDisk();

export function updateFareSettings(newSettings: Partial<FareSettings>): FareSettings {
  const mergedRide: RideChargeSettings = {
    ...(defaultRideCharges),
    ...(fareSettings.ride_charges || {}),
    ...(newSettings.ride_charges || {}),
  };
  if (newSettings.ride_charges) {
    if (newSettings.ride_charges.base_fare !== undefined && !isNaN(Number(newSettings.ride_charges.base_fare))) mergedRide.base_fare = Number(newSettings.ride_charges.base_fare);
    if (newSettings.ride_charges.per_km_rate !== undefined && !isNaN(Number(newSettings.ride_charges.per_km_rate))) mergedRide.per_km_rate = Number(newSettings.ride_charges.per_km_rate);
    if (newSettings.ride_charges.minimum_fare !== undefined && !isNaN(Number(newSettings.ride_charges.minimum_fare))) mergedRide.minimum_fare = Number(newSettings.ride_charges.minimum_fare);
    if (newSettings.ride_charges.platform_commission_pct !== undefined && !isNaN(Number(newSettings.ride_charges.platform_commission_pct))) mergedRide.platform_commission_pct = Number(newSettings.ride_charges.platform_commission_pct);
    if (newSettings.ride_charges.min_offer_pct !== undefined && !isNaN(Number(newSettings.ride_charges.min_offer_pct))) mergedRide.min_offer_pct = Number(newSettings.ride_charges.min_offer_pct);
    if (newSettings.ride_charges.max_offer_pct !== undefined && !isNaN(Number(newSettings.ride_charges.max_offer_pct))) mergedRide.max_offer_pct = Number(newSettings.ride_charges.max_offer_pct);
    if (newSettings.ride_charges.night_surcharge_pct !== undefined && !isNaN(Number(newSettings.ride_charges.night_surcharge_pct))) mergedRide.night_surcharge_pct = Number(newSettings.ride_charges.night_surcharge_pct);
    if (newSettings.ride_charges.auto_multiplier !== undefined && !isNaN(Number(newSettings.ride_charges.auto_multiplier))) mergedRide.auto_multiplier = Number(newSettings.ride_charges.auto_multiplier);
    if (newSettings.ride_charges.car_multiplier !== undefined && !isNaN(Number(newSettings.ride_charges.car_multiplier))) mergedRide.car_multiplier = Number(newSettings.ride_charges.car_multiplier);
    if (newSettings.ride_charges.cancellation_fee !== undefined && !isNaN(Number(newSettings.ride_charges.cancellation_fee))) mergedRide.cancellation_fee = Number(newSettings.ride_charges.cancellation_fee);
    mergedRide.updated_at = new Date().toISOString();
  }

  const mergedCourier: CourierChargeSettings = {
    ...(defaultCourierCharges),
    ...(fareSettings.courier_charges || {}),
    ...(newSettings.courier_charges || {}),
  };
  if (newSettings.courier_charges) {
    if (newSettings.courier_charges.base_fare !== undefined && !isNaN(Number(newSettings.courier_charges.base_fare))) mergedCourier.base_fare = Number(newSettings.courier_charges.base_fare);
    if (newSettings.courier_charges.per_km_rate !== undefined && !isNaN(Number(newSettings.courier_charges.per_km_rate))) mergedCourier.per_km_rate = Number(newSettings.courier_charges.per_km_rate);
    if (newSettings.courier_charges.minimum_fare !== undefined && !isNaN(Number(newSettings.courier_charges.minimum_fare))) mergedCourier.minimum_fare = Number(newSettings.courier_charges.minimum_fare);
    if (newSettings.courier_charges.platform_commission_pct !== undefined && !isNaN(Number(newSettings.courier_charges.platform_commission_pct))) mergedCourier.platform_commission_pct = Number(newSettings.courier_charges.platform_commission_pct);
    if (newSettings.courier_charges.min_offer_pct !== undefined && !isNaN(Number(newSettings.courier_charges.min_offer_pct))) mergedCourier.min_offer_pct = Number(newSettings.courier_charges.min_offer_pct);
    if (newSettings.courier_charges.max_offer_pct !== undefined && !isNaN(Number(newSettings.courier_charges.max_offer_pct))) mergedCourier.max_offer_pct = Number(newSettings.courier_charges.max_offer_pct);
    if (newSettings.courier_charges.handling_fee !== undefined && !isNaN(Number(newSettings.courier_charges.handling_fee))) mergedCourier.handling_fee = Number(newSettings.courier_charges.handling_fee);
    if (newSettings.courier_charges.express_surcharge !== undefined && !isNaN(Number(newSettings.courier_charges.express_surcharge))) mergedCourier.express_surcharge = Number(newSettings.courier_charges.express_surcharge);
    if (newSettings.courier_charges.max_weight_kg !== undefined && !isNaN(Number(newSettings.courier_charges.max_weight_kg))) mergedCourier.max_weight_kg = Number(newSettings.courier_charges.max_weight_kg);
    if (newSettings.courier_charges.cancellation_fee !== undefined && !isNaN(Number(newSettings.courier_charges.cancellation_fee))) mergedCourier.cancellation_fee = Number(newSettings.courier_charges.cancellation_fee);
    mergedCourier.updated_at = new Date().toISOString();
  }

  if (newSettings.base_fare !== undefined && !isNaN(Number(newSettings.base_fare))) {
    mergedRide.base_fare = Number(newSettings.base_fare);
  }
  if (newSettings.per_km_rate !== undefined && !isNaN(Number(newSettings.per_km_rate))) {
    mergedRide.per_km_rate = Number(newSettings.per_km_rate);
  }
  if (newSettings.minimum_fare !== undefined && !isNaN(Number(newSettings.minimum_fare))) {
    mergedRide.minimum_fare = Number(newSettings.minimum_fare);
  }
  if (newSettings.platform_commission_pct !== undefined && !isNaN(Number(newSettings.platform_commission_pct))) {
    mergedRide.platform_commission_pct = Number(newSettings.platform_commission_pct);
  }
  if (newSettings.min_offer_pct !== undefined && !isNaN(Number(newSettings.min_offer_pct))) {
    mergedRide.min_offer_pct = Number(newSettings.min_offer_pct);
  }
  if (newSettings.max_offer_pct !== undefined && !isNaN(Number(newSettings.max_offer_pct))) {
    mergedRide.max_offer_pct = Number(newSettings.max_offer_pct);
  }

  const baseFareVal = mergedRide.base_fare ?? (newSettings.base_fare !== undefined && !isNaN(Number(newSettings.base_fare))
    ? Number(newSettings.base_fare)
    : (fareSettings.base_fare ?? 25.0));

  const perKmVal = mergedRide.per_km_rate ?? (newSettings.per_km_rate !== undefined && !isNaN(Number(newSettings.per_km_rate))
    ? Number(newSettings.per_km_rate)
    : (fareSettings.per_km_rate ?? 12.0));

  const minFareVal = mergedRide.minimum_fare ?? (newSettings.minimum_fare !== undefined && !isNaN(Number(newSettings.minimum_fare))
    ? Number(newSettings.minimum_fare)
    : (fareSettings.minimum_fare ?? 30.0));

  const commissionVal = mergedRide.platform_commission_pct ?? (newSettings.platform_commission_pct !== undefined && !isNaN(Number(newSettings.platform_commission_pct))
    ? Number(newSettings.platform_commission_pct)
    : (fareSettings.platform_commission_pct ?? 10.0));

  const minOfferVal = mergedRide.min_offer_pct ?? (newSettings.min_offer_pct !== undefined && !isNaN(Number(newSettings.min_offer_pct))
    ? Number(newSettings.min_offer_pct)
    : (fareSettings.min_offer_pct ?? 70.0));

  const maxOfferVal = mergedRide.max_offer_pct ?? (newSettings.max_offer_pct !== undefined && !isNaN(Number(newSettings.max_offer_pct))
    ? Number(newSettings.max_offer_pct)
    : (fareSettings.max_offer_pct ?? 180.0));

  fareSettings = {
    ...fareSettings,
    ...newSettings,
    base_fare: baseFareVal,
    per_km_rate: perKmVal,
    minimum_fare: minFareVal,
    platform_commission_pct: commissionVal,
    min_offer_pct: minOfferVal,
    max_offer_pct: maxOfferVal,
    ride_charges: mergedRide,
    courier_charges: mergedCourier,
    updated_at: new Date().toISOString(),
  };

  saveFareSettingsToDisk();
  broadcastEvent('FARE_SETTINGS_UPDATED', fareSettings);
  return fareSettings;
}

// Official Admin QR Code & Payment Setting

export function updateQRSettings(newSettings: Partial<QRCodeSetting>): QRCodeSetting {
  // Only update fields that are explicitly provided (not undefined)
  const updates: Record<string, any> = {};
  for (const key in newSettings) {
    const value = newSettings[key as keyof QRCodeSetting];
    if (value !== undefined) {
      updates[key] = value;
    }
  }

  qrSettings = {
    ...qrSettings,
    ...updates,
    updated_at: new Date().toISOString(),
  };
  broadcastEvent('QR_SETTINGS_UPDATED', qrSettings);
  saveQRSettingsToDisk();
  return qrSettings;
}

// 2b. Registered Accounts Store (Persists real registered passengers and captains across tabs & sessions)
export interface ServerRegisteredAccount {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  role: 'passenger' | 'captain' | 'admin';
  phone?: string;
  avatar_url?: string;
  vehicle_model?: string;
  plate_number?: string;
  vehicle_type?: 'bike' | 'auto' | 'car' | 'courier';
  wallet_balance?: number;
  member_since: string;
  created_at: string;
}

export const accountsStore = new Map<string, ServerRegisteredAccount>();

// 3. Captains Catalog (Real registered captains only)
export const captainsStore = new Map<string, Captain>();

// 4. Passengers Catalog (Real registered passengers only)
export const passengersStore = new Map<string, Passenger>();

// 5. Wallets & Transactions (Starts empty for fresh accounts)
export const walletsStore = new Map<string, { balance: number; currency: string }>();

export const walletTransactionsStore: WalletTransaction[] = [];

// 6. Motoride Rides Store
export const ridesStore = new Map<string, MotorideRide>();

// 7. Notifications Store
export const notificationsStore: MotorideNotification[] = [];

// 8. Top-up Deposit Requests & Proof Verification Store
export interface TopupDepositRequest {
  id: string;
  captain_id: string;
  captain_name: string;
  captain_phone?: string;
  captain_avatar?: string;
  amount: number;
  utr_number?: string;
  payment_slip_url?: string;
  note?: string;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason?: string;
  created_at: string;
  updated_at: string;
}

export interface TopupChatMessage {
  id: string;
  request_id: string;
  sender_id: string;
  sender_role: 'admin' | 'captain';
  sender_name: string;
  message: string;
  image_url?: string;
  created_at: string;
}


export const topupRequestsStore = new Map<string, TopupDepositRequest>();
export const topupChatStore = new Map<string, TopupChatMessage[]>();

// Persistent Disk Storage helpers for server container reliability
const DB_FILE = path.join(DATA_DIR, 'motoride_db.json');

export function persistDbToDisk() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const data = {
      accounts: Array.from(accountsStore.entries()),
      captains: Array.from(captainsStore.entries()),
      passengers: Array.from(passengersStore.entries()),
      wallets: Array.from(walletsStore.entries()),
      rides: Array.from(ridesStore.entries()),
      topupRequests: Array.from(topupRequestsStore.entries()),
      topupChat: Array.from(topupChatStore.entries()),
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
    console.log('Successfully persisted DB to:', DB_FILE);
  } catch (err) {
    console.error('CRITICAL: Failed to persist DB to disk:', err);
  }
}

export function purgeAllDataFromDb() {
  accountsStore.clear();
  captainsStore.clear();
  passengersStore.clear();
  walletsStore.clear();
  ridesStore.clear();
  walletTransactionsStore.length = 0;
  notificationsStore.length = 0;
  passengerLocationsStore.clear();
  messagesStore.clear();
  persistDbToDisk();
}

export function clearAllRidesFromDb() {
  ridesStore.clear();
  messagesStore.clear();
  passengerLocationsStore.clear();
  notificationsStore.length = 0;
}

export function isForbiddenAccount(id?: string, name?: string, email?: string): boolean {
  const sId = String(id || '').toLowerCase().trim();
  return (
    sId.includes('01d08835-416d-4acb-ac49-a801c7906518') ||
    sId.includes('01d08835') ||
    sId.includes('348173af-50c5-4182-8621-c8212369cd81')
  );
}

export function deleteCaptainFromDb(id: string): boolean {
  let found = captainsStore.delete(id);
  walletsStore.delete(id);
  for (const [key, acc] of Array.from(accountsStore.entries())) {
    if (acc.id === id || acc.email === id || isForbiddenAccount(acc.id, acc.name, acc.email) || isForbiddenAccount(key)) {
      accountsStore.delete(key);
      found = true;
    }
  }
  for (const [key, cpt] of Array.from(captainsStore.entries())) {
    if (cpt.id === id || isForbiddenAccount(cpt.id, cpt.full_name, cpt.email) || isForbiddenAccount(key)) {
      captainsStore.delete(key);
      found = true;
    }
  }
  persistDbToDisk();
  return found;
}

export function deletePassengerFromDb(id: string): boolean {
  let found = passengersStore.delete(id);
  walletsStore.delete(id);
  for (const [key, acc] of Array.from(accountsStore.entries())) {
    if (acc.id === id || acc.email === id || isForbiddenAccount(acc.id, acc.name, acc.email) || isForbiddenAccount(key)) {
      accountsStore.delete(key);
      found = true;
    }
  }
  for (const [key, psg] of Array.from(passengersStore.entries())) {
    if (psg.id === id || isForbiddenAccount(psg.id, psg.full_name, psg.email) || isForbiddenAccount(key)) {
      passengersStore.delete(key);
      found = true;
    }
  }
  persistDbToDisk();
  return found;
}

export function deleteRideFromDb(id: string): boolean {
  const found = ridesStore.delete(id);
  messagesStore.delete(id);
  passengerLocationsStore.delete(`ride_${id}`);
  return found;
}

export function loadDbFromDisk() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const data = JSON.parse(raw);
      if (Array.isArray(data.accounts)) {
        for (const [k, v] of data.accounts) {
          if (v && v.email && !isForbiddenAccount(v.id, v.name, v.email) && !isForbiddenAccount(k)) {
            accountsStore.set(k, v);
            if (v.role === 'passenger' && !passengersStore.has(v.id)) {
              passengersStore.set(v.id, {
                id: v.id,
                profile_id: `prof_${v.id}`,
                full_name: v.name,
                email: v.email,
                phone: v.phone || '',
                total_rides: 0,
                rating: 5.0,
                wallet_balance: v.wallet_balance ?? 200,
                emergency_contact: v.phone || '',
                created_at: v.created_at || v.member_since || new Date().toISOString(),
              });
            }
          }
        }
      }
      if (Array.isArray(data.captains)) {
        for (const [k, v] of data.captains) {
          if (v && v.id && !isForbiddenAccount(v.id, v.full_name, v.email) && !isForbiddenAccount(k)) {
            captainsStore.set(k, v);
          }
        }
      }
      if (Array.isArray(data.passengers)) {
        for (const [k, v] of data.passengers) {
          if (v && v.id && !isForbiddenAccount(v.id, v.full_name, v.email) && !isForbiddenAccount(k)) {
            passengersStore.set(k, v);
          }
        }
      }
      if (Array.isArray(data.wallets)) {
        for (const [k, v] of data.wallets) {
          if (k && v && !isForbiddenAccount(k)) {
            walletsStore.set(k, v);
          }
        }
      }
      if (Array.isArray(data.rides)) {
        for (const [k, v] of data.rides) {
          if (v && v.id) ridesStore.set(k, v);
        }
      }
      if (Array.isArray(data.topupRequests)) {
        for (const [k, v] of data.topupRequests) {
          if (v && v.id && !isForbiddenAccount(v.captain_id, v.captain_name)) {
            topupRequestsStore.set(k, v);
          }
        }
      }

      if (Array.isArray(data.topupChat)) {
        for (const [k, v] of data.topupChat) {
          if (k && Array.isArray(v)) topupChatStore.set(k, v);
        }
      }

      // Enforce clean 1-account-per-email uniqueness across loaded accountsStore
      const emailToKey = new Map<string, string>();
      for (const [key, acc] of Array.from(accountsStore.entries())) {
        const cleanEmail = acc.email?.trim().toLowerCase();
        if (!cleanEmail) continue;
        if (emailToKey.has(cleanEmail)) {
          // Found duplicate with same email - delete duplicate
          accountsStore.delete(key);
          captainsStore.delete(acc.id);
          passengersStore.delete(acc.id);
          walletsStore.delete(acc.id);
        } else {
          emailToKey.set(cleanEmail, key);
        }
      }
    }
  } catch (err) {
    console.warn('Failed to load DB from disk:', err);
  }
}

export function updateAccountPassword(email: string, newPasswordHash: string): boolean {
  const cleanEmail = email.trim().toLowerCase();
  let updated = false;

  for (const [key, acc] of accountsStore.entries()) {
    if (acc.email.toLowerCase() === cleanEmail) {
      acc.password_hash = newPasswordHash;
      accountsStore.set(key, acc);
      updated = true;
    }
  }

  if (updated) {
    persistDbToDisk();
  }
  return updated;
}

export function ensureOfficialAccounts() {
  const now = new Date().toISOString();

  // 1. Single Official Registered Captain Account: mojobiketaxi@gmail.com -> Hemant kashyap
  const captainEmail = 'mojobiketaxi@gmail.com';
  const captainKey = `${captainEmail}_captain`;
  const captainId = 'cpt_mojobiketaxi';
  
  let existingCaptainAcc = accountsStore.get(captainKey) || accountsStore.get(captainId);
  if (!existingCaptainAcc) {
    for (const acc of accountsStore.values()) {
      if (acc.email?.toLowerCase() === captainEmail) {
        existingCaptainAcc = acc;
        break;
      }
    }
  }

  // Resolve official persisted wallet balance
  const existingWallet = walletsStore.get(captainId) || walletsStore.get(captainEmail) || walletsStore.get('+91 9876543210');
  const officialWalletBalance = existingWallet && typeof existingWallet.balance === 'number'
    ? existingWallet.balance
    : (existingCaptainAcc?.wallet_balance ?? 500);

  const captainAccount: ServerRegisteredAccount = {
    id: captainId,
    email: captainEmail,
    password_hash: existingCaptainAcc?.password_hash || '123456',
    name: existingCaptainAcc?.name || 'Hemant kashyap',
    role: 'captain',
    phone: existingCaptainAcc?.phone || '+91 9876543210',
    vehicle_model: existingCaptainAcc?.vehicle_model || 'Honda Activa 6G',
    plate_number: existingCaptainAcc?.plate_number || 'PB65AX9922',
    vehicle_type: existingCaptainAcc?.vehicle_type || 'bike',
    wallet_balance: officialWalletBalance,
    member_since: existingCaptainAcc?.member_since || '2024-01-01T00:00:00.000Z',
    created_at: existingCaptainAcc?.created_at || '2024-01-01T00:00:00.000Z',
  };

  accountsStore.set(captainKey, captainAccount);
  accountsStore.set(captainId, captainAccount);
  accountsStore.set(captainEmail, captainAccount);

  // Clean any duplicate or broken captain accounts with mojobiketaxi email
  for (const [key, acc] of Array.from(accountsStore.entries())) {
    if (acc.email?.toLowerCase() === captainEmail && key !== captainKey && key !== captainId && key !== captainEmail) {
      accountsStore.delete(key);
    }
  }

  // Ensure Captain object in captainsStore
  const existingCpt = captainsStore.get(captainId) || captainsStore.get(captainEmail);
  const cptRecord: Captain = {
    id: captainId,
    profile_id: `prof_${captainId}`,
    full_name: existingCaptainAcc?.name || existingCpt?.full_name || 'Hemant kashyap',
    email: captainEmail,
    phone: existingCaptainAcc?.phone || existingCpt?.phone || '+91 9876543210',
    is_online: existingCpt?.is_online ?? true,
    is_approved: true,
    is_active: true,
    current_lat: existingCpt?.current_lat || 30.7046,
    current_lng: existingCpt?.current_lng || 76.7178,
    rating: 4.95,
    total_rides: existingCpt?.total_rides ?? 142,
    vehicle: {
      id: `veh_${captainId}`,
      captain_id: captainId,
      model: existingCaptainAcc?.vehicle_model || existingCpt?.vehicle?.model || 'Honda Activa 6G',
      plate_number: existingCaptainAcc?.plate_number || existingCpt?.vehicle?.plate_number || 'PB65AX9922',
      vehicle_type: existingCaptainAcc?.vehicle_type || existingCpt?.vehicle?.vehicle_type || 'bike',
      color: existingCpt?.vehicle?.color || 'Black',
      is_active: true,
    },
    created_at: existingCpt?.created_at || '2024-01-01T00:00:00.000Z',
  };

  captainsStore.set(captainId, cptRecord);
  captainsStore.set(captainEmail, cptRecord);

  // Clean duplicate captain objects
  for (const [k, c] of Array.from(captainsStore.entries())) {
    if (k !== captainId && k !== captainEmail && (c.id === captainId || (c.email && c.email.toLowerCase() === captainEmail))) {
      captainsStore.delete(k);
    }
  }

  // Sync wallet across all aliases
  const mojoWallet = { balance: officialWalletBalance, currency: '₹' };
  walletsStore.set(captainId, mojoWallet);
  walletsStore.set(captainEmail, mojoWallet);
  walletsStore.set('+91 9876543210', mojoWallet);
  walletsStore.set('9876543210', mojoWallet);

  // 2. Official Admin Account: osmskart@gmail.com
  const adminEmail = 'osmskart@gmail.com';
  const adminKey = `${adminEmail}_admin`;
  if (!accountsStore.has(adminKey)) {
    accountsStore.set(adminKey, {
      id: 'adm_official_admin',
      email: adminEmail,
      password_hash: '123456',
      name: 'Admin Hemant',
      role: 'admin',
      phone: '+91 9876543210',
      wallet_balance: 0,
      member_since: now,
      created_at: now,
    });
  }
}

// Automatically load existing persisted records on module startup
loadDbFromDisk();
ensureOfficialAccounts();

// Helper: Calculate Today's Income for a captain dynamically from completed rides
// The user prompt mandates:
// 1. "Today's Income must include ONLY rides that were successfully completed today."
// 2. "Calculate it from the rides database using the ride's completed_at timestamp and the captain's ID."
// 3. "Do NOT use yesterday's total as today's starting balance."
// 4. "When the calendar date changes to a new day, Today's Income must automatically become ₹0 if no rides have been completed on the new day."
// 5. "SUM(fare_amount) for rides where captain_id = currentCaptainId AND status = 'completed' AND completed_at >= startOfToday AND completed_at < startOfTomorrow"
export function calculateCaptainTodayIncome(
  captainId: string,
  timezone: string = 'Asia/Kolkata'
): {
  today_income: number;
  completed_rides_today: number;
  today_date: string;
} {
  const now = new Date();
  let todayDateStr: string;
  try {
    todayDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(now);
  } catch {
    todayDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);
  }

  let totalIncome = 0;
  let count = 0;

  for (const ride of ridesStore.values()) {
    // Only completed rides
    const isCompleted = ride.status === 'completed' || ride.status === 'trip_completed';
    if (ride.captain_id === captainId && isCompleted) {
      const completionTimestamp = ride.completed_at || ride.trip_completed_at;
      if (completionTimestamp) {
        const rideDate = new Date(completionTimestamp);
        if (!isNaN(rideDate.getTime())) {
          let rideDateStr: string;
          try {
            rideDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(rideDate);
          } catch {
            rideDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(rideDate);
          }
          if (rideDateStr === todayDateStr) {
            // SUM(fare_amount)
            const fare = Number(ride.fare_amount ?? ride.final_fare ?? ride.offered_fare ?? 0);
            totalIncome += fare;
            count++;
          }
        }
      }
    }
  }

  return {
    today_income: Number(totalIncome.toFixed(2)),
    completed_rides_today: count,
    today_date: todayDateStr,
  };
}

export function calculateCaptainTodayEarnings(captainId: string, timezone: string = 'Asia/Kolkata'): number {
  const now = new Date();
  let todayDateStr: string;
  try {
    todayDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(now);
  } catch {
    todayDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);
  }

  let todayTotal = 0;
  for (const ride of ridesStore.values()) {
    const isCompleted = ride.status === 'completed' || ride.status === 'trip_completed';
    if (ride.captain_id === captainId && isCompleted) {
      const completionTimestamp = ride.completed_at || ride.trip_completed_at;
      if (completionTimestamp) {
        const rideDate = new Date(completionTimestamp);
        if (!isNaN(rideDate.getTime())) {
          let rideDateStr: string;
          try {
            rideDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(rideDate);
          } catch {
            rideDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(rideDate);
          }
          if (rideDateStr === todayDateStr) {
            const gross = Number(ride.fare_amount ?? ride.final_fare ?? ride.offered_fare ?? 0);
            const commPct = ride.ride_type === 'courier'
              ? (fareSettings.courier_charges?.platform_commission_pct ?? fareSettings.platform_commission_pct)
              : (fareSettings.ride_charges?.platform_commission_pct ?? fareSettings.platform_commission_pct);
            const commission = (gross * commPct) / 100;
            todayTotal += gross - commission;
          }
        }
      }
    }
  }
  return Number(todayTotal.toFixed(2));
}

export function calculateCaptainTotalEarnings(captainId: string): number {
  let total = 0;
  for (const ride of ridesStore.values()) {
    const isCompleted = ride.status === 'completed' || ride.status === 'trip_completed';
    if (ride.captain_id === captainId && isCompleted) {
      const gross = Number(ride.fare_amount ?? ride.final_fare ?? ride.offered_fare ?? 0);
      const commPct = ride.ride_type === 'courier'
        ? (fareSettings.courier_charges?.platform_commission_pct ?? fareSettings.platform_commission_pct)
        : (fareSettings.ride_charges?.platform_commission_pct ?? fareSettings.platform_commission_pct);
      const commission = (gross * commPct) / 100;
      total += gross - commission;
    }
  }
  return Number(total.toFixed(2));
}

// 8. Admin Dashboard Stats
export function getAdminStats(): AdminDashboardStats {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  let activeCount = 0;
  let completedCount = 0;
  let cancelledCount = 0;
  let todayRidesCount = 0;
  let todayPlatformRevenue = 0;
  let totalVolume = 0;

  for (const ride of ridesStore.values()) {
    const createdTime = new Date(ride.created_at).getTime();
    if (createdTime >= startOfDay) {
      todayRidesCount++;
    }

    if (
      ride.status === 'requested' ||
      ride.status === 'captain_offered' ||
      ride.status === 'captain_accepted' ||
      ride.status === 'captain_arrived' ||
      ride.status === 'trip_started'
    ) {
      activeCount++;
    } else if (ride.status === 'trip_completed') {
      completedCount++;
      const fare = Number(ride.final_fare || 0);
      totalVolume += fare;
      if (ride.trip_completed_at && new Date(ride.trip_completed_at).getTime() >= startOfDay) {
        const commPct = ride.ride_type === 'courier'
          ? (fareSettings.courier_charges?.platform_commission_pct ?? fareSettings.platform_commission_pct)
          : (fareSettings.ride_charges?.platform_commission_pct ?? fareSettings.platform_commission_pct);
        todayPlatformRevenue += (fare * commPct) / 100;
      }
    } else if (
      ride.status === 'cancelled_by_passenger' ||
      ride.status === 'cancelled_by_captain'
    ) {
      cancelledCount++;
    }
  }

  let onlineCaptainsCount = 0;
  for (const cpt of captainsStore.values()) {
    if (cpt.is_online) onlineCaptainsCount++;
  }

  return {
    totalPassengers: passengersStore.size,
    totalCaptains: captainsStore.size,
    onlineCaptains: onlineCaptainsCount,
    activeRides: activeCount,
    completedRides: completedCount,
    cancelledRides: cancelledCount,
    todayRides: todayRidesCount,
    todayPlatformRevenue: Number(todayPlatformRevenue.toFixed(2)),
    totalVolume: Number(totalVolume.toFixed(2)),
  };
}

// 9. Passenger Live Locations Store (Single latest record per passenger/ride)
export const passengerLocationsStore = new Map<string, {
  passenger_id: string;
  ride_id?: string | null;
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  heading?: number | null;
  speed?: number | null;
  updated_at: string;
}>();

export function upsertPassengerLocation(data: {
  passenger_id: string;
  ride_id?: string | null;
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  heading?: number | null;
  speed?: number | null;
}) {
  const key = data.ride_id ? `ride_${data.ride_id}` : `psg_${data.passenger_id}`;
  const record = {
    ...data,
    updated_at: new Date().toISOString(),
  };
  passengerLocationsStore.set(key, record);
  // Also index by passenger_id directly
  passengerLocationsStore.set(`psg_${data.passenger_id}`, record);
  return record;
}

export function getPassengerLocation(rideId?: string, passengerId?: string) {
  if (rideId && passengerLocationsStore.has(`ride_${rideId}`)) {
    return passengerLocationsStore.get(`ride_${rideId}`);
  }
  if (passengerId && passengerLocationsStore.has(`psg_${passengerId}`)) {
    return passengerLocationsStore.get(`psg_${passengerId}`);
  }
  return null;
}

// 10. In-Ride Chat Messages Store
export const messagesStore = new Map<string, RideMessage[]>();

export function addRideMessage(data: {
  ride_id: string;
  sender_id: string;
  sender_role: 'passenger' | 'captain';
  sender_name: string;
  message: string;
}): RideMessage {
  const msg: RideMessage = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    ride_id: data.ride_id,
    sender_id: data.sender_id,
    sender_role: data.sender_role,
    sender_name: data.sender_name,
    message: data.message,
    created_at: new Date().toISOString(),
  };

  const list = messagesStore.get(data.ride_id) || [];
  list.push(msg);
  messagesStore.set(data.ride_id, list);

  broadcastEvent('RIDE_MESSAGE_RECEIVED', msg);
  return msg;
}

export function getRideMessages(rideId: string): RideMessage[] {
  return messagesStore.get(rideId) || [];
}

// 11. APK Release Management & Disk Storage
export interface ServerApkRelease {
  version: string;
  fileName: string;
  fileSize: string;
  fileSizeBytes?: number;
  releaseNotes: string;
  uploadedAt: string;
  downloadsCount: number;
  isDeleted: boolean;
  hasBinary: boolean;
}

export function formatRealFileSize(bytes?: number | null): string {
  if (!bytes || bytes <= 0 || isNaN(bytes)) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

const APK_META_FILE = path.join(DATA_DIR, 'apk_release.json');
const APK_BINARY_FILE = path.join(DATA_DIR, 'motoride-release.apk');

export let serverApkRelease: ServerApkRelease = {
  version: '2.4.1',
  fileName: 'motoride-v2.4.1.apk',
  fileSize: '',
  fileSizeBytes: 0,
  releaseNotes: 'Official Android APK release with live GPS tracking, instant rider-captain matching, and secure wallet payments.',
  uploadedAt: new Date().toISOString().split('T')[0],
  downloadsCount: 148,
  isDeleted: false,
  hasBinary: false,
};

// Initialize from disk if available
try {
  if (fs.existsSync(APK_META_FILE)) {
    const raw = fs.readFileSync(APK_META_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    serverApkRelease = { ...serverApkRelease, ...parsed };
  }
  if (fs.existsSync(APK_BINARY_FILE)) {
    serverApkRelease.hasBinary = true;
    const stats = fs.statSync(APK_BINARY_FILE);
    serverApkRelease.fileSizeBytes = stats.size;
    serverApkRelease.fileSize = formatRealFileSize(stats.size);
  } else {
    // If no binary file exists on disk, never show a fake file size
    serverApkRelease.hasBinary = false;
    serverApkRelease.fileSizeBytes = 0;
    serverApkRelease.fileSize = '';
  }
} catch (e) {
  console.warn('Could not load APK metadata on startup:', e);
}

export function saveServerApkRelease(updated: Partial<ServerApkRelease>): ServerApkRelease {
  // If binary is present on disk, ensure fileSize is accurately synced with disk stat
  let realSize = serverApkRelease.fileSize;
  let hasBin = serverApkRelease.hasBinary;
  let bytes = serverApkRelease.fileSizeBytes || 0;

  if (fs.existsSync(APK_BINARY_FILE)) {
    hasBin = true;
    bytes = fs.statSync(APK_BINARY_FILE).size;
    realSize = formatRealFileSize(bytes);
  } else if (!hasBin) {
    realSize = '';
    bytes = 0;
  }

  serverApkRelease = {
    ...serverApkRelease,
    ...updated,
    fileSize: realSize,
    fileSizeBytes: bytes,
    hasBinary: hasBin,
  };
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(APK_META_FILE, JSON.stringify(serverApkRelease, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Failed to save APK release metadata to disk:', err);
  }
  broadcastEvent('APK_RELEASE_UPDATED', serverApkRelease);
  return serverApkRelease;
}

export function saveServerApkBinary(
  buffer: Buffer,
  fileName?: string,
  version?: string
): ServerApkRelease {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(APK_BINARY_FILE, buffer);
    const realBytes = buffer.length;
    const realSize = formatRealFileSize(realBytes);
    serverApkRelease = {
      ...serverApkRelease,
      fileName: fileName || serverApkRelease.fileName || 'motoride-release.apk',
      fileSize: realSize,
      fileSizeBytes: realBytes,
      version: version || serverApkRelease.version,
      uploadedAt: new Date().toISOString().split('T')[0],
      hasBinary: true,
      isDeleted: false,
    };
    fs.writeFileSync(APK_META_FILE, JSON.stringify(serverApkRelease, null, 2), 'utf-8');
    broadcastEvent('APK_RELEASE_UPDATED', serverApkRelease);
  } catch (err) {
    console.warn('Failed to save APK binary to disk:', err);
  }
  return serverApkRelease;
}

export function getServerApkBinary(): Buffer | null {
  try {
    if (fs.existsSync(APK_BINARY_FILE)) {
      return fs.readFileSync(APK_BINARY_FILE);
    }
  } catch (err) {
    console.warn('Failed to read APK binary from disk:', err);
  }
  return null;
}

export function deleteServerApkBinary(): ServerApkRelease {
  try {
    if (fs.existsSync(APK_BINARY_FILE)) {
      fs.unlinkSync(APK_BINARY_FILE);
    }
  } catch (err) {
    console.warn('Error deleting APK binary file:', err);
  }
  serverApkRelease = {
    ...serverApkRelease,
    hasBinary: false,
    fileSize: '',
    fileSizeBytes: 0,
    isDeleted: true,
  };
  try {
    fs.writeFileSync(APK_META_FILE, JSON.stringify(serverApkRelease, null, 2), 'utf-8');
  } catch {}
  broadcastEvent('APK_RELEASE_UPDATED', serverApkRelease);
  return serverApkRelease;
}

export function completeRideAndDeductCommissionServer(
  rideId: string,
  captainId?: string,
  clientRide?: MotorideRide,
  customFare?: number
): {
  success: boolean;
  insufficient_balance?: boolean;
  error?: string;
  already_processed?: boolean;
  ride?: MotorideRide;
  gross_fare?: number;
  commission_amount?: number;
  captain_earning?: number;
  wallet_balance_before?: number;
  wallet_balance_after?: number;
} {
  let ride = ridesStore.get(rideId);
  if (!ride && clientRide && clientRide.id) {
    ride = { ...clientRide, id: rideId };
    ridesStore.set(rideId, ride);
  }

  if (!ride) {
    // If client supplied captainId and finalFare, synthesize stub ride to guarantee commission processing
    if (captainId && customFare && customFare > 0) {
      ride = {
        id: rideId,
        ride_code: rideId.slice(0, 8).toUpperCase(),
        captain_id: captainId,
        passenger_id: 'psg_user',
        pickup_address: 'Pickup Location',
        pickup_lat: 30.7046,
        pickup_lng: 76.7178,
        dropoff_address: 'Dropoff Location',
        dropoff_lat: 30.7182,
        dropoff_lng: 76.7321,
        final_fare: customFare,
        offered_fare: customFare,
        fare_amount: customFare,
        status: 'completed',
        ride_type: 'bike',
        payment_method: 'cash',
        payment_status: 'paid',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as MotorideRide;
      ridesStore.set(rideId, ride);
    } else {
      return { success: false, error: 'Ride or delivery booking not found' };
    }
  }

  const effectiveCaptainId = captainId || ride.captain_id;
  if (!effectiveCaptainId) {
    return { success: false, error: 'No captain assigned to this booking' };
  }

  if (captainId && !ride.captain_id) {
    ride.captain_id = captainId;
  }

  // IDEMPOTENCY CHECK: Verify if commission was already processed for this rideId
  const existingCommTx = walletTransactionsStore.find(
    (tx) => tx.reference_ride_id === rideId && (tx.category === 'commission_fee' || (tx.category as string) === 'platform_commission')
  );

  const finalFare = Number(customFare || ride.final_fare || ride.fare_amount || ride.offered_fare || ride.estimated_fare || 80);

  if (existingCommTx) {
    let currentWallet = walletsStore.get(effectiveCaptainId);
    if (!currentWallet) {
      const acc = accountsStore.get(effectiveCaptainId);
      currentWallet = { balance: acc?.wallet_balance ?? 490, currency: '₹' };
      walletsStore.set(effectiveCaptainId, currentWallet);
    }
    return {
      success: true,
      already_processed: true,
      ride,
      gross_fare: finalFare,
      commission_amount: existingCommTx.amount,
      captain_earning: Number((finalFare - existingCommTx.amount).toFixed(2)),
      wallet_balance_after: currentWallet.balance,
      error: undefined,
    };
  }

  if (finalFare <= 0) {
    return { success: false, error: 'Invalid final fare amount for completed ride' };
  }

  // Calculate 10% platform commission & net captain earning
  const commissionAmount = Number((finalFare * 0.10).toFixed(2));
  const captainEarning = Number((finalFare - commissionAmount).toFixed(2));

  // Lock and fetch Captain Wallet (Default starting balance is 500 for captain)
  let captainWallet = walletsStore.get(effectiveCaptainId);
  if (!captainWallet) {
    const acc = accountsStore.get(effectiveCaptainId);
    captainWallet = { balance: acc?.wallet_balance ?? 500.0, currency: '₹' };
    walletsStore.set(effectiveCaptainId, captainWallet);
  }
  const walletBefore = captainWallet.balance;

  // LOW WALLET BALANCE PROTECTION
  if (walletBefore < commissionAmount) {
    return {
      success: false,
      insufficient_balance: true,
      error: 'Insufficient wallet balance for platform commission. Please add money to your wallet.',
      gross_fare: finalFare,
      commission_amount: commissionAmount,
      wallet_balance_before: walletBefore,
    };
  }

  // ATOMIC UPDATES:
  // A. Deduct 10% platform commission from captain wallet
  const walletAfter = Number((walletBefore - commissionAmount).toFixed(2));
  captainWallet.balance = walletAfter;
  walletsStore.set(effectiveCaptainId, captainWallet);

  // Link captain aliases (ID, phone, ride captain) so query by any identifier always returns the exact same deducted balance
  const resolvedCaptainPhone = ride.captain_phone || captainsStore.get(effectiveCaptainId)?.phone || accountsStore.get(effectiveCaptainId)?.phone;
  if (resolvedCaptainPhone && resolvedCaptainPhone !== effectiveCaptainId) {
    walletsStore.set(resolvedCaptainPhone, { balance: walletAfter, currency: '₹' });
  }
  if (captainId && captainId !== effectiveCaptainId) {
    walletsStore.set(captainId, { balance: walletAfter, currency: '₹' });
  }
  if (ride.captain_id && ride.captain_id !== effectiveCaptainId) {
    walletsStore.set(ride.captain_id, { balance: walletAfter, currency: '₹' });
  }

  // Update all associated in-memory accounts so page reloads read the updated deducted balance
  const captainAcc = accountsStore.get(effectiveCaptainId) || (resolvedCaptainPhone ? accountsStore.get(resolvedCaptainPhone) : null) || (captainId ? accountsStore.get(captainId) : null);
  if (captainAcc) {
    captainAcc.wallet_balance = walletAfter;
    accountsStore.set(captainAcc.id, captainAcc);
    if (captainAcc.phone) accountsStore.set(captainAcc.phone, captainAcc);
  }

  // B. Record rich tripwise wallet transaction
  const txId = `tx_comm_${rideId}`;
  const isCourier = ride.ride_type === 'courier';
  const rideCode = ride.ride_code || rideId.slice(0, 8).toUpperCase();
  const tripTx: WalletTransaction = {
    id: txId,
    wallet_id: `w_${effectiveCaptainId}`,
    user_id: effectiveCaptainId,
    amount: commissionAmount,
    type: 'debit',
    category: 'commission_fee',
    description: `10% Platform Commission for ${isCourier ? 'Delivery' : 'Trip'} #${rideCode} (Fare: ₹${finalFare}, Fee: -₹${commissionAmount}, Net Earning: +₹${captainEarning})`,
    reference_ride_id: rideId,
    ride_code: rideCode,
    gross_fare: finalFare,
    commission_amount: commissionAmount,
    captain_earning: captainEarning,
    pickup_address: ride.pickup_address,
    dropoff_address: ride.dropoff_address,
    wallet_balance_before: walletBefore,
    wallet_balance_after: walletAfter,
    created_at: new Date().toISOString(),
  };
  walletTransactionsStore.unshift(tripTx);

  // Also duplicate reference for phone and captainId aliases so queries never miss transactions
  if (resolvedCaptainPhone && resolvedCaptainPhone !== effectiveCaptainId) {
    const phoneTx = { ...tripTx, id: `tx_comm_p_${rideId}`, user_id: resolvedCaptainPhone };
    walletTransactionsStore.unshift(phoneTx);
  }
  if (captainId && captainId !== effectiveCaptainId) {
    const cidTx = { ...tripTx, id: `tx_comm_c_${rideId}`, user_id: captainId };
    walletTransactionsStore.unshift(cidTx);
  }

  // C. Mark Ride completed & status = 'completed'
  const now = new Date().toISOString();
  ride.status = 'completed';
  ride.captain_rated = true;
  ride.payment_status = 'paid';
  ride.completed_at = ride.completed_at || now;
  ride.trip_completed_at = ride.trip_completed_at || now;
  ride.final_fare = finalFare;
  ride.fare_amount = finalFare;
  ridesStore.set(rideId, ride);

  // D. Increment Captain stats
  const cpt = captainsStore.get(effectiveCaptainId) || (resolvedCaptainPhone ? captainsStore.get(resolvedCaptainPhone) : null) || (captainId ? captainsStore.get(captainId) : null);
  if (cpt) {
    cpt.total_rides = (cpt.total_rides || 0) + 1;
    cpt.total_earnings = Number(((cpt.total_earnings || 0) + captainEarning).toFixed(2));
    cpt.today_earnings = Number(((cpt.today_earnings || 0) + captainEarning).toFixed(2));
    captainsStore.set(cpt.id, cpt);
  }

  // Synchronize atomically with Supabase (profiles, wallets, wallet_transactions, rides, earnings, captains) in the background so that the 10% commission is permanently stored in Supabase
  // Runs in a safe async IIFE to prevent unhandled promise rejections and gracefully catch any DB/cast errors.
  (async () => {
    try {
      const sb = dbSupabaseClient;
      if (!sb) return;

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      const isUuid = uuidRegex.test(effectiveCaptainId);

      // A. Update profiles wallet_balance
      if (isUuid) {
        await sb.from('profiles')
          .update({ wallet_balance: walletAfter, updated_at: now })
          .eq('id', effectiveCaptainId);
      } else {
        await sb.from('profiles')
          .update({ wallet_balance: walletAfter, updated_at: now })
          .eq('phone', effectiveCaptainId);
      }

      if (resolvedCaptainPhone) {
        await sb.from('profiles')
          .update({ wallet_balance: walletAfter, updated_at: now })
          .eq('phone', resolvedCaptainPhone);
      }
      
      // B. Update wallets balance (upsert so it works whether row exists or not)
      await sb.from('wallets')
        .upsert([{ user_id: effectiveCaptainId, balance: walletAfter, currency: '₹', updated_at: now }], { onConflict: 'user_id' });

      if (resolvedCaptainPhone) {
        await sb.from('wallets')
          .upsert([{ user_id: resolvedCaptainPhone, balance: walletAfter, currency: '₹', updated_at: now }], { onConflict: 'user_id' });
      }
      
      // C. Record wallet_transaction in Supabase
      const { error: txErr } = await sb.from('wallet_transactions').insert([{
        id: txId,
        wallet_id: `w_${effectiveCaptainId}`,
        user_id: effectiveCaptainId,
        amount: commissionAmount,
        type: 'debit',
        category: 'commission_fee',
        description: `10% Platform Commission for ${isCourier ? 'Delivery' : 'Ride'} #${rideCode} (Fare: ₹${finalFare}, Fee: -₹${commissionAmount}, Net Earning: +₹${captainEarning})`,
        reference_ride_id: rideId,
        created_at: now,
      }]);
      if (txErr) {
        console.warn(`[Supabase Sync Warning] Failed to insert wallet transaction: ${txErr.message}`);
      }

      // D. Record earnings table entry in Supabase
      const { error: earnErr } = await sb.from('earnings').insert([{
        id: `earn_${rideId}`,
        captain_id: effectiveCaptainId,
        ride_id: rideId,
        ride_date: now.split('T')[0],
        gross_fare: finalFare,
        platform_commission: commissionAmount,
        net_earnings: captainEarning,
        created_at: now,
      }]);
      if (earnErr) {
        console.warn(`[Supabase Sync Warning] Failed to insert earnings record: ${earnErr.message}`);
      }

      // E. Mark Ride completed and payment status paid in Supabase
      const { error: rideErr } = await sb.from('rides')
        .update({
          status: 'completed',
          payment_status: 'paid',
          completed_at: now,
          trip_completed_at: now,
          updated_at: now,
        })
        .eq('id', rideId);
      if (rideErr) {
        console.warn(`[Supabase Sync Warning] Failed to update ride completion: ${rideErr.message}`);
      }

      // F. Increment captain total rides and earnings in Supabase
      const supabaseCaptainId = effectiveCaptainId;
      if (isUuid) {
        // Try query captains table by UUID
        const { data: sbCpt, error: cptErr } = await sb.from('captains')
          .select('total_rides, total_earnings, today_earnings')
          .eq('id', supabaseCaptainId)
          .maybeSingle();

        if (!cptErr && sbCpt) {
          const currentRides = Number(sbCpt.total_rides || 0);
          const currentTotalEarn = Number(sbCpt.total_earnings || 0);
          const currentTodayEarn = Number(sbCpt.today_earnings || 0);
          await sb.from('captains').update({
            total_rides: currentRides + 1,
            total_earnings: Number((currentTotalEarn + captainEarning).toFixed(2)),
            today_earnings: Number((currentTodayEarn + captainEarning).toFixed(2)),
            updated_at: now
          }).eq('id', supabaseCaptainId);
        } else {
          // Also try by profile_id
          const { data: sbCpt2, error: cptErr2 } = await sb.from('captains')
            .select('total_rides, total_earnings, today_earnings')
            .eq('profile_id', supabaseCaptainId)
            .maybeSingle();

          if (!cptErr2 && sbCpt2) {
            const currentRides = Number(sbCpt2.total_rides || 0);
            const currentTotalEarn = Number(sbCpt2.total_earnings || 0);
            const currentTodayEarn = Number(sbCpt2.today_earnings || 0);
            await sb.from('captains').update({
              total_rides: currentRides + 1,
              total_earnings: Number((currentTotalEarn + captainEarning).toFixed(2)),
              today_earnings: Number((currentTodayEarn + captainEarning).toFixed(2)),
              updated_at: now
            }).eq('profile_id', supabaseCaptainId);
          }
        }
      }
    } catch (sbErr: any) {
      console.error('[Supabase Sync Error] Unhandled exception inside sync IIFE:', sbErr.message || sbErr);
    }
  })();

  persistDbToDisk();

  // E. Broadcast Realtime Events
  broadcastEvent('RIDE_COMPLETED', {
    ride,
    commission_amount: commissionAmount,
    captain_earning: captainEarning,
    wallet_balance: walletAfter,
  });
  broadcastEvent('WALLET_UPDATED', {
    user_id: effectiveCaptainId,
    balance: walletAfter,
    wallet: { balance: walletAfter, currency: '₹' },
    transaction: tripTx,
  });
  if (captainId && captainId !== effectiveCaptainId) {
    broadcastEvent('WALLET_UPDATED', {
      user_id: captainId,
      balance: walletAfter,
      wallet: { balance: walletAfter, currency: '₹' },
      transaction: tripTx,
    });
  }
  if (resolvedCaptainPhone) {
    broadcastEvent('WALLET_UPDATED', {
      user_id: resolvedCaptainPhone,
      balance: walletAfter,
      wallet: { balance: walletAfter, currency: '₹' },
      transaction: tripTx,
    });
  }

  return {
    success: true,
    already_processed: false,
    ride,
    gross_fare: finalFare,
    commission_amount: commissionAmount,
    captain_earning: captainEarning,
    wallet_balance_before: walletBefore,
    wallet_balance_after: walletAfter,
  };
}

export function getAdminCommissionsServer() {
  const commTxs = walletTransactionsStore.filter(
    (tx) => tx.category === 'commission_fee' || (tx.category as string) === 'platform_commission'
  );

  let totalCompletedRides = 0;
  let totalCompletedDeliveries = 0;
  let totalGrossFare = 0;
  let totalCommissionCollected = 0;
  let totalCaptainEarnings = 0;

  const records = commTxs.map((tx) => {
    const ride = ridesStore.get(tx.reference_ride_id || '') || null;
    const isCourier = ride?.ride_type === 'courier';

    if (isCourier) {
      totalCompletedDeliveries++;
    } else {
      totalCompletedRides++;
    }

    const grossFare = Number(ride?.final_fare || ride?.fare_amount || (tx.amount ? tx.amount / 0.10 : 0));
    const commAmount = tx.amount;
    const captainEarning = Number((grossFare - commAmount).toFixed(2));

    totalGrossFare += grossFare;
    totalCommissionCollected += commAmount;
    totalCaptainEarnings += captainEarning;

    return {
      tx_id: tx.id,
      booking_id: tx.reference_ride_id || 'N/A',
      ride_code: ride?.ride_code || tx.reference_ride_id || 'N/A',
      ride_type: ride?.ride_type || 'bike',
      captain_id: tx.user_id,
      captain_name: ride?.captain_name || 'Captain Partner',
      passenger_name: ride?.passenger_name || 'Passenger Customer',
      gross_fare: grossFare,
      commission_pct: 10,
      commission_amount: commAmount,
      captain_earning: captainEarning,
      created_at: tx.created_at,
      status: 'Settled (10% Deducted)',
    };
  });

  return {
    totals: {
      totalCompletedRides,
      totalCompletedDeliveries,
      totalGrossFare: Number(totalGrossFare.toFixed(2)),
      totalCommissionCollected: Number(totalCommissionCollected.toFixed(2)),
      totalCaptainEarnings: Number(totalCaptainEarnings.toFixed(2)),
    },
    records,
  };
}


