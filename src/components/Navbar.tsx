import React from 'react';
import {
  Bike,
  ShieldCheck,
  Lock,
  LogOut,
} from 'lucide-react';
import { GPSSignalStatus, PricingSettings, UserProfile } from '../types';

interface NavbarProps {
  gpsStatus: GPSSignalStatus;
  pricingSettings: PricingSettings;
  currentUser?: UserProfile | null;
  isAdmin?: boolean;
  onSignOut?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  gpsStatus,
  pricingSettings,
  currentUser,
  isAdmin = false,
  onSignOut,
}) => {
  const getQualityBadge = () => {
    switch (gpsStatus.quality) {
      case 'EXCELLENT':
        return {
          label: `GPS High (±${gpsStatus.accuracy ? Math.round(gpsStatus.accuracy) : 5}m)`,
          color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
          dot: 'bg-emerald-400',
        };
      case 'GOOD':
        return {
          label: `GPS Good (±${gpsStatus.accuracy ? Math.round(gpsStatus.accuracy) : 12}m)`,
          color: 'bg-teal-500/20 text-teal-300 border-teal-500/30',
          dot: 'bg-teal-400',
        };
      case 'FAIR':
        return {
          label: `GPS Fair (±${gpsStatus.accuracy ? Math.round(gpsStatus.accuracy) : 25}m)`,
          color: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
          dot: 'bg-amber-400',
        };
      case 'POOR':
        return {
          label: `GPS Weak (±${gpsStatus.accuracy ? Math.round(gpsStatus.accuracy) : 60}m)`,
          color: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
          dot: 'bg-rose-400',
        };
      case 'DENIED':
        return {
          label: 'GPS Denied',
          color: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
          dot: 'bg-rose-500',
        };
      case 'SEARCHING':
      default:
        return {
          label: 'Acquiring GPS...',
          color: 'bg-slate-700/50 text-slate-300 border-slate-600',
          dot: 'bg-amber-400 animate-ping',
        };
    }
  };

  const badge = getQualityBadge();

  return (
    <header className="w-full border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
        {/* Brand Logo */}
        <div className="flex items-center gap-3">
          <img
            src="/motoride-logo.png"
            alt="Motoride"
            referrerPolicy="no-referrer"
            className="w-10 h-10 rounded-xl object-cover bg-black border border-white/20 shadow-lg shadow-black/60 shrink-0"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
          />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-lg tracking-tight text-white">
                Motoride
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                ₹{pricingSettings.rate_per_km}/KM
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              Ride & Courier Booking
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 sm:gap-3">

          {/* GPS Quality Pill */}
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-medium ${badge.color}`}
          >
            <span className={`w-2 h-2 rounded-full ${badge.dot}`} />
            <span className="hidden sm:inline">{badge.label}</span>
            <span className="sm:hidden">GPS</span>
          </div>

          {/* Current User Pill & Sign Out */}
          {currentUser && (
            <div className="flex items-center gap-1.5 pl-1 sm:pl-2 border-l border-slate-800">
              <div
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs ${
                  isAdmin
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                    : 'bg-slate-900 border-slate-800 text-slate-200'
                }`}
                title={`Signed in as ${currentUser.name} (${currentUser.email})`}
              >
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    isAdmin
                      ? 'bg-amber-500/30 text-amber-300 border border-amber-500/50'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  }`}
                >
                  {currentUser.name.charAt(0).toUpperCase()}
                </div>
                <div className="hidden md:flex flex-col text-left">
                  <span className="font-semibold max-w-[100px] truncate leading-tight">
                    {currentUser.name}
                  </span>
                  {isAdmin && (
                    <span className="text-[9px] text-amber-400 font-bold uppercase tracking-wider">
                      Admin
                    </span>
                  )}
                </div>
              </div>

              {onSignOut && (
                <button
                  id="btn-nav-signout"
                  onClick={onSignOut}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 border border-slate-700 hover:border-rose-500/30 transition-all cursor-pointer"
                  title="Sign Out of Motoride"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
