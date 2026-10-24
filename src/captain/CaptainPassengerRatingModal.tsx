import React, { useState } from 'react';
import { Star, CheckCircle2, ThumbsUp, Sparkles, MapPin, IndianRupee, ShieldCheck, Heart, User, X } from 'lucide-react';
import { MotorideRide } from '../types/motoride';

interface CaptainPassengerRatingModalProps {
  ride: MotorideRide;
  captainName?: string;
  isSubmitting?: boolean;
  onSubmit: (score: number, review: string, tags: string[]) => void;
  onSkip: () => void;
  onClose?: () => void;
}

const PASSENGER_COMPLIMENT_TAGS = [
  'Polite & respectful 👍',
  'Ready on time at pickup ⏱️',
  'Easy to find 📍',
  'Great communication 💬',
  'Clean & cooperative ✨',
  'Prompt payment 💵',
];

export const CaptainPassengerRatingModal: React.FC<CaptainPassengerRatingModalProps> = ({
  ride,
  captainName,
  isSubmitting = false,
  onSubmit,
  onSkip,
  onClose,
}) => {
  const [score, setScore] = useState<number>(5);
  const [hoverScore, setHoverScore] = useState<number | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [reviewText, setReviewText] = useState<string>('');

  const passengerName = ride.passenger_name || 'Passenger';
  const fareEarned = Number(ride.final_fare || (ride as any).accepted_fare || (ride as any).agreed_fare || (ride as any).fare_amount || ride.offered_fare || ride.estimated_fare || 0);
  const distanceKm = ride.distance_km || 1.4;

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const getRatingLabel = (stars: number) => {
    switch (stars) {
      case 5:
        return 'Excellent Passenger ⭐⭐⭐⭐⭐';
      case 4:
        return 'Great Experience ⭐⭐⭐⭐';
      case 3:
        return 'Good / Average ⭐⭐⭐';
      case 2:
        return 'Below Average ⭐⭐';
      case 1:
        return 'Needs Improvement ⭐';
      default:
        return 'Rate Passenger';
    }
  };

  const currentDisplayScore = hoverScore ?? score;

  const handleDismiss = () => {
    if (onClose) {
      onClose();
    } else {
      onSkip();
    }
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleDismiss();
        }
      }}
      className="fixed inset-0 z-[3000] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm select-none animate-in fade-in duration-200"
    >
      <div className="w-full max-w-lg bg-white border border-slate-200 rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 text-slate-900 shadow-2xl flex flex-col gap-4 max-h-[92vh] overflow-y-auto scrollbar-thin animate-in slide-in-from-bottom-4 duration-200">
        
        {/* Header Celebration Banner */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center shadow-xs">
              <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 tracking-tight">
                Trip Completed! 🎉
              </h3>
              <p className="text-[11px] text-emerald-700 font-bold uppercase tracking-wider">
                Rate Passenger & Finish Ride
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-xl border border-slate-200">
              #{ride.ride_code}
            </span>
            <button
              type="button"
              onClick={handleDismiss}
              className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-all cursor-pointer"
              title="Close & Return to Live Requests"
              aria-label="Close"
            >
              <X className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>
        </div>

        {/* Trip Summary Card */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-slate-200 border-2 border-emerald-500 flex items-center justify-center text-slate-700 font-bold text-base shadow-xs">
                <User className="w-6 h-6 text-slate-600" />
              </div>
              <div>
                <h4 className="text-sm font-black text-slate-900">{passengerName}</h4>
                <p className="text-[11px] text-slate-500 font-medium">Passenger</p>
              </div>
            </div>

            {/* Total Fare Badge */}
            <div className="text-right">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
                Total Ride Fare
              </span>
              <span className="text-xl font-black font-mono text-slate-900">
                ₹{fareEarned.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Tripwise 10% Commission Deduction Breakdown */}
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs font-bold text-amber-900">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-amber-600" />
                <span>10% Platform Commission Deduction</span>
              </span>
              <span className="font-mono text-rose-600 font-black">
                -₹{(fareEarned * 0.10).toFixed(2)}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-amber-500/20 text-[11px]">
              <div>
                <span className="text-[10px] text-slate-600 uppercase font-semibold block">Deducted From</span>
                <span className="font-bold text-slate-800">Captain Wallet</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-emerald-800 uppercase font-semibold block">Net Driver Take-Home</span>
                <span className="font-mono font-black text-emerald-700 text-sm">
                  +₹{(fareEarned * 0.90).toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Route Summary */}
          <div className="text-[11px] text-slate-700 bg-white p-2.5 rounded-xl border border-slate-200 flex items-center justify-between shadow-2xs">
            <div className="flex items-center gap-1.5 truncate pr-2">
              <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="truncate font-medium">{ride.dropoff_address || 'Destination Reached'}</span>
            </div>
            <span className="font-mono font-bold text-slate-600 shrink-0">
              {distanceKm.toFixed(1)} km
            </span>
          </div>
        </div>

        {/* Star Rating Section */}
        <div className="flex flex-col items-center gap-2 py-2">
          <span className="text-xs font-bold text-slate-700">
            How was your trip with {passengerName}?
          </span>

          <div className="flex items-center gap-2.5 my-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                type="button"
                key={star}
                onClick={() => setScore(star)}
                onMouseEnter={() => setHoverScore(star)}
                onMouseLeave={() => setHoverScore(null)}
                className="p-1.5 cursor-pointer transition-transform hover:scale-125 active:scale-95 focus:outline-none"
                title={`${star} Star Rating`}
              >
                <Star
                  className={`w-9 h-9 transition-colors ${
                    star <= currentDisplayScore
                      ? 'fill-amber-400 text-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.5)]'
                      : 'text-slate-300 hover:text-slate-400'
                  }`}
                />
              </button>
            ))}
          </div>

          <span className="text-xs font-mono font-bold text-amber-900 bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
            {getRatingLabel(currentDisplayScore)}
          </span>
        </div>

        {/* Optional Review Text */}
        <div className="flex flex-col gap-1.5">
          <input
            type="text"
            value={reviewText}
            onChange={(e) => setReviewText(e.target.value)}
            placeholder="Write a note about passenger (e.g. Great rider, on time)..."
            className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white text-xs text-slate-900 placeholder-slate-400 focus:outline-none transition-all shadow-2xs"
          />
        </div>

        {/* Finish Ride Action Buttons */}
        <div className="flex flex-col gap-2 pt-2 border-t border-slate-200">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => onSubmit(score, reviewText, selectedTags)}
            style={{ backgroundColor: '#ba1e23' }}
            className="w-full py-3.5 rounded-2xl hover:opacity-90 active:scale-98 disabled:opacity-50 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-rose-900/20 transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                Completing Ride...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                Submit Rating & Finish Ride
              </span>
            )}
          </button>

          <button
            type="button"
            disabled={isSubmitting}
            onClick={onSkip}
            className="w-full py-2.5 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 text-xs font-semibold cursor-pointer transition-colors text-center disabled:opacity-50"
          >
            Skip Rating & Finish Ride
          </button>
        </div>

      </div>
    </div>
  );
};
