import React, { useId } from 'react';
import { Gauge, Zap, TrendingUp, TrendingDown, Minus, Play, Pause, Activity } from 'lucide-react';
import { GPSSignalStatus } from '../types';

interface SpeedometerGaugeProps {
  speedKmh: number;
  maxScale?: number;
  speedTrend?: 'increasing' | 'decreasing' | 'constant' | 'stopped';
  gpsStatus?: GPSSignalStatus;
  isPaused?: boolean;
}

export const SpeedometerGauge: React.FC<SpeedometerGaugeProps> = ({
  speedKmh,
  maxScale = 60,
  speedTrend = 'stopped',
  gpsStatus,
  isPaused = false,
}) => {
  const gradientId = useId();
  const glowFilterId = useId();

  // Clamp speed for gauge needle
  const clampedSpeed = Math.max(0, Math.min(speedKmh, maxScale));

  // Gauge angle sweep: from -135deg (0 km/h) to +135deg (maxScale km/h)
  const minAngle = -135;
  const maxAngle = 135;
  const angleSweep = maxAngle - minAngle; // 270 degrees total
  const needleAngle = minAngle + (clampedSpeed / maxScale) * angleSweep;

  // Generate tick marks (0, 10, 20, 30, 40, 50, 60...)
  const tickStep = maxScale <= 60 ? 10 : 20;
  const ticks: { value: number; angle: number; isMajor: boolean }[] = [];

  for (let val = 0; val <= maxScale; val += tickStep / 2) {
    const isMajor = val % tickStep === 0;
    const angle = minAngle + (val / maxScale) * angleSweep;
    ticks.push({ value: val, angle, isMajor });
  }

  // Moving vs Stopped state (stopped when speed < 1.0 km/h)
  const isMoving = !isPaused && speedKmh >= 1.0;

  return (
    <div className="w-full bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 border border-slate-800/90 rounded-2xl p-4 sm:p-5 shadow-2xl relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header bar */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-slate-800/80 border border-slate-700 text-cyan-400">
            <Gauge className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-1.5">
              <span>Real-Time Speedometer</span>
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-bold">
                GPS LIVE
              </span>
            </h4>
            <p className="text-[10px] text-slate-400">Motorcycle & Vehicle Velocity Gauge</p>
          </div>
        </div>

        {/* Moving / Stopped / Paused Badge */}
        <div>
          {isPaused ? (
            <span className="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-extrabold uppercase tracking-wide flex items-center gap-1">
              <Pause className="w-3 h-3 fill-current" />
              PAUSED
            </span>
          ) : isMoving ? (
            <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-extrabold uppercase tracking-wide flex items-center gap-1.5 animate-pulse shadow-sm shadow-emerald-500/30">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              MOVING
            </span>
          ) : (
            <span className="px-2.5 py-1 rounded-full bg-slate-800 text-rose-400 border border-rose-500/30 text-[10px] font-extrabold uppercase tracking-wide flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
              STOPPED (0.0)
            </span>
          )}
        </div>
      </div>

      {/* Main Speedometer Gauge Dial (SVG) */}
      <div className="relative flex flex-col items-center justify-center my-1">
        <div className="w-56 h-56 sm:w-64 sm:h-64 relative flex items-center justify-center">
          <svg className="w-full h-full" viewBox="0 0 240 240">
            <defs>
              <linearGradient id={gradientId} x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#10b981" />
                <stop offset="60%" stopColor="#06b6d4" />
                <stop offset="100%" stopColor="#f43f5e" />
              </linearGradient>

              <filter id={glowFilterId} x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Gauge Outer Ring */}
            <circle
              cx="120"
              cy="120"
              r="104"
              fill="none"
              stroke="#1e293b"
              strokeWidth="2"
              strokeDasharray="4 4"
            />

            {/* Gauge Track Arc (Background 270deg) */}
            <path
              d="M 46.46 193.54 A 104 104 0 1 1 193.54 193.54"
              fill="none"
              stroke="#0f172a"
              strokeWidth="14"
              strokeLinecap="round"
            />

            {/* Active Speed Arc (Glow gradient) */}
            <path
              d="M 46.46 193.54 A 104 104 0 1 1 193.54 193.54"
              fill="none"
              stroke={`url(#${gradientId})`}
              strokeWidth="14"
              strokeLinecap="round"
              strokeDasharray="489.8"
              strokeDashoffset={489.8 - (489.8 * (clampedSpeed / maxScale))}
              filter={`url(#${glowFilterId})`}
              className="transition-all duration-300 ease-out"
            />

            {/* Scale Ticks & Numbers */}
            {ticks.map((t, i) => {
              const rad = (t.angle * Math.PI) / 180;
              const rInner = t.isMajor ? 82 : 88;
              const rOuter = 94;
              const rText = 70;

              const x1 = 120 + rInner * Math.sin(rad);
              const y1 = 120 - rInner * Math.cos(rad);
              const x2 = 120 + rOuter * Math.sin(rad);
              const y2 = 120 - rOuter * Math.cos(rad);

              const tx = 120 + rText * Math.sin(rad);
              const ty = 120 - rText * Math.cos(rad);

              return (
                <g key={i}>
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={t.isMajor ? '#cbd5e1' : '#475569'}
                    strokeWidth={t.isMajor ? '2.5' : '1.5'}
                    strokeLinecap="round"
                  />
                  {t.isMajor && (
                    <text
                      x={tx}
                      y={ty + 4}
                      fill="#94a3b8"
                      fontSize="10"
                      fontWeight="bold"
                      textAnchor="middle"
                      fontFamily="monospace"
                    >
                      {t.value}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Needle Pivot Center Background */}
            <circle cx="120" cy="120" r="16" fill="#020617" stroke="#334155" strokeWidth="3" />
            <circle cx="120" cy="120" r="8" fill="#10b981" />

            {/* Speed Needle */}
            <g
              transform={`rotate(${needleAngle}, 120, 120)`}
              className="transition-transform duration-300 ease-out origin-center"
            >
              {/* Needle Blade */}
              <polygon
                points="117,120 120,24 123,120 120,132"
                fill="#f43f5e"
                filter={`url(#${glowFilterId})`}
              />
              <circle cx="120" cy="28" r="2.5" fill="#ffffff" />
            </g>
          </svg>

          {/* Central Digital Readout Box */}
          <div className="absolute top-[56%] left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
            <div className="text-3xl sm:text-4xl font-black font-mono-num tracking-tight text-white flex items-baseline justify-center gap-0.5 drop-shadow-md">
              <span>{isPaused ? '0.0' : speedKmh.toFixed(1)}</span>
            </div>
            <div className="text-[10px] font-extrabold uppercase tracking-widest text-cyan-400 mt-0.5">
              KM / H
            </div>

            {/* Speed Trend Indicator */}
            {!isPaused && (
              <div className="mt-1 flex items-center justify-center gap-1 text-[10px] font-semibold">
                {speedTrend === 'increasing' && (
                  <span className="text-emerald-400 flex items-center gap-0.5">
                    <TrendingUp className="w-3 h-3" /> Accelerating
                  </span>
                )}
                {speedTrend === 'decreasing' && (
                  <span className="text-amber-400 flex items-center gap-0.5">
                    <TrendingDown className="w-3 h-3" /> Decelerating
                  </span>
                )}
                {speedTrend === 'constant' && (
                  <span className="text-cyan-300 flex items-center gap-0.5">
                    <Minus className="w-3 h-3" /> Steady Cruise
                  </span>
                )}
                {speedTrend === 'stopped' && (
                  <span className="text-slate-500 flex items-center gap-0.5">
                    <Activity className="w-3 h-3" /> Stationary
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
