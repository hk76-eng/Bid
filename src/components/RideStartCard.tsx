import React from 'react';
import { Play, ShieldAlert, Sparkles, Check, Bike } from 'lucide-react';
import { BikeInfo, GPSSignalStatus, PricingSettings } from '../types';
import { formatCurrency } from '../utils/distanceCalculator';

interface RideStartCardProps {
  bikes?: BikeInfo[];
  selectedBikeId?: string;
  onSelectBike?: (bikeId: string) => void;
  pricingSettings: PricingSettings;
  gpsStatus: GPSSignalStatus;
  onRequestGPSPermission: () => void;
  onStartRide: (passengerName?: string, selectedBike?: BikeInfo) => void;
  isStarting: boolean;
}

export const RideStartCard: React.FC<RideStartCardProps> = ({
  bikes,
  selectedBikeId,
  pricingSettings,
  gpsStatus,
  onRequestGPSPermission,
  onStartRide,
  isStarting,
}) => {
  const availableBikes = bikes && bikes.length > 0 ? bikes : [];
  const selectedBike = availableBikes.find((b) => b.id === selectedBikeId) || availableBikes[0];
  const bikeName = selectedBike?.name || (selectedBike as any)?.model || 'Motorcycle';
  const bikeReg = selectedBike?.qr_code || (selectedBike as any)?.plate_number || selectedBike?.id || 'GPS-Enabled';

  return (
    <div
      id="ride-start-card"
      className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-2xl relative overflow-hidden"
    >
      {/* Glow Effect */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between gap-3 pb-4 border-b border-slate-800/80 mb-5">
        <div>
          <h2 className="text-lg sm:text-xl font-extrabold text-white flex items-center gap-2">
            <span>Unlock & Ride</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-medium">
              GPS Metered
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Transparent per-kilometer pricing • Pay only for the distance you travel
          </p>
        </div>

        {/* Current Rate Callout */}
        <div className="text-right bg-slate-950/70 border border-slate-800 px-3 py-1.5 rounded-xl">
          <div className="text-[10px] uppercase font-bold text-slate-400">Current Rate</div>
          <div className="text-base font-black text-emerald-400 font-mono-num">
            {formatCurrency(pricingSettings.rate_per_km, pricingSettings.currency_symbol)}
            <span className="text-xs text-slate-400 font-normal">/km</span>
          </div>
        </div>
      </div>

      {/* Vehicle Info Tab / Card */}
      <div className="mb-5 p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            <Bike className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400">Vehicle</div>
            <div className="text-sm font-bold text-white flex items-center gap-2">
              <span>{bikeName}</span>
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              Registration: <span className="font-mono text-emerald-400 font-semibold">{bikeReg}</span>
            </div>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[10px] px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold uppercase tracking-wide">
            Available
          </span>
        </div>
      </div>

      {/* GPS Permission Warning if denied */}
      {gpsStatus.quality === 'DENIED' && (
        <div className="mb-4 p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
            <span>GPS location access is blocked. Please enable browser location permissions.</span>
          </div>
          <button
            onClick={onRequestGPSPermission}
            className="px-2.5 py-1 rounded bg-rose-600 text-white font-bold hover:bg-rose-500 shrink-0"
          >
            Enable
          </button>
        </div>
      )}

      {/* Primary [ START RIDE ] Button */}
      <button
        id="btn-start-ride"
        type="button"
        onClick={() => onStartRide(undefined, selectedBike)}
        disabled={isStarting}
        className="w-full py-4 px-6 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-base sm:text-lg tracking-wide uppercase flex items-center justify-center gap-3 shadow-xl shadow-emerald-500/25 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
      >
        <Play className="w-5 h-5 fill-current" />
        {isStarting ? 'ACQUIRING GPS & STARTING...' : 'START RIDE'}
      </button>

      <div className="mt-3 flex items-center justify-center gap-4 text-[11px] text-slate-400">
        <span className="flex items-center gap-1">
          <Check className="w-3 h-3 text-emerald-400" />
          No distance counted before starting
        </span>
        <span>•</span>
        <span className="flex items-center gap-1">
          <Check className="w-3 h-3 text-emerald-400" />
          Tamper-proof Server Billing
        </span>
      </div>
    </div>
  );
};
