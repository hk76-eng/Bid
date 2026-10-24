import React, { useEffect, useState } from 'react';
import { Sun, XCircle, Bike, ShieldCheck, Sparkles, Orbit, Radio } from 'lucide-react';

interface TripSolarSystemRadarProps {
  onCancel?: () => void;
  isCancelling?: boolean;
  offeredFare?: number;
  rideCode?: string;
  nearbyCaptainsCount?: number;
}

export const TripSolarSystemRadar: React.FC<TripSolarSystemRadarProps> = ({
  onCancel,
  isCancelling = false,
  offeredFare,
  rideCode,
  nearbyCaptainsCount = 3,
}) => {
  // Planetary solar wind frequency oscillation
  const [solarPulse, setSolarPulse] = useState<number>(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setSolarPulse((prev) => (prev + 1) % 100);
    }, 50);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex-1 flex flex-col items-center justify-between py-2 sm:py-3 text-center text-slate-900 w-full h-full select-none">
      {/* Top Solar System Telemetry HUD Header */}
      <div className="w-full flex flex-col items-center gap-1.5 px-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-950 border border-amber-500/50 shadow-md">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500 shadow-[0_0_8px_#f59e0b]" />
          </span>
          <span className="text-[11px] font-black tracking-wider uppercase text-amber-400 font-mono-num flex items-center gap-1">
            <Orbit className="w-3.5 h-3.5 text-amber-400 animate-spin" style={{ animationDuration: '8s' }} />
            <span>SOLAR SYSTEM RADAR ACTIVE</span>
          </span>
        </div>

        <div className="flex items-center gap-3 text-[11px] text-slate-600 font-bold">
          <span className="flex items-center gap-1 font-mono-num text-amber-700">
            <Sun className="w-3 h-3 text-amber-500 animate-spin" style={{ animationDuration: '12s' }} />
            <span>SOLAR BROADCAST</span>
          </span>
          <span className="text-slate-300">•</span>
          <span className="text-emerald-700 font-black">
            {nearbyCaptainsCount} CAPTAINS IN ORBIT
          </span>
          {rideCode && (
            <>
              <span className="text-slate-300">•</span>
              <span className="font-mono text-slate-500 font-bold">#{rideCode}</span>
            </>
          )}
        </div>
      </div>

      {/* Main Solar System Celestial Canvas Body */}
      <div className="my-auto py-2 flex flex-col items-center justify-center">
        {/* The Cosmic Space Dome */}
        <div className="relative w-56 h-56 sm:w-64 sm:h-64 rounded-full bg-[radial-gradient(ellipse_at_center,_#0f172a_0%,_#090d16_45%,_#020617_100%)] border-2 border-amber-500/40 shadow-[0_0_40px_rgba(245,158,11,0.22),inset_0_0_30px_rgba(30,58,138,0.25)] flex items-center justify-center overflow-hidden">
          {/* Subtle Twinkling Starfield */}
          <div className="absolute top-4 left-8 w-1 h-1 rounded-full bg-white/70 animate-pulse" style={{ animationDuration: '2s' }} />
          <div className="absolute top-10 right-12 w-1.5 h-1.5 rounded-full bg-amber-200/80 animate-ping" style={{ animationDuration: '3.5s' }} />
          <div className="absolute bottom-8 left-14 w-1 h-1 rounded-full bg-blue-200/60 animate-pulse" style={{ animationDuration: '2.5s' }} />
          <div className="absolute bottom-12 right-10 w-1 h-1 rounded-full bg-emerald-200/70 animate-pulse" style={{ animationDuration: '3s' }} />
          <div className="absolute top-1/2 left-4 w-1 h-1 rounded-full bg-amber-100/50" />
          <div className="absolute top-1/3 right-5 w-1 h-1 rounded-full bg-purple-200/60 animate-pulse" />

          {/* Expanding Solar Wind & Gravity Wave Ripples radiating from the Sun */}
          <div
            className="absolute w-16 h-16 rounded-full border border-amber-400/40 animate-ping pointer-events-none"
            style={{ animationDuration: '2.4s' }}
          />
          <div
            className="absolute w-32 h-32 rounded-full border border-orange-400/30 animate-ping pointer-events-none"
            style={{ animationDuration: '3.2s', animationDelay: '0.8s' }}
          />
          <div
            className="absolute w-48 h-48 rounded-full border border-yellow-500/20 animate-ping pointer-events-none"
            style={{ animationDuration: '4s', animationDelay: '1.6s' }}
          />

          {/* ======================================================== */}
          {/* ORBIT 3 (OUTER ORBIT - VIOLET ICE GIANT ~1.1 KM) */}
          {/* ======================================================== */}
          <div className="absolute w-[88%] h-[88%] rounded-full border border-purple-500/25 border-dotted pointer-events-none flex items-center justify-center">
            <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-[7px] font-mono font-bold text-purple-300/60 bg-slate-950 px-1">
              Orbit γ • 1.1km
            </span>
          </div>

          {/* Orbit 3 Revolving Planetary Container */}
          <div
            className="absolute w-[88%] h-[88%] rounded-full pointer-events-none"
            style={{
              animation: 'solar-orbit-clockwise 24s linear infinite',
            }}
          >
            {/* Captain Planet 3 (Violet/Sapphire Ice Giant with Moon) */}
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex flex-col items-center">
              <div
                className="relative flex items-center justify-center"
                style={{
                  animation: 'solar-orbit-counter 24s linear infinite',
                }}
              >
                {/* Planet Body */}
                <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-indigo-700 via-purple-500 to-pink-400 shadow-[0_0_12px_#c084fc] border border-purple-200 flex items-center justify-center">
                  <Bike className="w-2.5 h-2.5 text-white stroke-[2.5]" />
                </div>
                {/* Orbiting Moon */}
                <div
                  className="absolute w-8 h-8 rounded-full pointer-events-none"
                  style={{ animation: 'solar-orbit-clockwise 3s linear infinite' }}
                >
                  <span className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-slate-100 shadow-[0_0_4px_#fff]" />
                </div>
                {/* Planet Proximity Badge */}
                <div className="absolute -bottom-4 px-1 py-0.2 rounded bg-slate-950/95 border border-purple-400/60 text-[7px] font-mono font-black text-purple-200 shadow-md whitespace-nowrap">
                  Cap. Amit • 1.1km
                </div>
              </div>
            </div>
          </div>

          {/* ======================================================== */}
          {/* ORBIT 2 (MID ORBIT - GOLDEN RINGED PLANET ~720 M) */}
          {/* ======================================================== */}
          <div className="absolute w-[62%] h-[62%] rounded-full border border-amber-400/30 border-dashed pointer-events-none flex items-center justify-center">
            <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-[7px] font-mono font-bold text-amber-300/70 bg-slate-950 px-1">
              Orbit β • 720m
            </span>
          </div>

          {/* Orbit 2 Revolving Planetary Container */}
          <div
            className="absolute w-[62%] h-[62%] rounded-full pointer-events-none"
            style={{
              animation: 'solar-orbit-clockwise 15s linear infinite',
            }}
          >
            {/* Captain Planet 2 (Golden Ringed Gas Giant - like Saturn!) */}
            <div className="absolute top-1/2 -right-3 -translate-y-1/2 flex flex-col items-center">
              <div
                className="relative flex items-center justify-center"
                style={{
                  animation: 'solar-orbit-counter 15s linear infinite',
                }}
              >
                {/* Saturnian Planetary Ring Disc */}
                <div className="absolute w-8 h-3 rounded-full border-2 border-amber-300/80 -rotate-12 pointer-events-none shadow-[0_0_8px_#fde047]" />
                {/* Planet Body */}
                <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-amber-600 via-yellow-400 to-orange-500 shadow-[0_0_12px_#f59e0b] border border-amber-100 flex items-center justify-center z-10">
                  <Bike className="w-2.5 h-2.5 text-slate-950 stroke-[2.5]" />
                </div>
                {/* Planet Proximity Badge */}
                <div className="absolute -bottom-4 px-1 py-0.2 rounded bg-slate-950/95 border border-amber-400/60 text-[7px] font-mono font-black text-amber-200 shadow-md whitespace-nowrap z-20">
                  Cap. Rahul • 720m
                </div>
              </div>
            </div>
          </div>

          {/* ======================================================== */}
          {/* ORBIT 1 (INNER ORBIT - EMERALD TERRESTRIAL PLANET ~350 M) */}
          {/* ======================================================== */}
          <div className="absolute w-[38%] h-[38%] rounded-full border border-emerald-400/35 border-dashed pointer-events-none flex items-center justify-center">
            <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-[7px] font-mono font-bold text-emerald-300/70 bg-slate-950 px-1">
              Orbit α • 350m
            </span>
          </div>

          {/* Orbit 1 Revolving Planetary Container */}
          <div
            className="absolute w-[38%] h-[38%] rounded-full pointer-events-none"
            style={{
              animation: 'solar-orbit-clockwise 8s linear infinite',
            }}
          >
            {/* Captain Planet 1 (Emerald Terrestrial Planet) */}
            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 flex flex-col items-center">
              <div
                className="relative flex items-center justify-center"
                style={{
                  animation: 'solar-orbit-counter 8s linear infinite',
                }}
              >
                {/* Trailing Comet Dust Particle */}
                <div className="absolute -left-2 w-1.5 h-1.5 rounded-full bg-emerald-400/60 animate-ping" />
                {/* Planet Body */}
                <div className="w-4.5 h-4.5 rounded-full bg-gradient-to-tr from-emerald-600 via-teal-400 to-cyan-300 shadow-[0_0_10px_#10b981] border border-white flex items-center justify-center z-10">
                  <Bike className="w-2.5 h-2.5 text-slate-950 stroke-[2.5]" />
                </div>
                {/* Planet Proximity Badge */}
                <div className="absolute -bottom-3.5 px-1 py-0.2 rounded bg-slate-950/95 border border-emerald-400/60 text-[7px] font-mono font-black text-emerald-300 shadow-md whitespace-nowrap z-20">
                  Cap. Vikram • 350m
                </div>
              </div>
            </div>
          </div>

          {/* ======================================================== */}
          {/* CENTRAL STELLAR SUN (PASSENGER / PICKUP LOCATION) */}
          {/* ======================================================== */}
          <div className="relative z-30 flex items-center justify-center">
            {/* Solar Corona Heat Haze (Outer Pulse) */}
            <div
              className="absolute w-14 h-14 rounded-full bg-amber-500/25 pointer-events-none"
              style={{
                animation: 'solar-corona-pulse 2.8s ease-in-out infinite',
              }}
            />
            {/* Solar Flares Flare Ring */}
            <div
              className="absolute w-11 h-11 rounded-full bg-gradient-to-tr from-orange-500 via-amber-400 to-yellow-300 opacity-90 animate-spin pointer-events-none"
              style={{
                animationDuration: '10s',
                boxShadow: '0 0 25px #f59e0b, 0 0 45px #ea580c',
              }}
            />
            {/* Core Sun Body */}
            <div className="relative w-9 h-9 rounded-full bg-gradient-to-br from-yellow-200 via-amber-400 to-orange-600 border border-yellow-100 flex flex-col items-center justify-center shadow-lg cursor-default">
              <Sun className="w-4 h-4 text-slate-950 stroke-[2.5] animate-pulse" />
              <span className="text-[6.5px] font-black uppercase text-slate-950 font-mono tracking-tighter leading-none mt-0.5">
                YOU
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Live Searching Transmission Feedback & Radio Bars */}
      <div className="w-full max-w-sm flex flex-col items-center gap-2 px-3 mt-1">
        {/* Solar Radiation Equalizer */}
        <div className="flex items-center gap-1.5 py-1 px-3 rounded-full bg-amber-50 border border-amber-200 shadow-2xs">
          <span className="text-[10px] font-black uppercase text-amber-900 tracking-wide flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-600" />
            Solar Gravity Wave:
          </span>
          <div className="flex items-end gap-1 h-3 px-1">
            <span className="w-1 bg-amber-500 rounded-full animate-pulse" style={{ height: '80%', animationDuration: '0.5s' }} />
            <span className="w-1 bg-orange-500 rounded-full animate-pulse" style={{ height: '100%', animationDuration: '0.4s' }} />
            <span className="w-1 bg-yellow-500 rounded-full animate-pulse" style={{ height: '60%', animationDuration: '0.7s' }} />
            <span className="w-1 bg-amber-500 rounded-full animate-pulse" style={{ height: '90%', animationDuration: '0.6s' }} />
            <span className="w-1 bg-orange-600 rounded-full animate-pulse" style={{ height: '70%', animationDuration: '0.5s' }} />
          </div>
          <span className="text-[10px] font-mono-num font-black text-amber-700">
            {nearbyCaptainsCount} In Planetary Range
          </span>
        </div>

        {/* Informative Subtext */}
        <p className="text-xs text-slate-600 font-medium leading-relaxed max-w-xs">
          Broadcasting ride beacon across nearby orbital sectors. When a captain accepts or sends a counter-offer, their details will display with a <span className="text-slate-950 font-black">25-second timer</span>.
        </p>

        {/* Offered Fare Confirmation Badge if present */}
        {offeredFare !== undefined && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-950 font-black text-xs shadow-2xs">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Offered Fare: ₹{offeredFare}</span>
          </div>
        )}

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
