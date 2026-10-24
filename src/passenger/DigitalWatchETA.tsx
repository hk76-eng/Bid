import React, { useState, useEffect } from 'react';
import { MotorideRide } from '../types/motoride';

interface DigitalWatchETAProps {
  ride: MotorideRide;
  captainLat?: number | null;
  captainLng?: number | null;
  variant?: 'card-header' | 'floating-top';
  onExpandCard?: () => void;
}

export const DigitalWatchETA: React.FC<DigitalWatchETAProps> = ({
  ride,
  variant = 'card-header',
  onExpandCard,
}) => {
  const [colonBlink, setColonBlink] = useState<boolean>(true);
  const [countdownSeconds, setCountdownSeconds] = useState<number>(210); // Starts around 3:30

  // Colon blink every 1 second
  useEffect(() => {
    const interval = setInterval(() => {
      setColonBlink((prev) => !prev);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Strictly ONLY show when captain is on the way to pickup ('captain_accepted')
  if (ride.status !== 'captain_accepted') {
    return null;
  }

  // Dynamic countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdownSeconds((prev) => (prev > 1 ? prev - 1 : 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Format MM:SS
  const minutes = Math.floor(countdownSeconds / 60);
  const seconds = countdownSeconds % 60;
  const formattedMinutes = String(minutes).padStart(2, '0');
  const formattedSeconds = String(seconds).padStart(2, '0');

  // ----------------------------------------------------
  // Variant 1: Floating Top Pill
  // ----------------------------------------------------
  if (variant === 'floating-top') {
    return (
      <div 
        onClick={onExpandCard}
        className="cursor-pointer group select-none animate-in fade-in slide-in-from-top-2 duration-200"
      >
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/95 text-slate-900 border-2 border-emerald-500 shadow-xl backdrop-blur-md">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
          <div className="font-mono text-xl sm:text-2xl font-black tracking-widest text-emerald-600">
            {formattedMinutes}
            <span className={colonBlink ? 'opacity-100' : 'opacity-20'}>:</span>
            {formattedSeconds}
          </div>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // Variant 2: Digital Timer ONLY (No Container, No Tab, No Text)
  // ----------------------------------------------------
  const displayMinutes = String(minutes);

  return (
    <div className="flex items-center justify-center py-1 select-none">
      <div className="font-mono text-3xl sm:text-4xl font-black tracking-widest text-emerald-600">
        {displayMinutes}
        <span className={colonBlink ? 'opacity-100' : 'opacity-20'}>:</span>
        {formattedSeconds}
      </div>
    </div>
  );
};
