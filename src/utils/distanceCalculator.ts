import { GPSPoint, PricingSettings, TestResultItem } from '../types';

/**
 * Earth radius in kilometers
 */
/**
 * High-responsiveness GPS smoother for real-time mobile & browser tracking
 * Prevents coordinate locking/freezing by maintaining an active tracking gain
 */
export class GPSFilter {
  private lat: number | null = null;
  private lng: number | null = null;
  private minAccuracy: number = 1;

  constructor(minAccuracy: number = 1) {
    this.minAccuracy = minAccuracy;
  }

  public reset() {
    this.lat = null;
    this.lng = null;
  }

  public process(lat: number, lng: number, accuracy: number, _timeDiffSec: number = 1): { lat: number; lng: number } {
    if (this.lat === null || this.lng === null || !isFinite(this.lat) || !isFinite(this.lng)) {
      this.lat = lat;
      this.lng = lng;
      return { lat, lng };
    }

    // Adaptive smoothing factor based on GPS accuracy
    // High accuracy (<10m): alpha = 0.92 (almost direct tracking)
    // Moderate accuracy (10-30m): alpha = 0.82
    // Lower accuracy (>30m): alpha = 0.70 (smooths jitter while never freezing or sticking)
    const acc = Math.max(accuracy, this.minAccuracy);
    const alpha = acc <= 10 ? 0.92 : acc <= 30 ? 0.82 : 0.70;

    this.lat = this.lat + alpha * (lat - this.lat);
    this.lng = this.lng + alpha * (lng - this.lng);

    return { lat: this.lat, lng: this.lng };
  }
}

export const globalGpsFilter = new GPSFilter(2);


export const EARTH_RADIUS_KM = 6371;

/**
 * Calculates Great-Circle distance between two coordinates using the Haversine formula
 * @returns distance in kilometers
 */
export function calculateHaversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (lat1 === lat2 && lon1 === lon2) return 0;

  const toRad = (angle: number) => (angle * Math.PI) / 180;
  
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

/**
 * Calculates realistic driving road distance in kilometers.
 * In urban and semi-urban road networks (such as Chandigarh Tricity / Mohali),
 * actual driving route distance is ~1.30x to 1.65x the straight-line Haversine displacement
 * due to sector grids, roundabouts, U-turns, and arterial route alignment.
 */
export function calculateRoadDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
  const straightLine = calculateHaversineDistanceKm(lat1, lon1, lat2, lon2);
  if (straightLine <= 0.05) return 0;

  // Short city trips (<3.5 km) navigate sector internal roads & roundabouts (~1.6x factor)
  // Medium trips (3.5 - 9 km) use main sector divide roads / Madhya/Himalaya Marg (~1.42x factor)
  // Longer trips (>9 km) use arterial/highways like PR7, Airport Road (~1.32x factor)
  const detourFactor = straightLine < 3.5 ? 1.62 : straightLine < 9.0 ? 1.42 : 1.32;
  const roadKm = straightLine * detourFactor;
  return Number(Math.max(1.0, roadKm).toFixed(1));
}

/**
 * Fetches exact driving route distance and duration from backend / OSRM routing engine,
 * with instantaneous calibrated road-network fallback.
 */
export async function fetchRouteRoadDistance(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number
): Promise<{ distanceKm: number; durationMin: number; isRoadAccurate: boolean }> {
  const fallbackKm = calculateRoadDistanceKm(originLat, originLng, destLat, destLng);
  const fallbackDuration = Math.max(3, Math.round(fallbackKm * 2.5 + 3));

  if (!originLat || !originLng || !destLat || !destLng) {
    return { distanceKm: 0, durationMin: 0, isRoadAccurate: false };
  }

  try {
    const res = await fetch(
      `/api/motoride/route/distance?originLat=${originLat}&originLng=${originLng}&destLat=${destLat}&destLng=${destLng}`,
      { signal: AbortSignal.timeout(2200) }
    );
    if (res.ok) {
      const data = await res.json();
      if (data.success && typeof data.distance_km === 'number' && data.distance_km > 0) {
        return {
          distanceKm: Number(data.distance_km.toFixed(1)),
          durationMin: Math.max(1, Number(data.duration_min || Math.round(data.distance_km * 2.5 + 3))),
          isRoadAccurate: true,
        };
      }
    }
  } catch {}

  return {
    distanceKm: fallbackKm,
    durationMin: fallbackDuration,
    isRoadAccurate: false,
  };
}

/**
 * Calculates initial bearing / heading angle in degrees (0-360) from point 1 to point 2
 */
