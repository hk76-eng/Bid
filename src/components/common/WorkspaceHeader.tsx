import React from 'react';
import { UserRole } from '../../types/motoride';
import {
  User,
  LogOut,
  ArrowLeftRight,
  Shield,
  ExternalLink,
} from 'lucide-react';
import { AuthUser } from '../../lib/supabaseAuth';

interface WorkspaceHeaderProps {
  currentRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  currentUser?: AuthUser | null;
  onSignOut?: () => void;
  walletBalance?: number;
  isCaptainOnline?: boolean;
  onToggleCaptainOnline?: () => void;
  unreadNotificationsCount?: number;
  onOpenNotifications?: () => void;
  onOpenWallet?: () => void;
}

export const WorkspaceHeader: React.FC<WorkspaceHeaderProps> = ({
  currentRole,
  onRoleChange,
  currentUser,
  onSignOut,
  walletBalance,
  isCaptainOnline = true,
  onToggleCaptainOnline,
  onOpenWallet,
}) => {
  const handleToggleApp = () => {
    if (currentRole === 'passenger') {
      onRoleChange('captain');
    } else {
      onRoleChange('passenger');
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-slate-950/95 backdrop-blur-md border-b border-slate-800/80 px-3 sm:px-6 py-2.5 shadow-lg shadow-black/40">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        {/* Brand & Active Workspace */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5">
            <img
              src="/motoride-logo.png"
              alt="Motoride"
              referrerPolicy="no-referrer"
              className="w-9 h-9 rounded-xl object-cover bg-black border border-white/20 shadow-md shadow-black/80 shrink-0"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
              }}
            />
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-extrabold tracking-tight text-white text-base">
                Motoride
              </span>
              <span className="text-[11px] text-emerald-400 font-semibold hidden xs:inline">
                – Ride & Courier Booking
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-wide">
                Live
              </span>
            </div>
          </div>
        </div>

        {/* Center/Right Section: One-Click Switch Button for Passenger App and Captain App modes */}
        <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
          {/* Master One-Switch Button */}
          <div className="flex items-center gap-2">
            {currentUser?.role === 'admin' ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold bg-purple-500/15 border border-purple-500/40 text-purple-300">
                <Shield className="w-3.5 h-3.5 text-purple-400" />
                <span>Admin Dashboard</span>
              </div>
            ) : currentRole === 'passenger' ? (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 select-none">
                <User className="w-3.5 h-3.5 text-emerald-400" />
                <span>Passenger</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleToggleApp}
                  id="app-one-switch-btn"
                  className="group relative flex items-center gap-2 px-3.5 py-2 rounded-2xl border-2 transition-all duration-300 shadow-xl cursor-pointer select-none active:scale-95 z-50 bg-slate-900 border-amber-400/80 text-amber-300 hover:border-amber-300 hover:bg-slate-800"
                  title="Switch to Passenger App"
                >
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
                    <div className="w-3.5 h-3.5 rounded bg-black/40 border border-white/20 flex items-center justify-center p-0.5 shrink-0">
                      <img
                        src="/captain-bike-icon.svg"
                        alt="Captain"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <span>Captain</span>
                  </div>
                  <div className="flex items-center gap-1 pl-2 border-l border-white/20 text-xs font-medium text-slate-300 group-hover:text-white">
                    <span>Switch to Passenger</span>
                    <ArrowLeftRight className="w-3.5 h-3.5 text-emerald-400 group-hover:rotate-180 transition-transform duration-300" />
                  </div>
                </button>

                {/* Open Opposite Tab in New Window/Tab for instant multi-tab ride flow testing */}
                <a
                  href="?role=passenger"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hidden sm:flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-[11px] font-semibold border transition-all hover:scale-105 active:scale-95 cursor-pointer bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20"
                  title="Open Passenger Dashboard in a new browser tab for real-time flow testing"
                >
                  <span>Open Passenger Tab</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}


            {/* Captain Online/Offline Pill (Visible when Captain App is Active) */}
            {currentRole === 'captain' && onToggleCaptainOnline && (
              <button
                type="button"
                onClick={onToggleCaptainOnline}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border shadow-sm select-none active:scale-95 ${
                  isCaptainOnline
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
                    : 'bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-500/30'
                }`}
                title={isCaptainOnline ? 'Status: Online (Click to go Offline)' : 'Status: Offline (Click to go Online)'}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    isCaptainOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'
                  }`}
                />
                <span>{isCaptainOnline ? 'Online' : 'Offline'}</span>
              </button>
            )}

            {/* Captain Wallet Tab / Button next to Online Pill */}
            {currentRole === 'captain' && onOpenWallet && (
              <button
                type="button"
                onClick={onOpenWallet}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500/10 border border-amber-500/40 text-amber-300 hover:bg-amber-500/20 active:scale-95 transition-all cursor-pointer shadow-sm"
                title="Open Captain Wallet & Transactions"
              >
                <div className="w-4 h-4 flex items-center justify-center shrink-0">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth="2.5"
                    stroke="currentColor"
                    className="w-3.5 h-3.5 text-amber-400"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M21 12V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 00-2-2h-3"
                    />
                  </svg>
                </div>
                <span>Wallet: ₹{walletBalance !== undefined ? walletBalance.toFixed(2) : '0.00'}</span>
              </button>
            )}
          </div>

          {/* User Account Info & Sign Out */}
          {currentUser && (
            <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
              <div className="hidden lg:flex flex-col text-right">
                <span className="text-xs font-bold text-white truncate max-w-[120px]">
                  {currentUser.email?.toLowerCase().trim() === 'mojobiketaxi@gmail.com' ? 'Hemant kashyap' : currentUser.name}
                </span>
                <span className="text-[10px] text-slate-400 truncate max-w-[120px]">
                  {currentUser.email}
                </span>
              </div>

              {onSignOut && (
                <button
                  type="button"
                  onClick={onSignOut}
                  title="Sign Out from Supabase session"
                  aria-label="Sign Out"
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 hover:text-rose-200 border border-rose-500/25 text-xs font-bold transition-all cursor-pointer active:scale-95 shrink-0"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Sign Out</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
