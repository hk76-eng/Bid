/**
 * Safe Utility for resolving local APK relative fetches to the live absolute domain.
 * Connects to the backend server (defaulting to https://motoride.wasmer.app).
 * Avoids protocol errors and crashes when running under file:// or offline WebView packages.
 */

export const WASMER_BACKEND_URL = 'https://motoride.wasmer.app';
export const APPWRITE_NETWORK_URL = 'https://motoride.appwrite.network/';
export const APPWRITE_ENDPOINT = 'https://nyc.cloud.appwrite.io/v1';
export const APPWRITE_PROJECT_ID = '6ad0ec7900143b6a777b';

export function getApiUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    // Prepend live backend host if running in native Android APK, WebView (file://), local wrapper,
    // or static CDN/edge deployments (appwrite.network, vercel.app)
    if (
      protocol === 'file:' ||
      hostname.includes('appwrite.network') ||
      hostname.includes('vercel.app')
    ) {
      const remoteBase = (import.meta as any)?.env?.VITE_API_BASE_URL || WASMER_BACKEND_URL;
      return `${remoteBase.replace(/\/$/, '')}${cleanPath}`;
    }
  }
  return cleanPath;
}
