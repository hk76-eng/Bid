import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bike, X, ShieldCheck, Radio, CheckCircle } from 'lucide-react';
import { BikeInfo, PricingSettings } from '../types';
import { formatCurrency } from '../utils/distanceCalculator';
import { safeStorage } from '../lib/safeStorage';

interface VehicleModalProps {
  vehicle?: BikeInfo;
  pricingSettings: PricingSettings;
  isOpen: boolean;
  onClose: () => void;
}

export const VehicleModal: React.FC<VehicleModalProps> = ({
  vehicle,
  pricingSettings,
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  const savedModel = safeStorage.getItem('motoride_captain_vehicle_model');
  const savedPlate = safeStorage.getItem('motoride_captain_plate');

  const modelName = vehicle?.name || (vehicle as any)?.model || (savedModel && savedModel.trim() ? savedModel : 'Motorcycle');
  const regNumber = vehicle?.id || vehicle?.qr_code || (vehicle as any)?.plate_number || (savedPlate && savedPlate.trim() ? savedPlate : 'N/A');

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl relative my-6"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-slate-800/80 bg-slate-950/60">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <Bike className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-white">Vehicle Details</h3>
                <p className="text-xs text-slate-400">
                  Assigned fleet vehicle specifications & telemetry
                </p>
              </div>
            </div>
            <button
              id="btn-close-vehicle-modal"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Vehicle Card Content */}
          <div className="p-5 space-y-4">
            {/* Primary Vehicle Hero Card */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 relative overflow-hidden">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-500/30">
                    Active Vehicle
                  </span>
                  <h4 className="text-base sm:text-lg font-black text-white mt-1.5">
                    {modelName} {regNumber !== 'N/A' ? `(${regNumber})` : ''}
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Model: <span className="text-slate-200 font-semibold">{modelName}</span>
                  </p>
                </div>

                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                  Ready
                </span>
              </div>

              {/* Grid of specs */}
              <div className="grid grid-cols-2 gap-2.5 mt-4 pt-3 border-t border-slate-800/80">
                <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800/60">
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Registration No.</div>
                  <div className="text-sm font-black text-emerald-400 font-mono mt-0.5">
                    {regNumber}
                  </div>
                </div>

                <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800/60">
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Vehicle Type</div>
                  <div className="text-sm font-bold text-white mt-0.5">
                    {vehicle?.type || 'Motorcycle'}
                  </div>
                </div>

                <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800/60">
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Billing Rate</div>
                  <div className="text-sm font-black text-white font-mono mt-0.5">
                    {formatCurrency(pricingSettings.rate_per_km, pricingSettings.currency_symbol)}/km
                  </div>
                </div>

                <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800/60">
                  <div className="text-[10px] text-slate-400 uppercase font-bold">GPS Hardware</div>
                  <div className="text-xs font-bold text-emerald-300 flex items-center gap-1 mt-1">
                    <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
                    Synchronized
                  </div>
                </div>
              </div>
            </div>

            {/* Telemetry info */}
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-400 flex items-center gap-3">
              <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>
                All trips on <strong className="text-slate-200">{modelName}</strong> are measured using high-precision GPS distance calculation with real-time tamper protection.
              </span>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex justify-end">
            <button
              id="btn-close-vehicle-footer"
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
