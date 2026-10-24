import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import {
  CheckCircle2,
  Receipt,
  Download,
  Share2,
  Bike,
  Clock,
  Navigation,
  Gauge,
  MapPin,
  CreditCard,
  Sparkles,
  X,
  Printer,
  ShieldCheck,
} from 'lucide-react';
import { Ride, PricingSettings } from '../types';
import { formatCurrency, formatDuration } from '../utils/distanceCalculator';

interface RideReceiptModalProps {
  ride: Ride | null;
  pricingSettings: PricingSettings;
  isOpen: boolean;
  onClose: () => void;
  onPayRide?: (rideId: string) => void;
}

export const RideReceiptModal: React.FC<RideReceiptModalProps> = ({
  ride,
  pricingSettings,
  isOpen,
  onClose,
  onPayRide,
}) => {
  const [isPaid, setIsPaid] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  useEffect(() => {
    if (isOpen && ride) {
      setIsPaid(ride.payment_status === 'PAID');
      // Trigger subtle celebratory confetti
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#10b981', '#14b8a6', '#06b6d4', '#f59e0b'],
      });
    }
  }, [isOpen, ride]);

  if (!isOpen || !ride) return null;

  const formattedStart = new Date(ride.start_time).toLocaleString([], {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const formattedEnd = ride.end_time
    ? new Date(ride.end_time).toLocaleString([], {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : 'Completed';

  const handleSimulatePayment = () => {
    setIsProcessingPayment(true);
    setTimeout(() => {
      setIsProcessingPayment(false);
      setIsPaid(true);
      if (onPayRide) {
        onPayRide(ride.ride_id);
      }
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.7 },
      });
    }, 1000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl relative my-8"
        >
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 p-6 text-white text-center relative">
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-full bg-black/20 hover:bg-black/40 text-white/80 hover:text-white transition-all"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md text-white flex items-center justify-center mx-auto mb-3 border border-white/30 shadow-inner">
              <CheckCircle2 className="w-8 h-8 stroke-[2.5]" />
            </div>

            <span className="text-xs uppercase font-extrabold tracking-widest text-emerald-100 bg-emerald-950/40 px-3 py-1 rounded-full border border-emerald-400/30">
              RIDE COMPLETED
            </span>
            <h2 className="text-2xl font-black mt-2">Ride Receipt & Bill</h2>
            <p className="text-xs text-emerald-100/90 mt-1 font-mono-num">
              Invoice #{ride.ride_id} • Authoritative Backend Settlement
            </p>
          </div>

          {/* Body Content */}
          <div className="p-5 sm:p-6 space-y-5">
            {/* Prominent Hero Total Box */}
            <div className="bg-slate-950 border border-emerald-500/30 rounded-2xl p-4 text-center">
              <span className="text-xs uppercase font-bold tracking-wider text-slate-400">
                Total Amount Due
              </span>
              <div className="text-4xl sm:text-5xl font-black text-emerald-400 font-mono-num my-1">
                {formatCurrency(ride.final_fare, pricingSettings.currency_symbol)}
              </div>
              <div className="text-xs text-slate-400 flex items-center justify-center gap-2 flex-wrap">
                <span className="font-bold text-white font-mono-num">
                  {ride.total_distance_km.toFixed(2)} km
                </span>
                <span className="text-emerald-400/90 font-mono-num font-semibold">
                  ({Math.round(ride.total_distance_km * 1000).toLocaleString()} m)
                </span>
                <span>•</span>
                <span className="font-bold text-emerald-400 font-mono-num">
                  {pricingSettings.currency_symbol}{ride.rate_per_km}/km (1 km = 1,000m)
                </span>
              </div>
            </div>

            {/* Itemized Fare Breakdown */}
            <div className="bg-slate-950/60 rounded-xl p-4 border border-slate-800/80 text-xs space-y-2.5">
              <div className="font-bold text-slate-300 uppercase tracking-wider text-[11px] pb-1 border-b border-slate-800 flex items-center justify-between">
                <span>Fare Calculation Breakdown</span>
                <span className="text-emerald-400">Verified GPS Rate</span>
              </div>

              <div className="flex items-center justify-between text-slate-300">
                <span className="flex items-center gap-1.5">
                  <Navigation className="w-3.5 h-3.5 text-emerald-400" />
                  Distance Fare ({ride.total_distance_km.toFixed(2)} km × {pricingSettings.currency_symbol}{ride.rate_per_km}/km)
                </span>
                <span className="font-bold font-mono-num text-white">
                  {formatCurrency(ride.total_distance_km * ride.rate_per_km, pricingSettings.currency_symbol)}
                </span>
              </div>

              {ride.base_unlock_fee > 0 && (
                <div className="flex items-center justify-between text-slate-300">
                  <span>Base Unlock Fee</span>
                  <span className="font-bold font-mono-num text-white">
                    {formatCurrency(ride.base_unlock_fee, pricingSettings.currency_symbol)}
                  </span>
                </div>
              )}

              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between font-extrabold text-sm text-white">
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <Sparkles className="w-4 h-4" />
                  Final Total Fare
                </span>
                <span className="text-emerald-400 font-mono-num text-base">
                  {formatCurrency(ride.final_fare, pricingSettings.currency_symbol)}
                </span>
              </div>
            </div>

            {/* Ride Trip Metrics & Locations */}
            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div className="bg-slate-950/40 p-3 rounded-xl border border-slate-800/60">
                <span className="text-slate-400 flex items-center gap-1 mb-1">
                  <Clock className="w-3.5 h-3.5 text-teal-400" />
                  Duration
                </span>
                <span className="font-bold text-white font-mono-num text-sm">
                  {formatDuration(ride.duration_seconds)}
                </span>
              </div>

              <div className="bg-slate-950/40 p-3 rounded-xl border border-slate-800/60">
                <span className="text-slate-400 flex items-center gap-1 mb-1">
                  <Gauge className="w-3.5 h-3.5 text-cyan-400" />
                  Avg Speed
                </span>
                <span className="font-bold text-white font-mono-num text-sm">
                  {ride.avg_speed_kmh.toFixed(1)} km/h
                </span>
              </div>

              <div className="bg-slate-950/40 p-3 rounded-xl border border-slate-800/60 col-span-2">
                <span className="text-slate-400 flex items-center gap-1 mb-1">
                  <Bike className="w-3.5 h-3.5 text-emerald-400" />
                  Vehicle
                </span>
                <span className="font-bold text-white text-xs">
                  {ride.bike_name} ({ride.bike_type}) • {ride.bike_id}
                </span>
              </div>

              <div className="bg-slate-950/40 p-3 rounded-xl border border-slate-800/60 col-span-2 space-y-2">
                <div className="flex items-start gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase font-semibold">Started at {formattedStart}</div>
                    <div className="text-xs text-slate-200 truncate max-w-[340px]">
                      {ride.start_address || `${ride.start_latitude.toFixed(4)}, ${ride.start_longitude.toFixed(4)}`}
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-2 pt-1 border-t border-slate-800/50">
                  <span className="w-2 h-2 rounded-full bg-rose-500 mt-1.5 shrink-0" />
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase font-semibold">Ended at {formattedEnd}</div>
                    <div className="text-xs text-slate-200 truncate max-w-[340px]">
                      {ride.end_address || `${ride.end_latitude ? ride.end_latitude.toFixed(4) : 'Destination'}, ${ride.end_longitude ? ride.end_longitude.toFixed(4) : ''}`}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Payment / Action Section */}
            <div className="space-y-2 pt-2">
              {isPaid ? (
                <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-emerald-300 font-bold">
                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                    <span>Payment Received via UPI / Wallet</span>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-emerald-500 text-slate-950 font-black text-[10px]">
                    PAID
                  </span>
                </div>
              ) : (
                <button
                  id="btn-pay-fare"
                  onClick={handleSimulatePayment}
                  disabled={isProcessingPayment}
                  className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-sm uppercase flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 transition-all"
                >
                  <CreditCard className="w-4 h-4" />
                  {isProcessingPayment
                    ? 'Processing Payment...'
                    : `Pay ${formatCurrency(ride.final_fare, pricingSettings.currency_symbol)} Now`}
                </button>
              )}

              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrint}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs flex items-center justify-center gap-1.5 transition-all border border-slate-700"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print Receipt
                </button>

                <button
                  onClick={onClose}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 font-semibold text-xs flex items-center justify-center gap-1.5 transition-all"
                >
                  Close & New Ride
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