export function calculateBearingDegrees(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (lat1 === lat2 && lon1 === lon2) return 0;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;

  const y = Math.sin(toRad(lon2 - lon1)) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lon2 - lon1));

  const bearing = (toDeg(Math.atan2(y, x)) + 360) % 360;
  return bearing;
}

/**
 * Converts degree heading (0-360) to 8-point compass cardinal direction
 */
export function getCardinalDirection(headingDegrees: number): string {
  const directions = ['North (N)', 'North-East (NE)', 'East (E)', 'South-East (SE)', 'South (S)', 'South-West (SW)', 'West (W)', 'North-West (NW)'];
  const index = Math.round(((headingDegrees % 360) / 45)) % 8;
  return directions[index];
}

/**
 * Evaluates whether a new GPS point is valid for distance accumulation.
 * Filters out:
 * 1. Accuracy poorer than max threshold (e.g. > 45m)
 * 2. Unrealistic speed jumps (e.g. > 45 km/h for a bicycle)
 * 3. Stationary jitter (e.g. < 3m movement)
 * 4. Backward/duplicate timestamps
 */
export function evaluateGPSPoint(
  previousPoint: GPSPoint | null,
  newPoint: GPSPoint,
  settings: PricingSettings,
  isRidePaused: boolean = false
): {
  isValid: boolean;
  deltaDistanceKm: number;
  speedKmh: number;
  rejectionReason?: string;
} {
  // If ride is paused, do not accumulate distance
  if (isRidePaused) {
    return {
      isValid: false,
      deltaDistanceKm: 0,
      speedKmh: 0,
      rejectionReason: 'Ride is paused',
    };
  }

  // 1. Check GPS accuracy (allow reasonable tolerance for mobile GPS)
  const maxAcc = Math.max(100, settings.max_gps_accuracy_threshold_m || 100);
  if (newPoint.accuracy && newPoint.accuracy > maxAcc) {
    return {
      isValid: false,
      deltaDistanceKm: 0,
      speedKmh: 0,
      rejectionReason: `GPS accuracy too low (${Math.round(newPoint.accuracy)}m > ${maxAcc}m limit)`,
    };
  }

  // First point is always valid anchor (0 delta)
  if (!previousPoint) {
    return {
      isValid: true,
      deltaDistanceKm: 0,
      speedKmh: 0,
    };
  }

  const timeDiffMs = Math.max(1, newPoint.timestamp - previousPoint.timestamp);

  const rawDeltaKm = calculateHaversineDistanceKm(
    previousPoint.latitude,
    previousPoint.longitude,
    newPoint.latitude,
    newPoint.longitude
  );

  const deltaMeters = rawDeltaKm * 1000;
  const timeDiffHours = timeDiffMs / (1000 * 60 * 60);
  const calculatedSpeedKmh = timeDiffHours > 0 ? rawDeltaKm / timeDiffHours : 0;
  const reportedSpeedKmh = newPoint.speed ? newPoint.speed * 3.6 : calculatedSpeedKmh;

  // 2. Stationary / Stopped Check:
  // Calculate effective speed from either native hardware speed or coordinate displacement over time
  const effectiveSpeedKmh = Math.max(reportedSpeedKmh, calculatedSpeedKmh);
  const isMoving = newPoint.isMoving !== undefined ? newPoint.isMoving : (effectiveSpeedKmh >= 1.0 && deltaMeters >= 1.5);

  // If vehicle is stopped or stationary, STRICTLY do not add distance
  if (!isMoving || effectiveSpeedKmh < 1.0 || deltaMeters < 1.5) {
    return {
      isValid: false,
      deltaDistanceKm: 0,
      speedKmh: 0,
      rejectionReason: 'Vehicle stopped - distance frozen',
    };
  }

  // 3. Speed Jump Check: allow realistic bicycle/motorcycle speeds up to max_speed_kmh (default 90-120 km/h)
  const maxSpeedLimit = Math.max(90, settings.max_speed_kmh || 90);
  if (calculatedSpeedKmh > maxSpeedLimit && deltaMeters > 200) {
    return {
      isValid: false,
      deltaDistanceKm: 0,
      speedKmh: calculatedSpeedKmh,
      rejectionReason: `Unrealistic speed jump (${calculatedSpeedKmh.toFixed(1)} km/h > ${maxSpeedLimit} km/h max)`,
    };
  }

  return {
    isValid: true,
    deltaDistanceKm: rawDeltaKm,
    speedKmh: Math.min(maxSpeedLimit, effectiveSpeedKmh),
  };
}

