/**
 * Google Analytics 4 (GA4) & SEO Management Utility for Motoride Platform
 */

declare global {
  interface Window {
    dataLayer?: any[];
    gtag?: (...args: any[]) => void;
  }
}

export interface AnalyticsEventLog {
  id: string;
  timestamp: string;
  type: 'init' | 'page_view' | 'custom_event';
  name: string;
  params?: Record<string, any>;
  measurementId: string;
}

const STORAGE_GA_KEY = 'motoride_ga_measurement_id';
const eventLogBuffer: AnalyticsEventLog[] = [];
let isInitialized = false;
let currentMeasurementId: string | null = null;
let lastTrackedPath: string | null = null;

/**
 * Retrieve GA4 Measurement ID from environment variables or local storage override
 */
export function getGaMeasurementId(): string {
  if (typeof window === 'undefined') return '';
  const stored = localStorage.getItem(STORAGE_GA_KEY);
  if (stored && stored.trim()) {
    return stored.trim();
  }
  const envId = (import.meta.env.VITE_GA_MEASUREMENT_ID as string) || '';
  return envId.trim();
}

/**
 * Save GA4 Measurement ID override and re-initialize
 */
export function saveGaMeasurementId(id: string): boolean {
  if (typeof window === 'undefined') return false;
  const cleanId = id.trim();
  if (cleanId) {
    localStorage.setItem(STORAGE_GA_KEY, cleanId);
  } else {
    localStorage.removeItem(STORAGE_GA_KEY);
  }
  return initAnalytics(cleanId);
}

/**
 * Initialize Google Analytics 4 with official gtag.js implementation
 */
export function initAnalytics(overrideId?: string): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return false;
  }

  const measurementId = (overrideId !== undefined ? overrideId : getGaMeasurementId()).trim();

  if (!measurementId || !/^G-[A-Z0-9]+$/i.test(measurementId)) {
    return false;
  }

  // Prevent duplicate initialization with same ID
  if (isInitialized && currentMeasurementId === measurementId) {
    return true;
  }

  try {
    // 1. Inject official Google Tag script if not present
    const existingScript = document.getElementById('ga-gtag-script');
    if (!existingScript) {
      const script = document.createElement('script');
      script.id = 'ga-gtag-script';
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
      document.head.appendChild(script);
    }

    // 2. Initialize dataLayer and gtag function
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() {
      window.dataLayer?.push(arguments);
    };

    window.gtag('js', new Date());

    // Disable automatic page views to prevent duplicate counts during SPA route transitions
    window.gtag('config', measurementId, {
      send_page_view: false,
    });

    isInitialized = true;
    currentMeasurementId = measurementId;

    // Log event in buffer for Admin Dashboard visibility
    logAnalyticsEvent({
      type: 'init',
      name: 'ga4_initialized',
      measurementId,
      params: { status: 'success' },
    });

    return true;
  } catch (err) {
    console.warn('[Analytics] GA4 Initialization notice:', err);
    return false;
  }
}

/**
 * Track SPA Page Views safely without duplicates
 */
export function trackPageView(path?: string, title?: string): void {
  if (typeof window === 'undefined') return;

  const currentPath = path || window.location.pathname + window.location.search;
  const currentTitle = title || document.title;

  // Deduplicate rapid identical page views
  if (lastTrackedPath === currentPath) {
    return;
  }
  lastTrackedPath = currentPath;

  const measurementId = currentMeasurementId || getGaMeasurementId();

  if (isInitialized && window.gtag && measurementId) {
    window.gtag('event', 'page_view', {
      page_path: currentPath,
      page_title: currentTitle,
      send_to: measurementId,
    });
  }

  logAnalyticsEvent({
    type: 'page_view',
    name: 'page_view',
    measurementId: measurementId || 'UNCONFIGURED',
    params: { path: currentPath, title: currentTitle },
  });
}

/**
 * Track custom user / platform actions
 */
export function trackEvent(eventName: string, params?: Record<string, any>): void {
  if (typeof window === 'undefined') return;

  const measurementId = currentMeasurementId || getGaMeasurementId();

  if (isInitialized && window.gtag && measurementId) {
    window.gtag('event', eventName, {
      ...params,
      send_to: measurementId,
    });
  }

  logAnalyticsEvent({
    type: 'custom_event',
    name: eventName,
    measurementId: measurementId || 'UNCONFIGURED',
    params: params || {},
  });
}

/**
 * Internal logger to populate live Analytics feed in Admin Dashboard
 */
function logAnalyticsEvent(event: Omit<AnalyticsEventLog, 'id' | 'timestamp'>) {
  const newLog: AnalyticsEventLog = {
    ...event,
    id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date().toLocaleTimeString(),
  };

  eventLogBuffer.unshift(newLog);
  if (eventLogBuffer.length > 50) {
    eventLogBuffer.pop();
  }
}

/**
 * Get internal event buffer for Admin Console tab
 */
export function getAnalyticsLogBuffer(): AnalyticsEventLog[] {
  return [...eventLogBuffer];
}

/**
 * Dynamically toggle robots meta tag between public indexable and private admin noindex
 */
export function enforceAdminNoIndex(isAdminArea: boolean): void {
  if (typeof document === 'undefined') return;

  let robotsMeta = document.querySelector('meta[name="robots"]');
  if (!robotsMeta) {
    robotsMeta = document.createElement('meta');
    robotsMeta.setAttribute('name', 'robots');
    document.head.appendChild(robotsMeta);
  }

  if (isAdminArea) {
    robotsMeta.setAttribute('content', 'noindex, nofollow');
  } else {
    robotsMeta.setAttribute('content', 'index, follow');
  }
}
