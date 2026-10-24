import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Square,
  Navigation,
  Clock,
  ShieldCheck,
  AlertTriangle,
  Zap,
  MapPin,
  Sparkles,
  Info,
  Tag,
  Compass,
  Activity,
  Pause,
} from 'lucide-react';
import { Ride, GPSSignalStatus, PricingSettings, GPSPoint } from '../types';
import { formatCurrency, formatDuration, calculateFare } from '../utils/distanceCalculator';
import { SpeedometerGauge } from './SpeedometerGauge';

interface ActiveRideMeterProps {
  ride: Ride;
  gpsStatus: GPSSignalStatus;
  pricingSettings: PricingSettings;
  currentSpeedKmh?: number;
  speedTrend?: 'increasing' | 'decreasing' | 'constant' | 'stopped';
  currentLocation?: GPSPoint | null;
  onPauseRide?: () => void;
  onResumeRide?: () => void;
  onStopRide: () => void;
  onSimulateStep?: (distanceMeters?: number) => void;
  isStopping: boolean;
}

export const ActiveRideMeter: React.FC<ActiveRideMeterProps> = ({
  ride,
  gpsStatus,
  pricingSettings,
  currentSpeedKmh = 0,
  speedTrend = 'stopped',
  currentLocation,
  onStopRide,
  onSimulateStep,
  isStopping,
}) => {
  const [showStopConfirm, setShowStopConfirm] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Smooth animated continuous distance & fare display
  const [displayDistanceKm, setDisplayDistanceKm] = useState(ride.total_distance_km);
  const targetDistanceRef = useRef(ride.total_distance_km);
  const displayDistanceRef = useRef(ride.total_distance_km);

  useEffect(() => {
    targetDistanceRef.current = ride.total_distance_km;
    // If target jumps significantly or resets, sync immediately
    if (Math.abs(displayDistanceRef.current - ride.total_distance_km) > 0.05 || ride.total_distance_km < displayDistanceRef.current) {
      displayDistanceRef.current = ride.total_distance_km;
      setDisplayDistanceKm(ride.total_distance_km);
    }
  }, [ride.total_distance_km]);

  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();

    const updateSmoothMeter = (now: number) => {
      const dt = Math.min(0.1, (now - lastTime) / 1000);
      lastTime = now;

      const target = targetDistanceRef.current;
      let current = displayDistanceRef.current;

      if (current < target) {
        const diff = target - current;
        const step = Math.max(0.001, diff * 15 * dt);
        current = Math.min(target, current + step);
      } else {
        current = target;
      }

      displayDistanceRef.current = current;
      setDisplayDistanceKm(current);

      animId = requestAnimationFrame(updateSmoothMeter);
    };

    animId = requestAnimationFrame(updateSmoothMeter);
    return () => cancelAnimationFrame(animId);
  }, []);

  const displayFareCalc = calculateFare(
    displayDistanceKm,
    ride.rate_per_km,
    ride.base_unlock_fee,
    ride.minimum_fare
  );

  // Live stopwatch counter
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (ride.status === 'STARTED') {
      const startTime = new Date(ride.start_time).getTime();
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startTime) / 1000)));

      interval = setInterval(() => {
        setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startTime) / 1000)));
      }, 1000);
    } else if (ride.duration_seconds > 0) {
      setElapsedSeconds(ride.duration_seconds);
    }
    return () => clearInterval(interval);
  }, [ride.status, ride.start_time, ride.duration_seconds]);

  const formattedStartTime = new Date(ride.start_time).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const isPaused = ride.status === 'PAUSED';

  return (
    <div
      id="active-ride-meter-container"
      className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-2xl shadow-slate-950/60 relative overflow-hidden"
    >
      {/* Background Ambient Glow */}
      <div
        className={`absolute -top-24 -right-24 w-60 h-60 rounded-full blur-3xl pointer-events-none transition-all duration-700 ${
          isPaused ? 'bg-amber-500/10' : 'bg-emerald-500/15'
        }`}
      />

      {/* Top Header: Status & Bike */}
      <div className="flex items-center justify-between gap-3 pb-4 border-b border-slate-800/80 relative z-10">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <div
              className={`w-3 h-3 rounded-full ${
                isPaused ? 'bg-amber-400' : 'bg-emerald-400'
              }`}
            />
            {!isPaused && (
              <div className="absolute inset-0 w-3 h-3 rounded-full bg-emerald-400 animate-ping opacity-75" />
            )}
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-extrabold uppercase tracking-wider text-slate-100 flex items-center gap-2">
              {isPaused ? 'Ride Paused' : 'Ride in Progress'}
              <span className="text-xs px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 font-mono-num font-normal">
                {ride.ride_id}
              </span>
            </h2>
            <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
              <span>{ride.bike_name}</span>
              <span>•</span>
              <span className="text-emerald-400">{ride.bike_type}</span>
            </p>
          </div>
        </div>

        {/* Status Pill */}
        <div className="flex items-center gap-2">
          <div
            className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border flex items-center gap-1.5 ${
              isPaused
                ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
            }`}
          >
            {isPaused ? (
              <>
                <Pause className="w-3 h-3 text-amber-400" />
                PAUSED
              </>
            ) : (
              <>
                <Zap className="w-3 h-3 text-emerald-400 fill-emerald-400" />
                STARTED
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main Meter Grid: Distance, Rate & Current Fare */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 py-5 my-1 relative z-10">
        {/* Primary Distance Meter */}
        <div
          id="meter-distance-box"
          className="md:col-span-6 bg-slate-950/70 border border-slate-800/80 rounded-xl p-4 sm:p-5 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1.5">
              <Navigation className="w-3.5 h-3.5 text-emerald-400" />
              Real-Time Distance Traveled
            </span>
            {isPaused ? (
              <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-bold uppercase">
                Meter Paused
              </span>
            ) : currentSpeedKmh >= 1.0 ? (
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold uppercase flex items-center gap-1 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                Vehicle Moving • Counting
              </span>
            ) : (
              <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800/80 text-rose-300 border border-rose-500/30 font-bold uppercase flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                Stopped • Distance Frozen
              </span>
            )}
          </div>

          <div className="my-1">
            <div className="flex items-baseline justify-between gap-2">
              <div className="flex items-baseline gap-2">
                <span
                  id="meter-distance-value"
                  className="text-4xl sm:text-5xl font-black tracking-tight text-white font-mono-num"
                >
                  {displayDistanceKm.toFixed(2)}
                </span>
                <span className="text-lg sm:text-xl font-bold text-slate-400">km</span>
                <span className="text-xs sm:text-sm text-emerald-400 font-mono-num ml-1 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  {Math.round(displayDistanceKm * 1000).toLocaleString()} m
                </span>
              </div>
              
              {onSimulateStep && !isPaused && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    id="btn-simulate-step-100m"
                    type="button"
                    onClick={() => onSimulateStep(100)}
                    className="px-2 py-1 rounded-md bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[11px] font-bold font-mono-num transition-all active:scale-95 cursor-pointer"
                    title="Simulate +100 meters (0.10 km GPS Movement)"
                  >
                    +100m
                  </button>
                  <button
                    id="btn-simulate-step-500m"
                    type="button"
                    onClick={() => onSimulateStep(500)}
                    className="px-2 py-1 rounded-md bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border border-teal-500/40 text-[11px] font-bold font-mono-num transition-all active:scale-95 cursor-pointer"
                    title="Simulate +500 meters (0.50 km GPS Movement)"
                  >
                    +500m
                  </button>
                  <button
                    id="btn-simulate-step-1000m"
                    type="button"
                    onClick={() => onSimulateStep(1000)}
                    className="px-2 py-1 rounded-md bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-[11px] font-bold font-mono-num transition-all active:scale-95 cursor-pointer"
                    title="Simulate +1,000 meters (1.00 km GPS Movement)"
                  >
                    +1,000m (1 km)
                  </button>
                </div>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {isPaused
                ? 'Ride is paused • Distance and fare locked'
                : currentSpeedKmh >= 1.0
                ? 'Live GPS tracking • Counting active movement (1 km = 1,000 meters)'
                : 'Vehicle stationary • Distance frozen (resumes automatically on movement)'}
            </p>
          </div>

          <div className="w-full bg-slate-800/60 rounded-full h-1.5 mt-3 overflow-hidden">
            <motion.div
              className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full"
              style={{
                width: `${Math.min(100, (displayDistanceKm / 10) * 100)}%`,
              }}
              transition={{ ease: 'easeOut', duration: 0.2 }}
            />
          </div>
        </div>

        {/* Rate & Current Fare Box */}
        <div
          id="meter-fare-box"
          className="md:col-span-6 bg-gradient-to-br from-slate-950/80 via-slate-900/90 to-emerald-950/30 border border-emerald-500/30 rounded-xl p-4 sm:p-5 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs uppercase font-bold tracking-wider text-emerald-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              Real-Time Distance Fare
            </span>
            <div className="flex items-center gap-1 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded text-xs font-semibold text-emerald-300 font-mono-num">
              Rate: {pricingSettings.currency_symbol}{ride.rate_per_km}/km
            </div>
          </div>

          <div className="my-1">
            <div className="flex items-baseline gap-1">
              <span
                id="meter-fare-value"
                className="text-4xl sm:text-5xl font-black tracking-tight text-emerald-400 font-mono-num"
              >
                {formatCurrency(displayFareCalc.totalFare, pricingSettings.currency_symbol)}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 font-mono-num">
              Distance Fare: {formatCurrency(displayFareCalc.distanceFare, pricingSettings.currency_symbol)} ({displayDistanceKm.toFixed(2)} km × {pricingSettings.currency_symbol}{ride.rate_per_km}/km)
            </p>
          </div>

          <div className="text-[11px] text-slate-400 flex items-center justify-between pt-2 border-t border-slate-800/80">
            <span>Strict Distance Calculation</span>
            <span className="text-emerald-400 font-medium">Real-time Apply</span>
          </div>
        </div>
      </div>

      {/* Real-time Moving Speedometer Dial (10, 20, 30... km/h) */}
      <div className="py-2 relative z-10">
        <SpeedometerGauge
          speedKmh={currentSpeedKmh}
          maxScale={pricingSettings.max_speed_kmh || 60}
          speedTrend={speedTrend}
          gpsStatus={gpsStatus}
          isPaused={isPaused}
        />
      </div>

      {/* Secondary Metrics: Start Time, Duration, Rate & GPS Accuracy */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-3 border-t border-slate-800/80 text-xs relative z-10">
        {/* Duration */}
        <div className="bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/60">
          <div className="text-slate-400 flex items-center gap-1.5 mb-1">
            <Clock className="w-3.5 h-3.5 text-teal-400" />
            <span>Trip Duration</span>
          </div>
          <span
            id="meter-duration-value"
            className="text-sm sm:text-base font-bold text-white font-mono-num"
          >
            {formatDuration(elapsedSeconds)}
          </span>
        </div>

        {/* Start Time */}
        <div className="bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/60">
          <div className="text-slate-400 flex items-center gap-1.5 mb-1">
            <MapPin className="w-3.5 h-3.5 text-indigo-400" />
            <span>Start Time</span>
          </div>
          <span className="text-sm sm:text-base font-bold text-white font-mono-num truncate block">
            {formattedStartTime}
          </span>
        </div>

        {/* Billing Rate */}
        <div className="bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/60">
          <div className="text-slate-400 flex items-center gap-1.5 mb-1">
            <Tag className="w-3.5 h-3.5 text-emerald-400" />
            <span>Billing Rate</span>
          </div>
          <div className="text-sm sm:text-base font-bold text-emerald-300 font-mono-num">
            {pricingSettings.currency_symbol}{ride.rate_per_km}
            <span className="text-xs text-slate-400 font-normal">/km</span>
          </div>
        </div>

        {/* GPS Status & Accuracy */}
        <div className="bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/60">
          <div className="text-slate-400 flex items-center gap-1.5 mb-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>GPS Accuracy</span>
          </div>
          <span className="text-sm font-bold text-emerald-300 flex items-center gap-1">
            {gpsStatus.quality}
            {(currentLocation?.accuracy || gpsStatus.accuracy) && (
              <span className="text-[10px] text-slate-300 font-mono-num font-semibold">
                (±{Math.round(currentLocation?.accuracy || gpsStatus.accuracy || 0)}m)
              </span>
            )}
          </span>
        </div>
      </div>

      {/* Live GPS Telemetry: Current Coordinates & Haversine Distance Rule */}
      <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/70 text-xs relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-slate-800 text-cyan-400 border border-slate-700/60">
            <Compass className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1.5">
              <span>Current GPS Location</span>
              {currentLocation ? (
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold">
                  LIVE FIX
                </span>
              ) : (
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-semibold">
                  ACQUIRING
                </span>
              )}
            </div>
            <div className="text-xs font-mono font-bold text-slate-200 mt-0.5">
              {currentLocation ? (
                <span>
                  {currentLocation.latitude.toFixed(5)}°, {currentLocation.longitude.toFixed(5)}°
                  {currentLocation.altitude ? ` (Alt: ${Math.round(currentLocation.altitude)}m)` : ''}
                </span>
              ) : (
                <span>Lat: {ride.start_latitude.toFixed(5)}°, Lng: {ride.start_longitude.toFixed(5)}°</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          {/* Motion Status */}
          <div className="text-right">
            <span
              className={`text-[10px] px-2.5 py-1 rounded-full font-extrabold uppercase tracking-wider border flex items-center gap-1.5 ${
                isPaused
                  ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                  : currentSpeedKmh >= 1.0
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 animate-pulse'
                  : 'bg-slate-800 text-rose-300 border-rose-500/30'
              }`}
            >
              {isPaused ? (
                <>
                  <Pause className="w-3 h-3" />
                  METER PAUSED
                </>
              ) : currentSpeedKmh >= 1.0 ? (
                <>
                  <Activity className="w-3 h-3 text-emerald-400" />
                  STATUS: MOVING
                </>
              ) : (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                  STATUS: STOPPED
                </>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Action Controls: Stop Ride */}
      <div className="pt-4 flex flex-col gap-2.5 relative z-10">
        {/* Stop Ride Button */}
        <button
          id="btn-stop-ride"
          type="button"
          onClick={() => setShowStopConfirm(true)}
          disabled={isStopping}
          className="w-full py-3.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-rose-600/30 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer tracking-wide"
        >
          <Square className="w-4 h-4 fill-current" />
          {isStopping ? 'COMPUTING FINAL BILL...' : 'STOP RIDE'}
        </button>
      </div>

      {/* Stop Ride Confirmation Modal */}
      <AnimatePresence>
        {showStopConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl relative"
            >
              <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mb-4 mx-auto">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-center text-white">
                End this bike ride?
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 text-center mt-2">
                This will finalize your GPS distance meter at{' '}
                <span className="font-bold text-white font-mono-num">
                  {ride.total_distance_km.toFixed(2)} km
                </span>{' '}
                and generate the final bill of{' '}
                <span className="font-bold text-emerald-400 font-mono-num">
                  {formatCurrency(ride.final_fare, pricingSettings.currency_symbol)}
                </span>
                .
              </p>

              <div className="mt-6 flex items-center gap-3">
                <button
                  id="btn-cancel-stop"
                  type="button"
                  onClick={() => setShowStopConfirm(false)}
                  className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-sm transition-all cursor-pointer"
                >
                  Continue Ride
                </button>
                <button
                  id="btn-confirm-stop"
                  type="button"
                  onClick={() => {
                    setShowStopConfirm(false);
                    onStopRide();
                  }}
                  className="flex-1 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm shadow-lg shadow-rose-600/30 transition-all cursor-pointer"
                >
                  Yes, Stop Ride
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