/**
 * Calculates fare strictly based on total distance and configurable pricing rules
 * Formula: fare = max(minimum_fare, base_unlock_fee + (total_distance_km * rate_per_km))
 */
export function calculateFare(
  totalDistanceKm: number,
  ratePerKm: number,
  baseUnlockFee: number = 0,
  minimumFare: number = 0
): {
  distanceFare: number;
  baseFee: number;
  totalFare: number;
} {
  const cleanDistance = Math.max(0, totalDistanceKm);
  const cleanRate = Math.max(0, ratePerKm);
  const cleanBase = Math.max(0, baseUnlockFee);
  const cleanMin = Math.max(0, minimumFare);

  const distanceFare = cleanDistance * cleanRate;
  const rawTotal = cleanBase + distanceFare;
  const totalFare = Math.max(cleanMin, rawTotal);

  return {
    distanceFare: Number(distanceFare.toFixed(2)),
    baseFee: Number(cleanBase.toFixed(2)),
    totalFare: Number(totalFare.toFixed(2)),
  };
}

/**
 * Formats currency amount
 */
export function formatCurrency(amount: number, symbol: string = '₹'): string {
  return `${symbol}${amount.toFixed(2)}`;
}

/**
 * Formats distance with unit
 */
export function formatDistance(distanceKm: number): string {
  return `${distanceKm.toFixed(2)} km`;
}

/**
 * Formats seconds into HH:MM:SS or MM:SS
 */
