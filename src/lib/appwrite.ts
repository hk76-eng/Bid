import { Client, Databases, Account, ID, Query } from 'appwrite';

/**
 * Appwrite Configuration & Client
 * Network URL: https://motoride.appwrite.network/
 * Project ID: 6ad0ec7900143b6a777b
 * API Endpoint: https://nyc.cloud.appwrite.io/v1
 */

export const DEFAULT_APPWRITE_ENDPOINT = 'https://nyc.cloud.appwrite.io/v1';
export const DEFAULT_APPWRITE_PROJECT_ID = '6ad0ec7900143b6a777b';
export const DEFAULT_APPWRITE_NETWORK_URL = 'https://motoride.appwrite.network/';
export const DEFAULT_APPWRITE_DATABASE_ID = 'motoride';

export const APPWRITE_COLLECTIONS = {
  RIDES: 'rides',
  CAPTAINS: 'captains',
  PASSENGERS: 'passengers',
  PROFILES: 'profiles',
  LOCATIONS: 'locations',
  OFFERS: 'ride_offers',
  WALLETS: 'wallets',
  SETTINGS: 'settings',
} as const;

const rawEndpoint: string =
  (import.meta as any)?.env?.VITE_APPWRITE_ENDPOINT || DEFAULT_APPWRITE_ENDPOINT;
export const appwriteEndpoint: string = rawEndpoint ? rawEndpoint.trim().replace(/\/+$/, '') : '';

export const appwriteProjectId: string = (
  (import.meta as any)?.env?.VITE_APPWRITE_PROJECT_ID || DEFAULT_APPWRITE_PROJECT_ID
).trim();

export const appwriteNetworkUrl: string = (
  (import.meta as any)?.env?.VITE_APPWRITE_URL || DEFAULT_APPWRITE_NETWORK_URL
).trim();

export const appwriteDatabaseId: string = (
  (import.meta as any)?.env?.VITE_APPWRITE_DATABASE_ID || DEFAULT_APPWRITE_DATABASE_ID
).trim();

export const isAppwriteConfigured = (): boolean => {
  return Boolean(
    appwriteEndpoint &&
    appwriteProjectId &&
    appwriteEndpoint.startsWith('https://') &&
    appwriteProjectId.length > 5
  );
};

let clientInstance: Client | null = null;
let databasesInstance: Databases | null = null;
let accountInstance: Account | null = null;

export const getAppwriteClient = (): Client | null => {
  if (!isAppwriteConfigured()) {
    return null;
  }
  if (!clientInstance) {
    clientInstance = new Client();
    clientInstance
      .setEndpoint(appwriteEndpoint)
      .setProject(appwriteProjectId);
  }
  return clientInstance;
};

export const getAppwriteDatabases = (): Databases | null => {
  const client = getAppwriteClient();
  if (!client) return null;
  if (!databasesInstance) {
    databasesInstance = new Databases(client);
  }
  return databasesInstance;
};

export const getAppwriteAccount = (): Account | null => {
  const client = getAppwriteClient();
  if (!client) return null;
  if (!accountInstance) {
    accountInstance = new Account(client);
  }
  return accountInstance;
};

let cachedOriginAllowed: boolean | null = null;

/**
 * Checks synchronously whether the current window host is a known registered Web Platform
 */
export const isAppwriteOriginAllowedSync = (): boolean => {
  if (typeof window === 'undefined') return true;
  if (cachedOriginAllowed !== null) return cachedOriginAllowed;

  const hostname = window.location.hostname.toLowerCase();
  if (
    hostname === 'motoride.appwrite.network' ||
    hostname.endsWith('.appwrite.network') ||
    hostname === 'localhost' ||
    hostname === '127.0.0.1'
  ) {
    cachedOriginAllowed = true;
    return true;
  }
  return false;
};

/**
 * Verifies with Appwrite endpoint whether the current browser Origin is permitted.
 * If not permitted, client avoids creating direct WebSockets to prevent error 1008 & reconnect loops.
 */
export const checkAppwriteOriginAllowed = async (): Promise<boolean> => {
  if (typeof window === 'undefined') return true;
  if (isAppwriteOriginAllowedSync()) return true;

  try {
    const res = await fetch(`${appwriteEndpoint}/locale`, {
      headers: {
        'X-Appwrite-Project': appwriteProjectId,
      },
    });
    if (res.status === 403) {
      const data = await res.json().catch(() => ({}));
      if (
        data?.type === 'general_unknown_origin' ||
        data?.code === 403 ||
        data?.message?.includes('Invalid Origin')
      ) {
        cachedOriginAllowed = false;
        return false;
      }
    }
    cachedOriginAllowed = res.ok;
    return cachedOriginAllowed;
  } catch {
    cachedOriginAllowed = false;
    return false;
  }
};

