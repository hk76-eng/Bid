import React, { useEffect, useState, useMemo } from 'react';
import { Radio, XCircle, Bike, Sparkles, Star, Target, Compass } from 'lucide-react';
import { AvailableCaptainItem } from '../components/common/MotorideMap';

interface TripInDriveRadarProps {
  onCancel?: () => void;
  isCancelling?: boolean;
  offeredFare?: number;
  rideCode?: string;
  nearbyCaptains?: AvailableCaptainItem[];
  pickupLat?: number;
  pickupLng?: number;
}

// Convert latitude and longitude to true compass bearing degrees (0° = North, 90° = East, 180° = South, 270° = West)
function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const y = Math.sin((lon2 - lon1) * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180));
  const x =
    Math.cos(lat1 * (Math.PI / 180)) * Math.sin(lat2 * (Math.PI / 180)) -
    Math.sin(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.cos((lon2 - lon1) * (Math.PI / 180));
  const deg = (Math.atan2(y, x) * 180) / Math.PI;
  return (deg + 360) % 360;
}

// Great-circle distance between two coordinates in km
function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export const TripInDriveRadar: React.FC<TripInDriveRadarProps> = ({
  onCancel,
  isCancelling = false,
  nearbyCaptains = [],
  pickupLat = 30.7333,
  pickupLng = 76.7794,
}) => {
  // Real-time sweeping angle state for soft amber focus beam
  const [currentAngle, setCurrentAngle] = useState(0);

  useEffect(() => {
    let animationFrameId: number;
    let startTimestamp: number | null = null;
    const duration = 3000; // 3.0s per full 360-degree sweep

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = (timestamp - startTimestamp) % duration;
      const angle = (progress / duration) * 360;
      setCurrentAngle(angle);
      animationFrameId = requestAnimationFrame(step);
    };

    animationFrameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  // Compute exact real-time captain targets mapped into the calibrated radar coordinate frame
  const realTimeTargets = useMemo(() => {
    if (!nearbyCaptains || !Array.isArray(nearbyCaptains) || nearbyCaptains.length === 0) {
      return [];
    }

    // Maximum calibrated radar ring range = 1.5 km (maps to 42% container radius)
    const MAX_RADAR_RANGE_KM = 1.5;
    const MAX_RADIUS_PERCENT = 42; // percentage of container width/height from center (50%)

    // Deduplicate and filter strictly for valid, genuine GPS coordinates
    const seenIds = new Set<string>();
    const seenNames = new Set<string>();
    const seenEmails = new Set<string>();
    let seenMojoCaptain = false;

    const inRangeCaptains = nearbyCaptains
      .filter((cap) => {
        if (!cap) return false;
        const lat = cap.lat ?? (cap as any).current_lat;
        const lng = cap.lng ?? (cap as any).current_lng;
        if (typeof lat !== 'number' || typeof lng !== 'number') return false;
        if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) return false;

        const capId = cap.id || '';
        const capName = (cap.name || (cap as any).full_name || '').trim().toLowerCase();
        const capEmail = ((cap as any).email || '').trim().toLowerCase();

        const isMojo = capEmail === 'mojobiketaxi@gmail.com' || capName.includes('mojobiketaxi') || capId === 'cpt_mojobiketaxi';
        if (isMojo) {
          if (seenMojoCaptain) return false;
          seenMojoCaptain = true;
          cap.name = 'Hemant kashyap';
        }

        // Deduplicate duplicate entries
        if (capId && seenIds.has(capId)) return false;
        if (capEmail && seenEmails.has(capEmail)) return false;
        if (capName && capName !== 'captain' && seenNames.has(capName)) return false;

        if (capId) seenIds.add(capId);
        if (capEmail) seenEmails.add(capEmail);
        if (capName) seenNames.add(capName);

        // Distance check: ensure captains in operational range (<= 20km) are displayed
        const distKm = calculateDistanceKm(pickupLat, pickupLng, lat, lng);
        return distKm <= 20;
      })
      .map((cap, idx) => {
        const cLat = cap.lat ?? (cap as any).current_lat;
        const cLng = cap.lng ?? (cap as any).current_lng;
        const distKm = calculateDistanceKm(pickupLat, pickupLng, cLat, cLng);
        const angleDeg = calculateBearing(pickupLat, pickupLng, cLat, cLng);

        // Exact mathematical radial mapping to match radar rings (200m, 500m, 1.0km, 1.5km)
        // If distKm <= 1.5km: normalizedRatio = distKm / 1.5 (maps from 7% to 42% radius)
        // If distKm > 1.5km: place solidly on outer boundary ring (42% radius) at their exact bearing
        const normalizedRatio = Math.min(1.0, distKm / MAX_RADAR_RANGE_KM);
        const rPercent = Math.max(7, Math.min(MAX_RADIUS_PERCENT, normalizedRatio * MAX_RADIUS_PERCENT));

        // Polar to cartesian projection (0° = North = Top, 90° = East = Right, 180° = South = Bottom, 270° = West = Left)
        const rad = ((angleDeg - 90) * Math.PI) / 180;
        const xPercent = 50 + rPercent * Math.cos(rad);
        const yPercent = 50 + rPercent * Math.sin(rad);

        const distanceText = distKm < 1 ? `${Math.round(distKm * 1000)}m` : `${distKm.toFixed(1)}km`;

        const isMojo = ((cap as any).email || '').toLowerCase() === 'mojobiketaxi@gmail.com' ||
          (cap.name || (cap as any).full_name || '').toLowerCase().includes('mojobiketaxi') ||
          cap.id === 'cpt_mojobiketaxi';

        const finalName = isMojo ? 'Hemant kashyap' : (cap.name || (cap as any).full_name || 'Captain');

        return {
          id: cap.id || `cap-${idx}`,
          name: finalName,
          distKm,
          distanceText,
          rating: cap.rating ? Number(cap.rating).toFixed(1) : '4.9',
          angleDeg,
          rPercent,
          xPercent,
          yPercent,
          heading: cap.heading || angleDeg,
          vehicle: cap.vehicleModel || (cap as any).vehicle?.model || 'Bike',
        };
      });

    return inRangeCaptains;
  }, [nearbyCaptains, pickupLat, pickupLng]);

  return (
    <div className="flex-1 flex flex-col items-center justify-between py-1 sm:py-2 text-center text-slate-900 w-full h-full select-none bg-white">
      {/* Main Radar Scope Container - Pure White Canvas with Small Black Rings & Constant Solid Captain Markers */}
      <div className="my-auto py-1 flex flex-col items-center justify-center w-full">
        {/* Radar Circular Housing - Solid Black Outer Border */}
        <div className="relative w-60 h-60 sm:w-72 sm:h-72 rounded-full bg-white border-2 border-black shadow-[0_8px_30px_rgba(0,0,0,0.12)] flex items-center justify-center overflow-hidden">
          {/* Subtle Ambient Radial Soft Amber Warmth */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(251,191,36,0.06)_0%,rgba(254,243,199,0.3)_55%,transparent_80%)] pointer-events-none" />

          {/* ================================================================================= */}
          {/* CALIBRATED EXACT SMALL BLACK RINGS & CONCENTRIC RANGE MARKS                       */}
          {/* 1.5km = 84% diameter (42% radius)                                                 */}
          {/* 1.0km = 56% diameter (28% radius)                                                 */}
          {/* 500m  = 28% diameter (14% radius)                                                 */}
          {/* 200m  = 12% diameter (6% radius)                                                  */}
          {/* ================================================================================= */}
          {/* Outer Black Ring: 1.5km calibrated ring */}
          <div className="absolute w-[84%] h-[84%] rounded-full border border-black/40 pointer-events-none" />

          {/* Middle Black Ring: 1.0km calibrated ring */}
          <div className="absolute w-[56%] h-[56%] rounded-full border border-black/45 pointer-events-none" />

          {/* Small Inner Black Ring: 500m calibrated ring */}
          <div className="absolute w-[28%] h-[28%] rounded-full border border-black/55 pointer-events-none" />

          {/* Mini Black Ring: 200m calibrated ring */}
          <div className="absolute w-[12%] h-[12%] rounded-full border border-black/60 pointer-events-none" />

          {/* Subtle Black Crosshair Lines */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-full h-[1px] bg-black/20" />
            <div className="h-full w-[1px] bg-black/20 absolute" />
          </div>

          {/* Cardinal Direction Indicators */}
          <span className="absolute top-1.5 left-1/2 -translate-x-1/2 text-[8px] font-black text-black/70 pointer-events-none font-mono">
            N
          </span>
          <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 text-[8px] font-black text-black/70 pointer-events-none font-mono">
            S
          </span>
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[8px] font-black text-black/70 pointer-events-none font-mono">
            E
          </span>
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[8px] font-black text-black/70 pointer-events-none font-mono">
            W
          </span>

          {/* Exact Distance Labels matching calibrated rings */}
          <span className="absolute top-[8%] left-1/2 -translate-x-1/2 text-[7.5px] font-mono-num font-black text-black/75 pointer-events-none bg-white/90 px-1 rounded">
            1.5km
          </span>
          <span className="absolute top-[22%] left-1/2 -translate-x-1/2 text-[7.5px] font-mono-num font-black text-black/70 pointer-events-none bg-white/90 px-1 rounded">
            1.0km
          </span>
          <span className="absolute top-[36%] left-1/2 -translate-x-1/2 text-[7px] font-mono-num font-black text-black/65 pointer-events-none bg-white/90 px-0.5 rounded">
            500m
          </span>

          {/* Concentric Sonar Expanding Rings (No searchlight) */}
          <div className="absolute w-16 h-16 rounded-full border-2 border-amber-500/40 animate-ping pointer-events-none" style={{ animationDuration: '2.2s' }} />
          <div className="absolute w-32 h-32 rounded-full border-2 border-amber-500/30 animate-ping pointer-events-none" style={{ animationDuration: '3.2s', animationDelay: '0.8s' }} />
          <div className="absolute w-48 h-48 rounded-full border border-amber-500/20 animate-ping pointer-events-none" style={{ animationDuration: '4.2s', animationDelay: '1.6s' }} />

          {/* ================================================================================= */}
          {/* CONSTANT & SOLID REAL-TIME CAPTAIN DISPLAY (PERMANENT, CRISP & NEVER HIDING)       */}
          {/* ================================================================================= */}
          {realTimeTargets.map((cap) => {
            // Focus light proximity detection for subtle extra glow without ever hiding
            const diff = (currentAngle - cap.angleDeg + 360) % 360;
            const isSwept = diff <= 85 || diff >= 355;

            return (
              <div
                key={cap.id}
                className="absolute z-20 flex flex-col items-center pointer-events-none"
                style={{
                  left: `${cap.xPercent}%`,
                  top: `${cap.yPercent}%`,
                  transform: 'translate(-50%, -50%)',
                }}
              >
                {/* Captain Vehicle Marker - CONSTANT & SOLID */}
                <div className="relative flex items-center justify-center">
                  {isSwept && (
                    <span
                      className="animate-ping absolute inline-flex h-8 w-8 rounded-full bg-amber-400/40 pointer-events-none"
                      style={{ animationDuration: '1.2s' }}
                    />
                  )}
                  <div className="relative w-7 h-7 rounded-full bg-amber-500 text-slate-950 shadow-[0_2px_10px_rgba(0,0,0,0.3)] border-2 border-black flex items-center justify-center">
                    <Bike className="w-4 h-4 text-slate-950 stroke-[2.5]" />
                  </div>
                </div>

                {/* Real-time Proximity & Position Badge - CONSTANT & SOLID */}
                <div className="mt-1 px-2 py-0.5 rounded-md text-[8px] font-mono font-black shadow-sm flex items-center gap-1 whitespace-nowrap bg-black text-amber-300 border border-amber-400/80">
                  <span className="font-sans font-bold text-white">{cap.name}</span>
                  <span className="text-amber-400">•</span>
                  <span className="text-amber-300 font-black">{cap.distanceText}</span>
                  {cap.rating && (
                    <>
                      <span className="text-amber-400">•</span>
                      <span className="flex items-center text-amber-400">
                        <Star className="w-2.5 h-2.5 fill-amber-400 inline mr-0.5" />
                        {cap.rating}
                      </span>
                    </>
                  )}
                </div>
              </div>
            );
          })}

          {/* ======================================================== */}
          {/* CENTER ROUND SMALL POINT (PASSENGER PICKUP LOCATION)     */}
          {/* ======================================================== */}
          <div className="relative z-30 flex items-center justify-center">
            {/* Outer Soft Pulse Aura */}
            <div className="absolute w-7 h-7 rounded-full bg-amber-500/25 animate-ping pointer-events-none" />

            {/* Small Center Dot Bezel with Black Border */}
            <div className="relative w-4 h-4 rounded-full bg-amber-500 border-2 border-black shadow-[0_0_10px_rgba(245,158,11,0.7)] flex items-center justify-center">
              {/* Inner Core Point */}
              <div className="w-1.5 h-1.5 rounded-full bg-slate-950" />
            </div>

            {/* Small subtle label tag */}
            <div className="absolute -bottom-4 px-1.5 py-0.2 rounded-full bg-black text-amber-400 text-[7px] font-black tracking-wider uppercase font-mono shadow-xs border border-amber-400/60">
              YOU
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Focus Status & Transmission Feedback */}
      <div className="w-full max-w-sm flex flex-col items-center gap-2 px-3 mt-1">
        {/* Equalizer Transmission Pulse in Amber / Gold */}
        <div className="flex items-center gap-1.5 py-1 px-3 rounded-full bg-amber-50 border border-amber-300 shadow-2xs">
          <span className="text-[10px] font-black uppercase text-amber-950 tracking-wide flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-600" />
            Radar Broadcast:
          </span>
          <div className="flex items-end gap-1 h-3 px-1">
            <span className="w-1 bg-amber-500 rounded-full animate-pulse" style={{ height: '75%', animationDuration: '0.5s' }} />
            <span className="w-1 bg-amber-600 rounded-full animate-pulse" style={{ height: '100%', animationDuration: '0.35s' }} />
            <span className="w-1 bg-yellow-500 rounded-full animate-pulse" style={{ height: '60%', animationDuration: '0.6s' }} />
            <span className="w-1 bg-amber-500 rounded-full animate-pulse" style={{ height: '90%', animationDuration: '0.45s' }} />
            <span className="w-1 bg-amber-600 rounded-full animate-pulse" style={{ height: '70%', animationDuration: '0.5s' }} />
          </div>
          <span className="text-[10px] font-mono-num font-black text-amber-700">
            {realTimeTargets.length} {realTimeTargets.length === 1 ? 'Captain' : 'Captains'} In Range
          </span>
        </div>

        {/* Informative Subtext */}
        <p className="text-xs text-slate-600 font-medium leading-relaxed max-w-xs">
          Broadcasting pickup location to nearby verified captains. When a captain accepts or sends an offer, their details will display with a <span className="text-slate-950 font-black">25-second countdown timer</span>.
        </p>

        {/* Cancel Button */}
        {onCancel && (
          <div className="w-full mt-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onCancel}
              disabled={isCancelling}
              className="w-full py-2.5 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 border border-black text-black font-black text-xs flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98] shadow-xs disabled:opacity-50"
              aria-label="Cancel Ride Request"
            >
              <XCircle className="w-4 h-4 text-black shrink-0" />
              <span>{isCancelling ? 'Cancelling Request...' : 'Cancel Ride Request'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
