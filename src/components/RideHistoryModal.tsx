import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  History,
  X,
  Bike,
  Navigation,
  Clock,
  Receipt,
  MapPin,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { Ride, PricingSettings } from '../types';
import { formatCurrency, formatDuration } from '../utils/distanceCalculator';

interface RideHistoryModalProps {
  rides: Ride[];
  pricingSettings: PricingSettings;
  isOpen: boolean;
  onClose: () => void;
  onSelectRide: (ride: Ride) => void;
}

export const RideHistoryModal: React.FC<RideHistoryModalProps> = ({
  rides,
  pricingSettings,
  isOpen,
  onClose,
  onSelectRide,
}) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl relative my-6"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-slate-800/80 bg-slate-950/40">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-teal-500/20 text-teal-400">
                <History className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Ride History</h3>
                <p className="text-xs text-slate-400">
                  {rides.length} recorded trip{rides.length !== 1 ? 's' : ''} with verified GPS billing
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Rides List */}
          <div className="p-5 max-h-[65vh] overflow-y-auto space-y-3">
            {rides.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <Bike className="w-12 h-12 mx-auto mb-2 text-slate-600 stroke-[1.5]" />
                <p className="text-sm font-medium">No rides recorded yet</p>
                <p className="text-xs text-slate-500 mt-1">
                  Start your first ride to see live per-km tracking here.
                </p>
              </div>
            ) : (
              rides.map((ride) => {
                const dateStr = new Date(ride.start_time).toLocaleDateString([], {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <div
                    key={ride.ride_id}
                    id={`ride-item-${ride.ride_id}`}
                    onClick={() => onSelectRide(ride)}
                    className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-emerald-500/50 hover:bg-slate-800/30 transition-all cursor-pointer group flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-2.5 rounded-xl bg-slate-800 group-hover:bg-emerald-500/20 text-slate-300 group-hover:text-emerald-400 transition-colors shrink-0 mt-0.5">
                        <Bike className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white">
                            {ride.bike_name}
                          </span>
                          <span className="text-[10px] font-mono-num px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                            {ride.ride_id}
                          </span>
                          <span className="text-[10px] uppercase font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                            {ride.status}
                          </span>
                        </div>

                        <div className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                          <span>{dateStr}</span>
                          <span>•</span>
                          <span className="flex items-center gap-1 font-mono-num">
                            <Clock className="w-3 h-3 text-slate-500" />
                            {formatDuration(ride.duration_seconds)}
                          </span>
                        </div>

                        {ride.start_address && (
                          <div className="text-xs text-slate-400 mt-1 flex items-center gap-1 truncate max-w-[280px] sm:max-w-[340px]">
                            <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                            <span className="truncate">{ride.start_address}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-800/60">
                      <div className="text-left sm:text-right">
                        <div className="text-base font-black text-emerald-400 font-mono-num">
                          {formatCurrency(ride.final_fare, pricingSettings.currency_symbol)}
                        </div>
                        <div className="text-xs text-slate-400 font-mono-num">
                          {ride.total_distance_km.toFixed(2)} km @ {pricingSettings.currency_symbol}{ride.rate_per_km}/km
                        </div>
                      </div>

                      <div className="p-2 rounded-lg bg-slate-800/80 group-hover:bg-emerald-500 group-hover:text-slate-950 text-slate-400 transition-all">
                        <ChevronRight className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
