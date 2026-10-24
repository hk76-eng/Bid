import React, { useState, useRef, useEffect } from 'react';
import {
  Gauge,
  Navigation,
  Columns2,
  Bike,
  History,
  Settings,
  AppWindow,
  ChevronUp,
  ChevronDown,
  Radio,
  FileText,
  Lock,
  Sparkles,
  Zap,
  MapPin,
  CheckCircle2,
  Eye,
  EyeOff
} from 'lucide-react';
import { GPSSignalStatus, GPSPoint } from '../types';

interface BottomTabBarProps {
  activeView: 'all' | 'meter' | 'map';
  onSelectView: (view: 'all' | 'meter' | 'map') => void;
  isRideActive: boolean;
  rideStatus?: 'STARTED' | 'PAUSED' | 'COMPLETED';
  pastRidesCount: number;
  ratePerKm: number;
  isAdmin: boolean;
  currentLocation: GPSPoint | null;
  gpsStatus: GPSSignalStatus;
  isGpsWindowOpen: boolean;
  onToggleGpsWindow: () => void;
  onOpenVehicle: () => void;
  onOpenHistory: () => void;
  onOpenSettings: () => void;
  onOpenReceipt?: () => void;
  hasCompletedRide?: boolean;
}

export const BottomTabBar: React.FC<BottomTabBarProps> = ({
  activeView,
  onSelectView,
  isRideActive,
  rideStatus,
  pastRidesCount,
  ratePerKm,
  isAdmin,
  currentLocation,
  gpsStatus,
  isGpsWindowOpen,
  onToggleGpsWindow,
  onOpenVehicle,
  onOpenHistory,
  onOpenSettings,
  onOpenReceipt,
  hasCompletedRide = false,
}) => {
  const [isWindowMenuOpen, setIsWindowMenuOpen] = useState<boolean>(false);
  const [isBarMinimized, setIsBarMinimized] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const dropdownButtonRef = useRef<HTMLButtonElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        dropdownButtonRef.current &&
        !dropdownButtonRef.current.contains(event.target as Node)
      ) {
        setIsWindowMenuOpen(false);
      }
    };

    if (isWindowMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isWindowMenuOpen]);

  // Close dropdown on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isWindowMenuOpen) {
        setIsWindowMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isWindowMenuOpen]);

  if (isBarMinimized) {
    return (
      <div className="fixed bottom-4 right-4 z-40">
        <button
          id="btn-expand-bottom-bar"
          onClick={() => setIsBarMinimized(false)}
          className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-slate-900/95 border border-emerald-500/50 text-emerald-300 text-xs font-bold shadow-2xl backdrop-blur-md hover:bg-slate-850 transition-all active:scale-95 cursor-pointer group"
          title="Restore Bottom Navigation & Window Tabs"
        >
          <AppWindow className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
          <span>Show Tabs</span>
          <ChevronUp className="w-3.5 h-3.5 text-emerald-400" />
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 pointer-events-none">
      <div className="max-w-7xl mx-auto px-2 sm:px-4 pb-2 sm:pb-3 pointer-events-auto">
        {/* Window Drop Down Popover Menu (Appears above the bottom bar) */}
        {isWindowMenuOpen && (
          <div
            ref={dropdownRef}
            id="window-dropdown-menu"
            className="mb-2 w-full max-w-sm sm:max-w-md mx-auto bg-slate-900/95 border border-emerald-500/40 rounded-2xl p-3 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-3 duration-200"
          >
            {/* Dropdown Header */}
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                  <AppWindow className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                    Window Controls & Panels
                  </h4>
                  <p className="text-[10px] text-slate-400">
                    Toggle windows and switch active dashboard views
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsWindowMenuOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 text-xs transition-colors cursor-pointer"
                title="Close window menu"
              >
                ✕
              </button>
            </div>

            {/* Quick Window Actions List */}
            <div className="space-y-1.5 text-xs">
              {/* GPS Live Telemetry Window Toggle */}
              <button
                type="button"
                id="menu-toggle-gps-window"
                onClick={() => {
                  onToggleGpsWindow();
                  setIsWindowMenuOpen(false);
                }}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-750 text-slate-200 hover:text-white transition-all border border-slate-700/60 hover:border-emerald-500/40 cursor-pointer group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 group-hover:scale-105 transition-transform">
                    <Radio className="w-3.5 h-3.5" />
                  </div>
                  <div className="text-left">
                    <div className="font-semibold text-white flex items-center gap-1.5">
                      <span>GPS Live Telemetry Window</span>
                      {currentLocation && (
                        <span className="text-[10px] text-emerald-400 font-mono-num font-normal">
                          (±{Math.round(currentLocation.accuracy || 5)}m)
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Coordinates, velocity, satellite status, and altitude
                    </div>
                  </div>
                </div>
                <div className="shrink-0">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                      isGpsWindowOpen
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : 'bg-slate-700/50 text-slate-400 border-slate-600'
                    }`}
                  >
                    {isGpsWindowOpen ? 'Active ▾' : 'Open ▾'}
                  </span>
                </div>
              </button>

              {/* View Layout Options Grid */}
              <div className="p-2 bg-slate-950/60 border border-slate-800/80 rounded-xl space-y-1.5">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block px-1">
                  Main Page Layout
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      onSelectView('all');
                      setIsWindowMenuOpen(false);
                    }}
                    className={`px-2 py-1.5 rounded-lg text-xs font-semibold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                      activeView === 'all'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50'
                        : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
                    }`}
                  >
                    <Columns2 className="w-3.5 h-3.5" />
                    <span className="text-[10px]">Split View</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onSelectView('meter');
                      setIsWindowMenuOpen(false);
                    }}
                    className={`px-2 py-1.5 rounded-lg text-xs font-semibold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                      activeView === 'meter'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50'
                        : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
                    }`}
                  >
                    <Gauge className="w-3.5 h-3.5" />
                    <span className="text-[10px]">Meter Only</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onSelectView('map');
                      setIsWindowMenuOpen(false);
                    }}
                    className={`px-2 py-1.5 rounded-lg text-xs font-semibold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                      activeView === 'map'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50'
                        : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
                    }`}
                  >
                    <Navigation className="w-3.5 h-3.5" />
                    <span className="text-[10px]">Map Only</span>
                  </button>
                </div>
              </div>

              {/* Vehicle Window Launcher */}
              <button
                type="button"
                id="menu-open-vehicle-window"
                onClick={() => {
                  onOpenVehicle();
                  setIsWindowMenuOpen(false);
                }}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-750 text-slate-200 hover:text-white transition-all border border-slate-700/60 hover:border-emerald-500/40 cursor-pointer group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-teal-500/15 border border-teal-500/30 text-teal-400 group-hover:scale-105 transition-transform">
                    <Bike className="w-3.5 h-3.5" />
                  </div>
                  <div className="text-left">
                    <div className="font-semibold text-white">Vehicle Details Window</div>
                    <div className="text-[10px] text-slate-400">
                      Vehicle specs & documents
                    </div>
                  </div>
                </div>
                <span className="text-[10px] text-emerald-400 font-bold px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30">
                  Specs
                </span>
              </button>

              {/* Ride History Window Launcher */}
              <button
                type="button"
                id="menu-open-history-window"
                onClick={() => {
                  onOpenHistory();
                  setIsWindowMenuOpen(false);
                }}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-750 text-slate-200 hover:text-white transition-all border border-slate-700/60 hover:border-emerald-500/40 cursor-pointer group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-sky-500/15 border border-sky-500/30 text-sky-400 group-hover:scale-105 transition-transform">
                    <History className="w-3.5 h-3.5" />
                  </div>
                  <div className="text-left">
                    <div className="font-semibold text-white">Ride History Window</div>
                    <div className="text-[10px] text-slate-400">
                      Past completed rides, invoices & payments
                    </div>
                  </div>
                </div>
                <span className="text-[10px] font-mono-num font-bold px-2 py-0.5 rounded bg-slate-700/80 text-slate-200">
                  {pastRidesCount} rides
                </span>
              </button>

              {/* Settings Window Launcher */}
              <button
                type="button"
                id="menu-open-settings-window"
                onClick={() => {
                  onOpenSettings();
                  setIsWindowMenuOpen(false);
                }}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-750 text-slate-200 hover:text-white transition-all border border-slate-700/60 hover:border-emerald-500/40 cursor-pointer group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 group-hover:scale-105 transition-transform">
                    <Settings className="w-3.5 h-3.5" />
                  </div>
                  <div className="text-left">
                    <div className="font-semibold text-white flex items-center gap-1">
                      <span>Settings & Fare Config Window</span>
                      {!isAdmin && <Lock className="w-3 h-3 text-slate-500" />}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      ₹{ratePerKm}/KM rate, GPS thresholds & wake lock
                    </div>
                  </div>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  {isAdmin ? 'Admin' : 'Restricted'}
                </span>
              </button>

              {/* Trip Receipt Window (if ride completed) */}
              {hasCompletedRide && onOpenReceipt && (
                <button
                  type="button"
                  id="menu-open-receipt-window"
                  onClick={() => {
                    onOpenReceipt();
                    setIsWindowMenuOpen(false);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-200 transition-all border border-emerald-500/40 cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-300">
                      <FileText className="w-3.5 h-3.5" />
                    </div>
                    <div className="text-left">
                      <div className="font-semibold text-emerald-200">Latest Trip Receipt</div>
                      <div className="text-[10px] text-emerald-400/80">View invoice and payment summary</div>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/30 text-emerald-200">
                    View
                  </span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Main Sticky Bottom Tab Bar */}
        <div className="bg-slate-900/95 border border-slate-800/90 rounded-2xl shadow-2xl backdrop-blur-xl p-1.5 sm:p-2 flex items-center justify-between gap-1 sm:gap-2">
          {/* Tabs Group */}
          <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto no-scrollbar flex-1 py-0.5">
            {/* Tab 1: Split / All View */}
            <button
              id="tab-view-all"
              type="button"
              onClick={() => onSelectView('all')}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                activeView === 'all'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 shadow-md shadow-emerald-500/25'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/70'
              }`}
              title="Split View: Show both Ride Meter & Route Map"
            >
              <Columns2 className="w-3.5 h-3.5" />
              <span className="hidden xs:inline sm:inline">All</span>
            </button>

            {/* Tab 2: Ride Meter */}
            <button
              id="tab-view-meter"
              type="button"
              onClick={() => onSelectView('meter')}
              className={`relative flex items-center gap-1.5 px-2.5 sm:px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                activeView === 'meter'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 shadow-md shadow-emerald-500/25'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/70'
              }`}
              title="Meter View: Ride Meter & Speedometer"
            >
              <Gauge className="w-3.5 h-3.5" />
              <span>Meter</span>
              {isRideActive && (
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
                </span>
              )}
            </button>

            {/* Tab 3: Live Map */}
            <button
              id="tab-view-map"
              type="button"
              onClick={() => onSelectView('map')}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                activeView === 'map'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 shadow-md shadow-emerald-500/25'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/70'
              }`}
              title="Map View: Full Route Map & GPS Tracker"
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>Map</span>
              {currentLocation && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 hidden sm:inline-block" />
              )}
            </button>

            {/* Tab 4: Vehicle Modal */}
            <button
              id="tab-open-vehicle"
              type="button"
              onClick={onOpenVehicle}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800/70 transition-all shrink-0 cursor-pointer"
              title="Vehicle Specs & Documents"
            >
              <Bike className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Vehicle</span>
            </button>

            {/* Tab 5: Ride History Modal */}
            <button
              id="tab-open-history"
              type="button"
              onClick={onOpenHistory}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800/70 transition-all shrink-0 cursor-pointer"
              title="Past Completed Rides & Invoices"
            >
              <History className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden sm:inline">History</span>
              {pastRidesCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-[10px] text-emerald-300 font-mono-num font-bold border border-slate-700">
                  {pastRidesCount}
                </span>
              )}
            </button>

            {/* Tab 6: Settings Modal */}
            <button
              id="tab-open-settings"
              type="button"
              onClick={onOpenSettings}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800/70 transition-all shrink-0 cursor-pointer"
              title="Rate per KM & System Settings"
            >
              <Settings className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden md:inline">Settings</span>
              {!isAdmin && <Lock className="w-3 h-3 text-slate-500" />}
            </button>
          </div>

          {/* Right Action: Window Drop Down Button */}
          <div className="flex items-center gap-1 shrink-0 pl-1 border-l border-slate-800">
            <button
              ref={dropdownButtonRef}
              id="btn-window-dropdown-toggle"
              type="button"
              onClick={() => setIsWindowMenuOpen(!isWindowMenuOpen)}
              className={`flex items-center gap-1.5 px-3 sm:px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer shadow-sm ${
                isWindowMenuOpen
                  ? 'bg-emerald-500 text-slate-950 border border-emerald-400 shadow-emerald-500/25 scale-102'
                  : 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 hover:border-emerald-500/60'
              }`}
              title="Toggle Window Controls & Options Dropdown Menu"
            >
              <AppWindow className="w-3.5 h-3.5" />
              <span className="tracking-wide">Windows</span>
              {isWindowMenuOpen ? (
                <ChevronDown className="w-3.5 h-3.5 rotate-180 transition-transform" />
              ) : (
                <ChevronUp className="w-3.5 h-3.5 transition-transform" />
              )}
            </button>

            {/* Optional Minimize / Drop Down Bar Button */}
            <button
              id="btn-minimize-bottom-bar"
              type="button"
              onClick={() => setIsBarMinimized(true)}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-300 hover:bg-slate-800/80 transition-colors cursor-pointer"
              title="Minimize Bottom Tabs Bar"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
