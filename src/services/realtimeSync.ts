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
  private localBroadcastChannel: BroadcastChannel | null = null;
  private appwriteUnsubscribe: (() => void) | null = null;

  constructor() {
    this.init();
  }

  private init() {
    // 1. Initialize Shared Backend SSE stream if available
    this.connectSSE();

    // 2. Initialize Local BroadcastChannel for instant same-browser multi-tab synchronization
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

    // 3. Appwrite Realtime Sync (if configured)
    if (isAppwriteConfigured()) {
      this.appwriteUnsubscribe = subscribeAppwriteRealtime(({ events, payload }) => {
        const evName = events?.[0] || 'APPWRITE_EVENT';
        this.emit(evName, payload);
      });
    }

    // 4. Handle visibility / online recovery
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.connectSSE();
      });

      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          if (!this.isConnected || !this.sseSource || this.sseSource.readyState === EventSource.CLOSED) {
            this.connectSSE();
          }
        }
      });
    }
  }

  private connectSSE() {
    if (typeof window === 'undefined') return;

    try {
      if (this.sseSource) {
        this.sseSource.close();
        this.sseSource = null;
      }

      const sseUrl = getApiUrl('/api/motoride/realtime/stream');
      this.sseSource = new EventSource(sseUrl);

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
        this.isConnected = false;
        this.emit('CONNECTION_STATUS', { connected: false, type: 'sse' });
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
      this.off(event, callback);
    };
  }

  public off(event: string, callback: EventCallback) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.delete(callback);
      if (callbacks.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  public emit(event: string, payload: any, propagateToChannel: boolean = true) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach((cb) => {
        try {
          cb(payload);
        } catch (err) {
          console.error(`Error in realtime listener for ${event}:`, err);
        }
      });
    }

    if (propagateToChannel && this.localBroadcastChannel) {
      try {
        this.localBroadcastChannel.postMessage({ type: event, payload });
      } catch {}
    }
  }

  /**
   * Broadcasts an event locally, through backend server SSE, and to Appwrite if configured.
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

    // 3. Synchronize state with Appwrite Database (if configured)
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
    // Handled via SSE / polling
  }

  public sendActiveRidesSync(rides: MotorideRide[]) {
    // Broadcast via SSE
    if (Array.isArray(rides) && rides.length > 0) {
      this.broadcast('ACTIVE_RIDES_SYNC', { rides });
    }
  }

  public reconnect() {
    this.connectSSE();
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
      isAppwriteActive: isAppwriteConfigured(),
      appwriteUrl: appwriteNetworkUrl,
      appwriteProjectId: appwriteProjectId,
      hasBroadcastChannel: !!this.localBroadcastChannel,
    };
  }
}

export const realtimeSync = new RealtimeSyncManager();
