import { getSupabase, isSupabaseConfigured } from '../lib/supabase';
import {
  isAppwriteConfigured,
  subscribeAppwriteRealtime,
  syncRideToAppwrite,
  appwriteNetworkUrl,
  appwriteProjectId,
} from '../lib/appwrite';
import { MotorideRide } from '../types/motoride';
import { getApiUrl } from '../utils/apiUrl';
import { toCanonicalStatus } from './rideStateMachine';

type EventCallback = (payload: any) => void;

class RealtimeSyncManager {
  private listeners: Map<string, Set<EventCallback>> = new Map();
  private sseSource: EventSource | null = null;
  private isConnected: boolean = false;
  private reconnectTimeout: any = null;
  private supabaseChannel: any = null;
  private localBroadcastChannel: BroadcastChannel | null = null;
  private appwriteUnsubscribe: (() => void) | null = null;

  constructor() {
    this.init();
  }

  private init() {
    // 1. Initialize Supabase Realtime Broadcast & Postgres changes
    if (isSupabaseConfigured()) {
      const supabase = getSupabase();
      if (supabase) {
        try {
          this.supabaseChannel = supabase
            .channel('motoride-global-realtime', {
              config: { broadcast: { self: false } },
            })
            .on('broadcast', { event: 'MOTORIDE_EVENT' }, ({ payload }: any) => {
              if (payload?.event) {
                this.emit(payload.event, payload.data);
              }
            })
            .on('broadcast', { event: 'REQUEST_ACTIVE_SYNC' }, () => {
              this.emit('REQUEST_SYNC_RECEIVED', {});
            })
            .on('broadcast', { event: 'ACTIVE_RIDES_SYNC' }, ({ payload }: any) => {
              if (Array.isArray(payload?.rides)) {
                this.emit('ACTIVE_RIDES_SYNC_RECEIVED', payload.rides);
              }
            })
            .on(
              'postgres_changes',
              { event: '*', schema: 'public', table: 'rides' },
              (payload: any) => {
                if (payload.eventType === 'INSERT') {
                  this.emit('RIDE_CREATED', payload.new);
                } else if (payload.eventType === 'UPDATE') {
                  this.emit('RIDE_UPDATED', payload.new);
                  if (payload.new?.status === 'accepted' || payload.new?.status === 'captain_accepted') {
                    this.emit('RIDE_ACCEPTED', payload.new);
                  }
                  if (payload.new?.status === 'captain_offered' && Array.isArray(payload.new?.offers) && payload.new.offers.length > 0) {
                    const latestOffer = payload.new.offers[payload.new.offers.length - 1];
                    this.emit('RIDE_OFFER_RECEIVED', { ride: payload.new, offer: latestOffer });
                  }
                  if (payload.new?.status && payload.new.status.includes('cancelled')) {
                    this.emit('RIDE_CANCELLED', {
                      ride: payload.new,
                      ride_id: payload.new.id,
                      status: payload.new.status,
                      cancellation_reason: payload.new.cancellation_reason,
                    });
                  }
                  this.emit('RIDE_STATUS_CHANGED', { ride: payload.new, status: payload.new.status });
                } else if (payload.eventType === 'DELETE') {
                  this.emit('RIDE_DELETED', { id: payload.old?.id });
                  this.emit('RIDE_CANCELLED', { ride_id: payload.old?.id });
                }
              }
            )
            .on(
              'postgres_changes',
              { event: 'INSERT', schema: 'public', table: 'ride_offers' },
              (payload: any) => {
                this.emit('RIDE_OFFER_RECEIVED', payload.new);
              }
            )
            .on(
              'postgres_changes',
              { event: '*', schema: 'public', table: 'captain_locations' },
              (payload: any) => {
                this.emit('CAPTAIN_LOCATION_UPDATED', payload.new);
              }
            )
            .on(
              'postgres_changes',
              { event: '*', schema: 'public', table: 'passenger_locations' },
              (payload: any) => {
                this.emit('PASSENGER_LOCATION_UPDATED', payload.new);
              }
            )
            .on(
              'postgres_changes',
              { event: '*', schema: 'public', table: 'profiles' },
              (payload: any) => {
                this.emit('PROFILES_UPDATED', payload.new);
                if (payload.new?.role === 'passenger') {
                  this.emit('PASSENGERS_UPDATED', payload.new);
                } else if (payload.new?.role === 'captain') {
                  this.emit('CAPTAINS_UPDATED', payload.new);
                }
              }
            )
            .on(
              'postgres_changes',
              { event: '*', schema: 'public', table: 'passengers' },
              (payload: any) => {
                this.emit('PASSENGERS_UPDATED', payload.new);
              }
            )
            .on(
              'postgres_changes',
              { event: '*', schema: 'public', table: 'captains' },
              (payload: any) => {
                this.emit('CAPTAINS_UPDATED', payload.new);
              }
            )
            .on(
              'postgres_changes',
              { event: '*', schema: 'public', table: 'topup_requests' },
              (payload: any) => {
                if (payload.eventType === 'INSERT') {
                  this.emit('TOPUP_REQUEST_CREATED', { request: payload.new });
                } else if (payload.eventType === 'UPDATE') {
                  this.emit('TOPUP_REQUEST_UPDATED', { request: payload.new, id: payload.new?.id, status: payload.new?.status, user_id: payload.new?.captain_id, phone: payload.new?.captain_phone });
                }
              }
            )
            .on(
              'postgres_changes',
              { event: '*', schema: 'public', table: 'wallets' },
              (payload: any) => {
                if (payload.new) {
                  this.emit('WALLET_UPDATED', {
                    user_id: payload.new.user_id,
                    balance: Number(payload.new.balance),
                  });
                }
              }
            )
            .on(
              'postgres_changes',
              { event: 'INSERT', schema: 'public', table: 'wallet_transactions' },
              (payload: any) => {
                if (payload.new) {
                  this.emit('WALLET_TRANSACTION_CREATED', payload.new);
                  this.emit('WALLET_UPDATED', {
                    user_id: payload.new.user_id,
                  });
                }
              }
            )
            .on(
              'postgres_changes',
              { event: 'INSERT', schema: 'public', table: 'topup_chat' },
              (payload: any) => {
                if (payload.new) {
                  this.emit('TOPUP_CHAT_MESSAGE_RECEIVED', {
                    request_id: payload.new.request_id,
                    message: payload.new,
                  });
                }
              }
            )
            .on(
              'postgres_changes',
              { event: 'INSERT', schema: 'public', table: 'ride_messages' },
              (payload: any) => {
                if (payload.new) {
                  this.emit('RIDE_MESSAGE_RECEIVED', payload.new);
                }
              }
            )
            .subscribe((status: string) => {
              if (status === 'SUBSCRIBED') {
                this.isConnected = true;
                this.emit('CONNECTION_STATUS', { connected: true, type: 'supabase_realtime' });
                // Request any active ride state from connected peers
                this.requestSync();
              }
            });
        } catch (err) {
          console.warn('Supabase Realtime setup warning:', err);
        }
      }
    }

    // 2. Initialize Shared Backend SSE stream if available
    this.connectSSE();

    // 3. Initialize Local BroadcastChannel for instant same-browser multi-tab synchronization
    if (typeof window !== 'undefined' && window.BroadcastChannel) {
      try {
        this.localBroadcastChannel = new BroadcastChannel('motoride-local-realtime');
        this.localBroadcastChannel.onmessage = (event) => {
          const { type, payload } = event.data || {};
          if (type && payload) {
            this.emit(type, payload, false); // Don't broadcast it back to local channel
          }
        };
      } catch (err) {
        console.warn('Local BroadcastChannel setup warning:', err);
      }
    }

    // 4. Also listen to window storage event for instant multi-tab fallback across all tabs
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (event) => {
        if (event.key === 'motoride_realtime_ping' && event.newValue) {
          try {
            const data = JSON.parse(event.newValue);
            if (data?.type && data?.payload) {
              this.emit(data.type, data.payload, false);
            }
          } catch {}
        }
        if (event.key === 'motoride_rides_store' && event.newValue) {
          try {
            const rides = JSON.parse(event.newValue);
            if (Array.isArray(rides) && rides.length > 0) {
              const latest = rides[0];
              if (latest && latest.id) {
                this.emit('RIDE_UPDATED', latest, false);
                if (latest.status) {
                  this.emit('RIDE_STATUS_CHANGED', { ride: latest, status: latest.status }, false);
                }
              }
            }
          } catch {}
        }
      });
    }

    // Reconnect on tab focus / wake up from background on mobile
    if (typeof window !== 'undefined') {
      const handleWake = () => {
        if (document.visibilityState === 'visible' || navigator.onLine) {
          if (!this.isConnected || !this.sseSource || this.sseSource.readyState === EventSource.CLOSED) {
            this.connectSSE();
          }
          this.requestSync();
        }
      };
      window.addEventListener('visibilitychange', handleWake);
      window.addEventListener('focus', handleWake);
      window.addEventListener('online', handleWake);
    }

    // 5. Initialize Appwrite Real-Time Synchronization (https://motoride.appwrite.network/)
    if (isAppwriteConfigured()) {
      try {
        this.appwriteUnsubscribe = subscribeAppwriteRealtime((event) => {
          this.handleAppwriteRealtimeEvent(event);
        });
      } catch (err) {
        console.warn('Appwrite Realtime setup warning:', err);
      }
    }
  }

  private handleAppwriteRealtimeEvent(eventData: { events: string[]; payload: any }) {
    const { events, payload } = eventData;
    if (!payload) return;

    const isCreate = events.some((e) => e.includes('.create'));
    const isUpdate = events.some((e) => e.includes('.update'));
    const isDelete = events.some((e) => e.includes('.delete'));

    if (events.some((e) => e.includes('rides'))) {
      const rideId = payload.id || payload.$id || payload.ride_code;
      if (!rideId) return;

      const normalizedRide: MotorideRide = {
        ...payload,
        id: rideId,
        ride_code: payload.ride_code || rideId,
        status: toCanonicalStatus(payload.status),
        pickup_lat: Number(payload.pickup_lat ?? payload.pickupLatitude ?? 0),
        pickup_lng: Number(payload.pickup_lng ?? payload.pickupLongitude ?? 0),
        dropoff_lat: Number(payload.dropoff_lat ?? payload.dropoffLatitude ?? 0),
        dropoff_lng: Number(payload.dropoff_lng ?? payload.dropoffLongitude ?? 0),
        final_fare: Number(payload.fare ?? payload.final_fare ?? payload.agreed_fare ?? payload.estimated_fare ?? 0),
        agreed_fare: Number(payload.fare ?? payload.agreed_fare ?? payload.final_fare ?? payload.estimated_fare ?? 0),
        updated_at: payload.updated_at || payload.$updatedAt || new Date().toISOString(),
      };

      if (isCreate) {
        this.emit('RIDE_CREATED', normalizedRide);
      } else if (isUpdate) {
        this.emit('RIDE_UPDATED', normalizedRide);
        if (normalizedRide.status === 'accepted' || normalizedRide.status === 'captain_accepted') {
          this.emit('RIDE_ACCEPTED', normalizedRide);
        }
        if (normalizedRide.status && normalizedRide.status.includes('cancelled')) {
          this.emit('RIDE_CANCELLED', {
            ride: normalizedRide,
            ride_id: rideId,
            status: normalizedRide.status,
          });
        }
        this.emit('RIDE_STATUS_CHANGED', { ride: normalizedRide, status: normalizedRide.status });
      } else if (isDelete) {
        this.emit('RIDE_DELETED', { id: rideId, ride_id: rideId });
        this.emit('RIDE_CANCELLED', { ride_id: rideId, status: 'cancelled' });
      }
    } else if (events.some((e) => e.includes('captains') || e.includes('locations'))) {
      this.emit('CAPTAIN_LOCATION_UPDATED', {
        ...payload,
        captain_id: payload.captain_id || payload.$id || payload.id,
        lat: Number(payload.lat ?? payload.latitude ?? 0),
        lng: Number(payload.lng ?? payload.longitude ?? 0),
        heading: Number(payload.heading ?? 0),
      });
    } else if (events.some((e) => e.includes('wallets'))) {
      this.emit('WALLET_UPDATED', {
        ...payload,
        user_id: payload.user_id || payload.$id || payload.id,
        balance: Number(payload.balance ?? 0),
      });
    }
  }

  private connectSSE() {
    if (typeof window === 'undefined' || !window.EventSource) return;

    if (this.sseSource) {
      this.sseSource.close();
    }

    try {
      this.sseSource = new EventSource(getApiUrl('/api/motoride/realtime/stream'));

      this.sseSource.onopen = () => {
        this.isConnected = true;
        this.emit('CONNECTION_STATUS', { connected: true, type: 'sse' });
      };

      this.sseSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.event && data.event !== 'PING') {
            this.emit(data.event, data.payload);
          }
        } catch {}
      };

      this.sseSource.onerror = () => {
        // SSE is unavailable on static hosting (like Vercel) - fallback seamlessly to Supabase Realtime
        if (!isSupabaseConfigured()) {
          this.isConnected = false;
          this.emit('CONNECTION_STATUS', { connected: false, type: 'sse' });
        }
        this.sseSource?.close();
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = setTimeout(() => {
          this.connectSSE();
        }, 8000);
      };
    } catch (err) {
      console.warn('SSE connection attempt error:', err);
    }
  }

  public on(event: string, callback: EventCallback): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  public off(event: string, callback: EventCallback) {
    this.listeners.get(event)?.delete(callback);
  }

  public emit(event: string, payload: any, broadcastLocally: boolean = true) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach((cb) => {
        try {
          cb(payload);
        } catch (err) {
          console.error('Error in realtime event callback:', err);
        }
      });
    }

    if (broadcastLocally && typeof window !== 'undefined' && event !== 'CONNECTION_STATUS' && event !== 'PING') {
      if (this.localBroadcastChannel) {
        try {
          this.localBroadcastChannel.postMessage({ type: event, payload });
        } catch {}
      }
      try {
        localStorage.setItem(
          'motoride_realtime_ping',
          JSON.stringify({ type: event, payload, ts: Date.now() })
        );
      } catch {}
    }
  }

  /**
   * Broadcasts an event locally, through backend server SSE, AND across all connected browsers/devices via Supabase Realtime.
   */
  public broadcast(event: string, data: any) {
    // 1. Emit locally immediately
    this.emit(event, data);

    // 2. Broadcast via backend server SSE stream
    try {
      fetch(getApiUrl('/api/motoride/realtime/broadcast'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event, payload: data }),
      }).catch(() => {});
    } catch {}

    // 3. Broadcast via Supabase channel to all other clients across devices
    if (this.supabaseChannel) {
      try {
        this.supabaseChannel
          .send({
            type: 'broadcast',
            event: 'MOTORIDE_EVENT',
            payload: { event, data },
          })
          .catch((err: any) => {
            console.warn('Supabase broadcast error:', err);
          });
      } catch (err) {
        console.warn('Supabase broadcast send failed:', err);
      }
    }

    // 4. Synchronize state with Appwrite Database (https://motoride.appwrite.network/)
    if (isAppwriteConfigured()) {
      if (
        event === 'RIDE_CREATED' ||
        event === 'RIDE_UPDATED' ||
        event === 'RIDE_ACCEPTED' ||
        event === 'RIDE_STATUS_CHANGED'
      ) {
        const rideToSync = data?.ride || data;
        if (rideToSync && (rideToSync.id || rideToSync.ride_code)) {
          syncRideToAppwrite(rideToSync).catch((err) => {
            console.warn('[Appwrite Sync] Realtime sync notice:', err);
          });
        }
      }
    }
  }

  public requestSync() {
    if (this.supabaseChannel) {
      try {
        this.supabaseChannel
          .send({
            type: 'broadcast',
            event: 'REQUEST_ACTIVE_SYNC',
            payload: {},
          })
          .catch(() => {});
      } catch {}
    }
  }

  public sendActiveRidesSync(rides: MotorideRide[]) {
    if (this.supabaseChannel && Array.isArray(rides) && rides.length > 0) {
      try {
        this.supabaseChannel
          .send({
            type: 'broadcast',
            event: 'ACTIVE_RIDES_SYNC',
            payload: { rides },
          })
          .catch(() => {});
      } catch {}
    }
  }

  public reconnect() {
    this.connectSSE();
    this.requestSync();
  }

  public async pingServer(): Promise<{ latencyMs: number; serverUrl: string }> {
    const start = Date.now();
    try {
      const res = await fetch(getApiUrl('/api/motoride/realtime/ping'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientTs: start }),
      });
      const data = await res.json();
      return {
        latencyMs: Math.max(1, Date.now() - start),
        serverUrl: data?.serverUrl || 'https://motoride.wasmer.app',
      };
    } catch {
      return { latencyMs: -1, serverUrl: 'https://motoride.wasmer.app' };
    }
  }

  public async fetchServerSyncData() {
    try {
      const res = await fetch(getApiUrl('/api/motoride/realtime/sync-data'));
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('Failed to fetch server sync data:', e);
    }
    return null;
  }

  public getStatus() {
    return {
      isConnected: this.isConnected,
      isSupabaseActive: isSupabaseConfigured(),
      isAppwriteActive: isAppwriteConfigured(),
      appwriteUrl: appwriteNetworkUrl,
      appwriteProjectId: appwriteProjectId,
      hasBroadcastChannel: !!this.localBroadcastChannel,
    };
  }
}

export const realtimeSync = new RealtimeSyncManager();

