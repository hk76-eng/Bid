/**
 * Safe Storage utility for Mobile WebViews, APKs, Vercel deployments, and modern browsers.
 * Uses multi-layer persistence: localStorage -> sessionStorage -> document.cookie -> in-memory store.
 * Prevents "SecurityError: Access is denied" and guarantees user session survives page refreshes.
 */

const memoryStore = new Map<string, string>();

const isStorageAvailable = (type: 'localStorage' | 'sessionStorage'): boolean => {
  try {
    if (typeof window === 'undefined' || !window[type]) {
      return false;
    }
    const testKey = `__motoride_test_${type}__`;
    window[type].setItem(testKey, '1');
    window[type].removeItem(testKey);
    return true;
  } catch {
    return false;
  }
};

const hasLocalStorage = isStorageAvailable('localStorage');
const hasSessionStorage = isStorageAvailable('sessionStorage');

// Cookie helpers for fallback persistence
const getCookie = (name: string): string | null => {
  try {
    if (typeof document === 'undefined') return null;
    const match = document.cookie.match(new RegExp('(?:^|;\\s*)' + encodeURIComponent(name) + '=([^;]*)'));
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
};

const setCookie = (name: string, value: string, days: number = 365): void => {
  try {
    if (typeof document === 'undefined') return;
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
  } catch {}
};

const removeCookie = (name: string): void => {
  try {
    if (typeof document === 'undefined') return;
    document.cookie = `${encodeURIComponent(name)}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`;
  } catch {}
};

export const safeStorage = {
  getItem(key: string): string | null {
    // 1. Try window.localStorage
    try {
      if (hasLocalStorage && typeof window !== 'undefined' && window.localStorage) {
        const val = window.localStorage.getItem(key);
        if (val !== null) return val;
      }
    } catch {}

    // 2. Try window.sessionStorage
    try {
      if (hasSessionStorage && typeof window !== 'undefined' && window.sessionStorage) {
        const val = window.sessionStorage.getItem(key);
        if (val !== null) {
          // Re-persist to localStorage
          try {
            if (hasLocalStorage && window.localStorage) window.localStorage.setItem(key, val);
          } catch {}
          return val;
        }
      }
    } catch {}

    // 3. Try document.cookie
    try {
      const cookieVal = getCookie(key);
      if (cookieVal !== null) {
        // Re-persist to localStorage & sessionStorage
        try {
          if (hasLocalStorage && window.localStorage) window.localStorage.setItem(key, cookieVal);
          if (hasSessionStorage && window.sessionStorage) window.sessionStorage.setItem(key, cookieVal);
        } catch {}
        return cookieVal;
      }
    } catch {}

    // 4. Fallback to memory store
    return memoryStore.get(key) ?? null;
  },

  setItem(key: string, value: string): void {
    // 1. In-memory store
    memoryStore.set(key, value);

    // 2. LocalStorage
    try {
      if (hasLocalStorage && typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
      }
    } catch (err) {
      console.warn(`[SafeStorage] Could not persist key "${key}" to localStorage:`, err);
    }

    // 3. SessionStorage
    try {
      if (hasSessionStorage && typeof window !== 'undefined' && window.sessionStorage) {
        window.sessionStorage.setItem(key, value);
      }
    } catch {}

    // 4. Cookie (only for essential auth/role/theme keys to avoid exceeding 4KB cookie limits)
    if (key.startsWith('motoride_auth') || key.startsWith('motoride_active') || key.startsWith('motoride_theme')) {
      setCookie(key, value);
    }
  },

  removeItem(key: string): void {
    // 1. In-memory store
    memoryStore.delete(key);

    // 2. LocalStorage
    try {
      if (hasLocalStorage && typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
      }
    } catch {}

    // 3. SessionStorage
    try {
      if (hasSessionStorage && typeof window !== 'undefined' && window.sessionStorage) {
        window.sessionStorage.removeItem(key);
      }
    } catch {}

    // 4. Cookie
    removeCookie(key);
  },

  clear(): void {
    try {
      memoryStore.clear();
      if (hasLocalStorage && typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.clear();
      }
    } catch {}
  },

  getJSON<T>(key: string, fallback: T): T {
    try {
      const raw = this.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  },

  setJSON(key: string, value: any): void {
    try {
      this.setItem(key, JSON.stringify(value));
    } catch (err) {
      console.warn(`[SafeStorage] Could not set JSON for key "${key}":`, err);
    }
  },
};