export function formatDuration(seconds: number): string {
  const sec = Math.floor(seconds);
  const hrs = Math.floor(sec / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  const remainingSecs = sec % 60;

  const pad = (n: number) => n.toString().padStart(2, '0');

  if (hrs > 0) {
    return `${pad(hrs)}:${pad(mins)}:${pad(remainingSecs)}`;
  }
  return `${pad(mins)}:${pad(remainingSecs)}`;
}

/**
 * Automated Test Suite for distance and fare calculations
 */
export function runAutomatedTests(customRate: number = 10): TestResultItem[] {
  const results: TestResultItem[] = [];

  // Default settings
  const defaultSettings: PricingSettings = {
    rate_per_km: customRate,
    base_unlock_fee: 0,
    minimum_fare: 0,
    currency_symbol: '₹',
    max_gps_accuracy_threshold_m: 50,
    max_speed_kmh: 45,
    min_movement_threshold_m: 3,
    auto_sync_interval_ms: 2000,
  };

  // Test 1: 1 km at ₹10/km
  const test1 = calculateFare(1.0, 10, 0, 0);
  results.push({
    id: 'T1',
    title: '1.00 km Base Rate',
    description: '1 km at ₹10/km should yield ₹10.00',
    expected: '₹10.00',
    actual: `₹${test1.totalFare.toFixed(2)}`,
    passed: test1.totalFare === 10.0,
    details: `Distance: 1 km × ₹10 = ₹${test1.totalFare}`,
  });

  // Test 2: 2 km at ₹10/km
  const test2 = calculateFare(2.0, 10, 0, 0);
  results.push({
    id: 'T2',
    title: '2.00 km Base Rate',
    description: '2 km at ₹10/km should yield ₹20.00',
    expected: '₹20.00',
    actual: `₹${test2.totalFare.toFixed(2)}`,
    passed: test2.totalFare === 20.0,
    details: `Distance: 2 km × ₹10 = ₹${test2.totalFare}`,
  });

  // Test 3: 5.5 km at ₹10/km
  const test3 = calculateFare(5.5, 10, 0, 0);
  results.push({
    id: 'T3',
    title: '5.50 km Fractional Fare',
    description: '5.5 km at ₹10/km should yield ₹55.00',
    expected: '₹55.00',
    actual: `₹${test3.totalFare.toFixed(2)}`,
    passed: test3.totalFare === 55.0,
    details: `Distance: 5.5 km × ₹10 = ₹${test3.totalFare}`,
  });

  // Test 4: 10 km at ₹10/km
  const test4 = calculateFare(10.0, 10, 0, 0);
  results.push({
    id: 'T4',
    title: '10.00 km Extended Ride',
    description: '10 km at ₹10/km should yield ₹100.00',
    expected: '₹100.00',
    actual: `₹${test4.totalFare.toFixed(2)}`,
    passed: test4.totalFare === 100.0,
    details: `Distance: 10 km × ₹10 = ₹${test4.totalFare}`,
  });

  // Test 5: Dynamic configurable rate (e.g. ₹15/km for 5.42 km)
  const test5 = calculateFare(5.42, 15, 0, 0);
  const expectedTest5 = Number((5.42 * 15).toFixed(2));
  results.push({
    id: 'T5',
    title: 'Configurable Rate Test (₹15/km)',
    description: '5.42 km at ₹15/km should calculate dynamically',
    expected: `₹${expectedTest5.toFixed(2)}`,
    actual: `₹${test5.totalFare.toFixed(2)}`,
    passed: test5.totalFare === expectedTest5,
    details: `5.42 km × ₹15/km = ₹${test5.totalFare}`,
  });

  // Test 6: Haversine distance accuracy
  // Gateway of India (18.9220, 72.8347) to Marine Drive (18.9438, 72.8232) is ~2.72 km
  const hDist = calculateHaversineDistanceKm(18.9220, 72.8347, 18.9438, 72.8232);
  const hPassed = hDist >= 2.6 && hDist <= 2.9;
  results.push({
    id: 'T6',
    title: 'Haversine Great-Circle Precision',
    description: 'Calculates real spherical distance between coordinates accurately',
    expected: '~2.72 km (±0.15 km)',
    actual: `${hDist.toFixed(2)} km`,
    passed: hPassed,
    details: `Computed coordinate span: ${hDist.toFixed(4)} km`,
  });

  // Test 7: GPS Poor Accuracy Rejection
  const basePoint: GPSPoint = {
    latitude: 12.9716,
    longitude: 77.5946,
    accuracy: 10,
    timestamp: 1000000,
  };
  const poorAccPoint: GPSPoint = {
    latitude: 12.9720,
    longitude: 77.5950,
    accuracy: 85, // Exceeds 50m limit
    timestamp: 1005000,
  };
  const evalPoorAcc = evaluateGPSPoint(basePoint, poorAccPoint, defaultSettings, false);
  results.push({
    id: 'T7',
    title: 'Inaccurate GPS Filtering',
    description: 'Points with accuracy > 50m must be rejected from meter accumulation',
    expected: 'Rejected',
    actual: evalPoorAcc.isValid ? 'Accepted' : 'Rejected',
    passed: !evalPoorAcc.isValid && evalPoorAcc.rejectionReason?.includes('accuracy') === true,
    details: evalPoorAcc.rejectionReason,
  });

  // Test 8: Impossible Speed Jump Filter (Teleportation/GPS Glitch)
  const jumpPoint: GPSPoint = {
    latitude: 13.0500, // jumped ~8.7 km in 3 seconds (> 10,000 km/h)
    longitude: 77.5950,
    accuracy: 10,
    timestamp: 1003000, // 3s later
  };
  const evalJump = evaluateGPSPoint(basePoint, jumpPoint, defaultSettings, false);
  results.push({
    id: 'T8',
    title: 'Speed Jump & Glitch Protection',
    description: 'Impossible speed (> 45 km/h for bike) must be discarded',
    expected: 'Rejected',
    actual: evalJump.isValid ? 'Accepted' : 'Rejected',
    passed: !evalJump.isValid && evalJump.rejectionReason?.includes('speed') === true,
    details: evalJump.rejectionReason,
  });

  // Test 9: Stationary GPS Jitter Filter (< 3m drift while stopped)
  const jitterPoint: GPSPoint = {
    latitude: 12.971605, // moved ~0.6 meters
    longitude: 77.594605,
    accuracy: 8,
    timestamp: 1003000,
  };
  const evalJitter = evaluateGPSPoint(basePoint, jitterPoint, defaultSettings, false);
  results.push({
    id: 'T9',
    title: 'Stationary Jitter Suppression',
    description: 'Minor GPS drift (< 3m) when stationary should not add phantom distance',
    expected: 'Rejected (Jitter)',
    actual: evalJitter.isValid ? 'Accepted' : 'Rejected (Jitter)',
    passed: !evalJitter.isValid && evalJitter.rejectionReason?.includes('jitter') === true,
    details: evalJitter.rejectionReason,
  });

  // Test 10: Pause State Isolation
  const validMovementPoint: GPSPoint = {
    latitude: 12.9725,
    longitude: 77.5955,
    accuracy: 8,
    timestamp: 1010000,
  };
  const evalPaused = evaluateGPSPoint(basePoint, validMovementPoint, defaultSettings, true);
  results.push({
    id: 'T10',
    title: 'Pause State Isolation',
    description: 'No distance must accumulate while ride status is PAUSED',
    expected: 'Zero Delta (Paused)',
    actual: evalPaused.deltaDistanceKm === 0 ? 'Zero Delta (Paused)' : 'Accumulated',
    passed: !evalPaused.isValid && evalPaused.deltaDistanceKm === 0,
    details: evalPaused.rejectionReason,
  });

  return results;
}
