import React, { useState } from 'react';
import { Star, CheckCircle2, ThumbsUp, Sparkles, MapPin, IndianRupee, ShieldCheck, Heart, User, Bike, Car, Navigation, X } from 'lucide-react';
import { MotorideRide } from '../types/motoride';

interface PassengerCaptainRatingModalProps {
  ride: MotorideRide;
  isSubmitting?: boolean;
  onSubmit: (score: number, review: string, tags: string[]) => void;
  onSkip: () => void;
}

const CAPTAIN_COMPLIMENT_TAGS = [
  'Smooth & safe driving 🛵',
  'Polite & respectful 🤝',
  'On time at pickup ⏱️',
  'Clean vehicle ✨',
  'Great navigation & route 🗺️',
  'Fair & transparent fare 💵',
];

export const PassengerCaptainRatingModal: React.FC<PassengerCaptainRatingModalProps> = ({
  ride,
  isSubmitting = false,
  onSubmit,
  onSkip,
}) => {
  const [score, setScore] = useState<number>(5);
  const [hoverScore, setHoverScore] = useState<number | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [reviewText, setReviewText] = useState<string>('');

  const captainName = ride.captain_name || 'Captain';
  const farePaid = ride.final_fare || ride.offered_fare || ride.estimated_fare || 0;
  const distanceKm = ride.distance_km || 1.4;

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const getRatingLabel = (stars: number) => {
    switch (stars) {
      case 5:
        return 'Outstanding Captain! ⭐⭐⭐⭐⭐';
      case 4:
        return 'Great Ride Experience ⭐⭐⭐⭐';
      case 3:
        return 'Good / Average Ride ⭐⭐⭐';
      case 2:
        return 'Below Expectations ⭐⭐';
      case 1:
        return 'Needs Improvement ⭐';
      default:
        return 'Rate Captain';
    }
  };

  const currentDisplayScore = hoverScore ?? score;

  return (
    <div className="fixed inset-0 z-[3000] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm select-none animate-in fade-in duration-200">
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
                How was your ride with {captainName}?
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-xl border border-slate-200">
              #{ride.ride_code}
            </span>
            <button
              type="button"
              onClick={onSkip}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
              title="Close rating modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Captain & Vehicle Card */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-slate-200 border-2 border-emerald-500 flex items-center justify-center text-slate-700 font-bold text-base shadow-xs relative overflow-hidden">
                {(ride as any).captain_avatar || (ride as any).avatar_url ? (
                  <img
                    src={(ride as any).captain_avatar || (ride as any).avatar_url}
                    alt={captainName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-6 h-6 text-slate-600" />
                )}
              </div>
              <div>
                <h4 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                  <span>{captainName}</span>
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-900 text-[10px] font-bold border border-amber-200">
                    <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
                    4.9
                  </span>
                </h4>
                <p className="text-[11px] text-slate-600 font-medium">
                  {ride.vehicle_model || 'Motoride Vehicle'} • {ride.plate_number || 'TN 01 AB 1234'}
                </p>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
                Final Fare
              </span>
              <span className="text-lg font-black font-mono text-emerald-600">
                ₹{farePaid}
              </span>
            </div>
          </div>

          {/* Route Summary */}
          <div className="text-[11px] text-slate-700 bg-white p-2.5 rounded-xl border border-slate-200 flex items-center justify-between shadow-2xs">
            <div className="flex items-center gap-1.5 truncate pr-2">
              <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="truncate font-medium">{ride.dropoff_address || 'Destination Reached'}</span>
            </div>
            <span className="font-mono font-bold text-slate-600 shrink-0">
              {distanceKm} km
            </span>
          </div>
        </div>

        {/* Star Rating Section */}
        <div className="flex flex-col items-center gap-2 py-2">
          <span className="text-xs font-bold text-slate-700">
            Tap to rate your captain:
          </span>

          <div className="flex items-center gap-2 sm:gap-3">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onMouseEnter={() => setHoverScore(star)}
                onMouseLeave={() => setHoverScore(null)}
                onClick={() => setScore(star)}
                className="p-1.5 rounded-xl transition-all hover:scale-110 active:scale-95 cursor-pointer focus:outline-none"
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

        {/* Written Review Input */}
        <div className="flex flex-col gap-1.5">
          <input
            type="text"
            value={reviewText}
            onChange={(e) => setReviewText(e.target.value)}
            placeholder="Write feedback for your captain (optional)..."
            className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white text-xs text-slate-900 placeholder-slate-400 focus:outline-none transition-all shadow-2xs"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2 pt-2 border-t border-slate-200">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => onSubmit(score, reviewText, selectedTags)}
            className="w-full py-3.5 rounded-2xl bg-black hover:bg-slate-900 active:scale-98 disabled:opacity-50 text-white font-black text-xs uppercase tracking-wider shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2 border border-black"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Submitting Feedback...
              </span>
            ) : (
              <>
                <Star className="w-4 h-4 fill-white text-white" />
                <span>Submit Rating & Done</span>
              </>
            )}
          </button>

          <button
            type="button"
            disabled={isSubmitting}
            onClick={onSkip}
            className="w-full py-2.5 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 text-xs font-semibold cursor-pointer transition-colors text-center disabled:opacity-50"
          >
            Skip & Done
          </button>
        </div>

      </div>
    </div>
  );
};
