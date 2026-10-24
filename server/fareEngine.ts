export interface BackendGPSPoint {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
  speed?: number | null;
  heading?: number | null;
}

export const EARTH_RADIUS_KM = 6371.0088;

export function backendHaversineDistanceKm(
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

export function backendCalculateFare(
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