/**
 * Appwrite Real-time Channel Subscription Helper
 * Subscribes to real-time events across collections and documents.
 * Protects against WebSocket error 1008 / reconnection loops when running on unregistered preview domains.
 */
export const subscribeAppwriteRealtime = (
  onEvent: (event: { events: string[]; payload: any }) => void
): (() => void) => {
  const client = getAppwriteClient();
  if (!client) return () => {};

  let activeUnsubscribe: (() => void) | null = null;
  let isCancelled = false;

  const startSubscription = () => {
    if (isCancelled) return;
    try {
      activeUnsubscribe = client.subscribe(
        [
          'documents',
          `databases.${appwriteDatabaseId}.collections.${APPWRITE_COLLECTIONS.RIDES}.documents`,
          `databases.${appwriteDatabaseId}.collections.${APPWRITE_COLLECTIONS.CAPTAINS}.documents`,
          `databases.${appwriteDatabaseId}.collections.${APPWRITE_COLLECTIONS.LOCATIONS}.documents`,
          `databases.${appwriteDatabaseId}.collections.${APPWRITE_COLLECTIONS.WALLETS}.documents`,
        ],
        (response: any) => {
          if (response && response.events) {
            onEvent({
              events: response.events,
              payload: response.payload,
            });
          }
        }
      );
    } catch (err) {
      console.warn('[Appwrite Realtime] Subscription notice:', err);
    }
  };

  if (isAppwriteOriginAllowedSync()) {
    startSubscription();
  } else {
    // Probe origin first asynchronously to eliminate WebSocket 1008 error and 1s reconnection loop
    checkAppwriteOriginAllowed().then((allowed) => {
      if (allowed && !isCancelled) {
        startSubscription();
      } else if (!allowed) {
        const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
        console.info(
          `[Appwrite Notice] Host '${hostname}' is not yet registered in Appwrite Console > Web Platforms. Direct WebSocket is bypassed to prevent reconnection errors. Real-time synchronization is fully supported via Supabase Realtime & Backend SSE.`
        );
      }
    }).catch(() => {});
  }

  return () => {
    isCancelled = true;
    if (activeUnsubscribe) {
      try {
        activeUnsubscribe();
      } catch {}
    }
  };
};

/**
 * Helper to safely sync or create a ride document in Appwrite
 */
export async function syncRideToAppwrite(ride: any): Promise<boolean> {
  if (!ride?.id) return false;

  const docData = {
    ride_code: String(ride.ride_code || ride.id || ''),
    status: String(ride.status || 'requested'),
    passenger_id: String(ride.passenger_id || ''),
    passenger_name: String(ride.passenger_name || ''),
    captain_id: String(ride.captain_id || ''),
    captain_name: String(ride.captain_name || ''),
    pickup_address: String(ride.pickup_address || ''),
    dropoff_address: String(ride.dropoff_address || ''),
    pickup_lat: Number(ride.pickup_lat || 0),
    pickup_lng: Number(ride.pickup_lng || 0),
    dropoff_lat: Number(ride.dropoff_lat || 0),
    dropoff_lng: Number(ride.dropoff_lng || 0),
    fare: Number(ride.agreed_fare || ride.final_fare || ride.estimated_fare || ride.fare || 0),
    updated_at: new Date().toISOString(),
  };

  // If running on an authorized origin, use direct Appwrite client
  if (isAppwriteOriginAllowedSync()) {
    const databases = getAppwriteDatabases();
    if (databases) {
      try {
        await databases.updateDocument(
          appwriteDatabaseId,
          APPWRITE_COLLECTIONS.RIDES,
          ride.id,
          docData
        );
        return true;
      } catch (updateErr: any) {
        if (updateErr?.code === 404 || updateErr?.message?.includes('not found')) {
          try {
            await databases.createDocument(
              appwriteDatabaseId,
              APPWRITE_COLLECTIONS.RIDES,
              ride.id,
              docData
            );
            return true;
          } catch {}
        }
      }
    }
  }

  // Fallback: sync through backend proxy route with registered Origin
  try {
    const res = await fetch('/api/motoride/appwrite/sync-ride', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ride }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export const APPWRITE_CONFIG_STATUS = {
  endpoint: appwriteEndpoint,
  projectId: appwriteProjectId,
  networkUrl: appwriteNetworkUrl,
  databaseId: appwriteDatabaseId,
  isReady: isAppwriteConfigured(),
  isOriginAuthorized: isAppwriteOriginAllowedSync(),
};

export { ID, Query };
