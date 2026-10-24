import React, { useEffect, useState } from 'react';
import { Radio, XCircle } from 'lucide-react';

interface TripSearchlightRadarProps {
  onCancel?: () => void;
  isCancelling?: boolean;
  offeredFare?: number;
  rideCode?: string;
  nearbyCaptainsCount?: number;
  nearbyCaptains?: Array<{
    id: string;
    name: string;
    email?: string;
    phone?: string;
    distanceText?: string;
    distKm?: number;
    rPercent?: number;
    xPercent?: number;
    yPercent?: number;
    isNearest?: boolean;
    is_online?: boolean;
  }>;
}

export const TripSearchlightRadar: React.FC<TripSearchlightRadarProps> = ({
  onCancel,
  isCancelling = false,
  offeredFare,
  rideCode,
  nearbyCaptainsCount,
  nearbyCaptains = [],
}) => {
  // Live dynamic azimuth bearing angle for real-time telemetry HUD
  const [bearing, setBearing] = useState<number>(12);

  useEffect(() => {
    const interval = setInterval(() => {
      setBearing((prev) => (prev + 9) % 360);
    }, 120);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex-1 flex flex-col items-center justify-between py-2 sm:py-3 text-center text-slate-900 w-full h-full select-none bg-white">
      {/* Top Telemetry & Status HUD Header */}
      <div className="w-full flex flex-col items-center gap-1.5 px-2">
        <div className="flex items-center gap-3 text-[11px] text-slate-600 font-bold">
          <span className="flex items-center gap-1 font-mono-num text-black">
            <Radio className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
            <span>AZM {bearing.toString().padStart(3, '0')}°</span>
          </span>
          <span className="text-slate-300">•</span>
          <span className="text-black font-black">
            RADAR ACTIVE
          </span>
          {rideCode && (
            <>
              <span className="text-slate-300">•</span>
              <span className="font-mono text-slate-600 font-bold">#{rideCode}</span>
            </>
          )}
        </div>
      </div>

      {/* Main Radar Scope Body - Clean Simple Radar Pulse (No Captain Icons, No Solar Circles) */}
      <div className="my-auto py-1 sm:py-2 flex flex-col items-center justify-center shrink-0">
        {/* The Circular Radar Scope with Clean White Canvas & Solid Black Border */}
        <div className="relative w-44 h-44 sm:w-52 sm:h-52 rounded-full bg-white border-2 border-black shadow-[0_4px_30px_rgba(0,0,0,0.12)] flex items-center justify-center overflow-hidden">
          {/* Subtle Ambient Radial Soft Glow */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.08)_0%,rgba(0,0,0,0.02)_50%,transparent_80%)] pointer-events-none" />

          {/* Compass Cardinal Points in Black */}
          <span className="absolute top-2 left-1/2 -translate-x-1/2 text-[9px] font-black text-black font-mono tracking-widest z-10 pointer-events-none">
            N
          </span>
          <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[9px] font-black text-black/70 font-mono tracking-widest z-10 pointer-events-none">
            S
          </span>
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] font-black text-black/70 font-mono tracking-widest z-10 pointer-events-none">
            E
          </span>
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[9px] font-black text-black/70 font-mono tracking-widest z-10 pointer-events-none">
            W
          </span>

          {/* Azimuth Crosshairs in Black */}
          <div className="absolute w-full h-[1px] bg-black/15 top-1/2 left-0 -translate-y-1/2 pointer-events-none" />
          <div className="absolute h-full w-[1px] bg-black/15 left-1/2 top-0 -translate-x-1/2 pointer-events-none" />

          {/* 360° Rotating Radar Sweep Scanner Beam */}
          <div
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{
              background: 'conic-gradient(from 0deg, rgba(16, 185, 129, 0.28) 0deg, rgba(16, 185, 129, 0.05) 45deg, transparent 90deg, transparent 360deg)',
              transform: `rotate(${bearing}deg)`,
              transition: 'transform 0.12s linear',
            }}
          />

          {/* Simple Expanding Radar Pulse Waves (Clean Concentric Ripples) */}
          <div className="absolute w-12 h-12 rounded-full border-2 border-emerald-500/60 animate-ping pointer-events-none" style={{ animationDuration: '2.2s' }} />
          <div className="absolute w-24 h-24 rounded-full border-2 border-emerald-500/45 animate-ping pointer-events-none" style={{ animationDuration: '2.2s', animationDelay: '0.55s' }} />
          <div className="absolute w-40 h-40 rounded-full border-2 border-emerald-500/30 animate-ping pointer-events-none" style={{ animationDuration: '2.2s', animationDelay: '1.1s' }} />
          <div className="absolute w-56 h-56 rounded-full border border-emerald-500/20 animate-ping pointer-events-none" style={{ animationDuration: '2.2s', animationDelay: '1.65s' }} />

          {/* Central Radar Pulse Emitter Beacon (No captain icon, clean radar pulse hub) */}
          <div className="relative z-30 flex items-center justify-center">
            <span className="absolute w-10 h-10 rounded-full bg-emerald-500/25 animate-ping pointer-events-none" style={{ animationDuration: '1.8s' }} />
            <div className="relative w-7 h-7 rounded-full bg-black border-2 border-emerald-400 shadow-[0_2px_12px_rgba(16,185,129,0.5)] flex items-center justify-center">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_#34d399]" />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Live Searching Transmission Feedback & Radio Bars */}
      <div className="w-full max-w-sm flex flex-col items-center gap-2 px-3 mt-1">
        <div className="flex items-center gap-1.5 py-1 px-3 rounded-full bg-slate-100 border border-slate-200 shadow-2xs">
          <div className="flex items-end gap-1 h-3 px-1">
            <span className="w-1 bg-emerald-500 rounded-full animate-pulse" style={{ height: '70%', animationDuration: '0.6s' }} />
            <span className="w-1 bg-emerald-500 rounded-full animate-pulse" style={{ height: '100%', animationDuration: '0.4s' }} />
            <span className="w-1 bg-emerald-500 rounded-full animate-pulse" style={{ height: '50%', animationDuration: '0.8s' }} />
            <span className="w-1 bg-emerald-500 rounded-full animate-pulse" style={{ height: '90%', animationDuration: '0.5s' }} />
          </div>
          <span className="text-[10px] font-mono-num font-black text-black">
            Broadcasting Ride Request...
          </span>
        </div>

        <p className="text-xs text-slate-600 font-medium leading-relaxed max-w-xs">
          Searching for nearby online captains. Captains can accept or send a counter-offer with a <span className="text-slate-950 font-black">25-second timer</span>.
        </p>

        {onCancel && (
          <div className="w-full max-w-xs pt-1.5">
            <button
              type="button"
              onClick={onCancel}
              disabled={isCancelling}
              className="w-full py-2.5 px-4 rounded-2xl bg-slate-100 hover:bg-rose-50 border-2 border-black text-black hover:text-rose-600 font-black text-xs flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98] shadow-sm disabled:opacity-50"
              aria-label="Cancel Ride Request"
            >
              <XCircle className="w-4 h-4 text-black group-hover:text-rose-600 shrink-0 stroke-[2.5]" />
              <span>{isCancelling ? 'Cancelling Request...' : 'Cancel Ride Request'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
