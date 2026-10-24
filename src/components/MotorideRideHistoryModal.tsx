import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  History,
  X,
  Bike,
  Car,
  Package,
  MapPin,
  Clock,
  IndianRupee,
  Receipt,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Search,
  Filter,
  RefreshCw,
  ChevronRight,
  TrendingUp,
  User,
  Phone,
  ShieldCheck,
  Calendar,
  Share2,
  Copy,
  Check,
  ArrowRight,
} from 'lucide-react';
import { MotorideRide, RideTypeCode } from '../types/motoride';
import { motorideApi } from '../services/motorideApi';

interface MotorideRideHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  role: 'passenger' | 'captain';
  userId: string;
  userName?: string;
  todayIncome?: number;
  onBookNewRide?: () => void;
}

export const MotorideRideHistoryModal: React.FC<MotorideRideHistoryModalProps> = ({
  isOpen,
  onClose,
  role,
  userId,
  userName = '',
  todayIncome = 0,
  onBookNewRide,
}) => {
  const [rides, setRides] = useState<MotorideRide[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'cancelled' | 'today'>('all');
  const [vehicleFilter, setVehicleFilter] = useState<'all' | RideTypeCode>('all');
  const [selectedRide, setSelectedRide] = useState<MotorideRide | null>(null);
  const [copiedReceipt, setCopiedReceipt] = useState<boolean>(false);

  // Fetch ride history for the user
  const fetchRides = async () => {
    setIsLoading(true);
    try {
      let list: MotorideRide[] = [];
      const all = await motorideApi.getRides();

      if (role === 'captain') {
        if (userId) {
          list = all.filter((r) => r.captain_id === userId);
        }
        // Fallback: If captain ID format differs or in-memory rides match captainName
        if (list.length === 0 && userName) {
          list = all.filter(
            (r) =>
              (r.captain_name && r.captain_name.toLowerCase().includes(userName.toLowerCase())) ||
              (userName.toLowerCase().includes((r.captain_name || '').toLowerCase()))
          );
        }
        // General fallback for all captain activities
        if (list.length === 0) {
          list = all.filter((r) => r.captain_id || r.status === 'completed' || r.status === 'trip_completed');
        }
        if (list.length === 0) {
          list = all;
        }
      } else {
        if (userId) {
          list = all.filter((r) => r.passenger_id === userId);
        }
        if (list.length === 0 && userName) {
          list = all.filter(
            (r) =>
              (r.passenger_name && r.passenger_name.toLowerCase().includes(userName.toLowerCase())) ||
              (userName.toLowerCase().includes((r.passenger_name || '').toLowerCase()))
          );
        }
        if (list.length === 0) {
          list = all;
        }
      }

      // Sort newest first
      list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setRides(list);
    } catch (err) {
      console.warn('Error loading ride history:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchRides();
    } else {
      setSelectedRide(null);
    }
  }, [isOpen, userId, userName, role]);

  // Today's Date String for Business timezone (Asia/Kolkata)
  const todayDateStr = React.useMemo(() => {
    try {
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
    } catch {
      return new Date().toISOString().split('T')[0];
    }
  }, []);

  // Summary Metrics
  const stats = React.useMemo(() => {
    const completedRides = rides.filter(
      (r) => r.status === 'completed' || r.status === 'trip_completed'
    );
    const cancelledRides = rides.filter((r) => r.status.includes('cancelled'));

    const totalFareSum = completedRides.reduce((sum, r) => {
      const fare = Number(r.fare_amount ?? r.final_fare ?? r.offered_fare ?? 0);
      return sum + fare;
    }, 0);

    const todayRides = completedRides.filter((r) => {
      const ts = r.completed_at || r.trip_completed_at || r.created_at;
      if (!ts) return false;
      try {
        const dStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(ts));
        return dStr === todayDateStr;
      } catch {
        return false;
      }
    });

    const todayFareSum = todayRides.reduce((sum, r) => {
      const fare = Number(r.fare_amount ?? r.final_fare ?? r.offered_fare ?? 0);
      return sum + fare;
    }, 0);

    const effectiveTodayIncome = todayIncome > 0 ? todayIncome : todayFareSum;

    return {
      totalCount: rides.length,
      completedCount: completedRides.length,
      cancelledCount: cancelledRides.length,
      totalFare: totalFareSum,
      todayIncome: effectiveTodayIncome,
      todayCount: todayRides.length,
      avgFare: completedRides.length > 0 ? Math.round(totalFareSum / completedRides.length) : 0,
    };
  }, [rides, todayIncome, todayDateStr]);

  // Filtered List
  const filteredRides = React.useMemo(() => {
    return rides.filter((ride) => {
      // 1. Status Filter
      if (statusFilter === 'completed') {
        if (ride.status !== 'completed' && ride.status !== 'trip_completed') return false;
      } else if (statusFilter === 'cancelled') {
        if (!ride.status.includes('cancelled')) return false;
      } else if (statusFilter === 'today') {
        const ts = ride.completed_at || ride.trip_completed_at || ride.created_at;
        if (!ts) return false;
        try {
          const dStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(ts));
          if (dStr !== todayDateStr) return false;
        } catch {
          return false;
        }
      }

      // 2. Vehicle Filter
      if (vehicleFilter !== 'all') {
        if (ride.ride_type !== vehicleFilter) return false;
      }

      // 3. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const codeMatch = ride.ride_code?.toLowerCase().includes(q);
        const pickupMatch = ride.pickup_address?.toLowerCase().includes(q);
        const dropoffMatch = ride.dropoff_address?.toLowerCase().includes(q);
        const captainMatch = ride.captain_name?.toLowerCase().includes(q);
        const passengerMatch = ride.passenger_name?.toLowerCase().includes(q);
        const idMatch = ride.id?.toLowerCase().includes(q);
        if (!codeMatch && !pickupMatch && !dropoffMatch && !captainMatch && !passengerMatch && !idMatch) {
          return false;
        }
      }

      return true;
    });
  }, [rides, statusFilter, vehicleFilter, searchQuery, todayDateStr]);

  // Copy receipt summary
  const handleCopyReceipt = (ride: MotorideRide) => {
    const summary = `--- Motoride Trip Receipt ---
Ride Code: ${ride.ride_code || ride.id}
Date: ${new Date(ride.created_at).toLocaleString('en-IN')}
Status: ${ride.status.toUpperCase()}
Pickup: ${ride.pickup_address}
Dropoff: ${ride.dropoff_address}
Distance: ${ride.distance_km || 0} km | Duration: ${ride.duration_minutes || 0} mins
Fare: ₹${ride.final_fare || ride.fare_amount || ride.offered_fare || 0}
Payment: ${(ride.payment_method || 'CASH').toUpperCase()} (${ride.payment_status || 'paid'})
${role === 'passenger' ? `Captain: ${ride.captain_name || 'Assigned Driver'}` : `Passenger: ${ride.passenger_name || 'Passenger'}`}
Vehicle: ${ride.vehicle_model || 'Motorcycle'} (${ride.plate_number || 'PB 65 AB 1234'})
---------------------------`;

    navigator.clipboard.writeText(summary);
    setCopiedReceipt(true);
    setTimeout(() => setCopiedReceipt(false), 2500);
  };

  const getVehicleIcon = (type?: RideTypeCode) => {
    switch (type) {
      case 'car':
        return <Car className="w-4 h-4 text-sky-400" />;
      case 'courier':
        return <Package className="w-4 h-4 text-purple-400" />;
      case 'auto':
        return <span className="text-xs font-black text-amber-400 font-mono-num">🛺</span>;
      case 'bike':
      default:
        return <Bike className="w-4 h-4 text-emerald-400" />;
    }
  };

  const getVehicleLabel = (type?: RideTypeCode) => {
    switch (type) {
      case 'car':
        return 'Cab / Car';
      case 'courier':
        return 'Courier';
      case 'auto':
        return 'Auto';
      case 'bike':
      default:
        return 'Bike Taxi';
    }
  };

  const formatRideDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const isToday =
        new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d) === todayDateStr;

      const timePart = d.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });

      if (isToday) {
        return `Today at ${timePart}`;
      }

      return d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return dateStr;
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[2500] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 10 }}
          transition={{ duration: 0.2 }}
          className="bg-slate-900 border border-slate-800 rounded-3xl max-w-3xl w-full overflow-hidden shadow-2xl relative my-auto flex flex-col max-h-[92vh]"
        >
          {/* Top Bar Header */}
          <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black shrink-0 shadow-sm ${
                  role === 'captain'
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-emerald-500 text-slate-950'
                }`}
              >
                <History className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <h3 className="text-base sm:text-lg font-black text-white">
                    {role === 'captain' ? 'Captain Trip History' : 'Ride History'}
                  </h3>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      role === 'captain'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    }`}
                  >
                    {role}
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  {role === 'captain'
                    ? `Logged earnings & trip records for ${userName || 'Captain'}`
                    : `Past rides, receipts & billing for ${userName || 'Passenger'}`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={fetchRides}
                title="Refresh rides"
                className="p-2 rounded-xl text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 border border-slate-700 transition-colors cursor-pointer active:scale-95"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-emerald-400' : ''}`} />
              </button>
              <button
                type="button"
                onClick={onClose}
                title="Close"
                className="p-2 rounded-xl text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 border border-slate-700 transition-colors cursor-pointer active:scale-95"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Quick Stats Overview Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-4 bg-slate-950/40 border-b border-slate-800/80">
            {role === 'captain' ? (
              <>
                <div className="p-3 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Total Trips
                  </span>
                  <span className="text-lg sm:text-xl font-black text-white font-mono-num mt-0.5">
                    {stats.completedCount}
                  </span>
                  <span className="text-[10px] text-emerald-400 font-medium mt-0.5">Completed</span>
                </div>

                <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col">
                  <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wider">
                    Today's Income
                  </span>
                  <span className="text-lg sm:text-xl font-black text-amber-400 font-mono-num mt-0.5">
                    ₹{stats.todayIncome.toLocaleString('en-IN')}
                  </span>
                  <span className="text-[10px] text-amber-300/80 font-medium mt-0.5">
                    {stats.todayCount} trip{stats.todayCount !== 1 ? 's' : ''} today
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex flex-col">
                  <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider">
                    Total Earned
                  </span>
                  <span className="text-lg sm:text-xl font-black text-emerald-400 font-mono-num mt-0.5">
                    ₹{stats.totalFare.toLocaleString('en-IN')}
                  </span>
                  <span className="text-[10px] text-emerald-400/80 font-medium mt-0.5">All time</span>
                </div>

                <div className="p-3 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Cancelled
                  </span>
                  <span className="text-lg sm:text-xl font-black text-rose-400 font-mono-num mt-0.5">
                    {stats.cancelledCount}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium mt-0.5">Unfulfilled</span>
                </div>
              </>
            ) : (
              <>
                <div className="p-3 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Total Rides
                  </span>
                  <span className="text-lg sm:text-xl font-black text-white font-mono-num mt-0.5">
                    {stats.completedCount}
                  </span>
                  <span className="text-[10px] text-emerald-400 font-medium mt-0.5">Completed</span>
                </div>

                <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex flex-col">
                  <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider">
                    Total Spent
                  </span>
                  <span className="text-lg sm:text-xl font-black text-emerald-400 font-mono-num mt-0.5">
                    ₹{stats.totalFare.toLocaleString('en-IN')}
                  </span>
                  <span className="text-[10px] text-emerald-400/80 font-medium mt-0.5">Across all rides</span>
                </div>

                <div className="p-3 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Avg Ride Fare
                  </span>
                  <span className="text-lg sm:text-xl font-black text-cyan-400 font-mono-num mt-0.5">
                    ₹{stats.avgFare}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium mt-0.5">Per trip</span>
                </div>

                <div className="p-3 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Cancelled
                  </span>
                  <span className="text-lg sm:text-xl font-black text-rose-400 font-mono-num mt-0.5">
                    {stats.cancelledCount}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium mt-0.5">Refunded/Cancelled</span>
                </div>
              </>
            )}
          </div>

          {/* Search & Filter Toolbar */}
          <div className="p-3 sm:p-4 border-b border-slate-800/80 bg-slate-900/50 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by ride code, location, or name..."
                className="w-full pl-9 pr-8 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-slate-600 transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Status Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  statusFilter === 'all'
                    ? 'bg-slate-100 text-slate-900 shadow-sm'
                    : 'bg-slate-800/70 text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                All ({rides.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('completed')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  statusFilter === 'completed'
                    ? 'bg-emerald-500 text-slate-950 shadow-sm font-black'
                    : 'bg-slate-800/70 text-slate-400 hover:text-emerald-400 hover:bg-slate-800'
                }`}
              >
                Completed ({stats.completedCount})
              </button>
              {role === 'captain' && (
                <button
                  type="button"
                  onClick={() => setStatusFilter('today')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    statusFilter === 'today'
                      ? 'bg-amber-500 text-slate-950 shadow-sm font-black'
                      : 'bg-slate-800/70 text-slate-400 hover:text-amber-400 hover:bg-slate-800'
                  }`}
                >
                  Today ({stats.todayCount})
                </button>
              )}
              <button
                type="button"
                onClick={() => setStatusFilter('cancelled')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  statusFilter === 'cancelled'
                    ? 'bg-rose-500 text-white shadow-sm font-black'
                    : 'bg-slate-800/70 text-slate-400 hover:text-rose-400 hover:bg-slate-800'
                }`}
              >
                Cancelled ({stats.cancelledCount})
              </button>
            </div>
          </div>

          {/* Ride List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 scrollbar-thin">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
                <RefreshCw className="w-8 h-8 animate-spin text-slate-500" />
                <p className="text-sm font-medium">Loading ride history...</p>
              </div>
            ) : filteredRides.length === 0 ? (
              <div className="text-center py-16 px-4 flex flex-col items-center justify-center">
                <div className="w-16 h-16 rounded-3xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center mb-3">
                  <History className="w-8 h-8 text-slate-500" />
                </div>
                <h4 className="text-base font-bold text-white mb-1">No rides found</h4>
                <p className="text-xs text-slate-400 max-w-sm">
                  {searchQuery || statusFilter !== 'all'
                    ? 'No trips match the current filter or search criteria. Try adjusting your filters.'
                    : role === 'captain'
                    ? 'You have not completed any rides yet. Go online to start accepting incoming requests.'
                    : 'You have not taken any rides yet. Book your first ride to see it here.'}
                </p>
                {role === 'passenger' && onBookNewRide && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onBookNewRide();
                    }}
                    className="mt-4 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-all cursor-pointer shadow-lg active:scale-95"
                  >
                    Book a Ride Now
                  </button>
                )}
              </div>
            ) : (
              filteredRides.map((ride) => {
                const isCompleted =
                  ride.status === 'completed' || ride.status === 'trip_completed';
                const isCancelled = ride.status.includes('cancelled');
                const fare = Number(ride.fare_amount ?? ride.final_fare ?? ride.offered_fare ?? 0);

                return (
                  <div
                    key={ride.id}
                    id={`history-ride-${ride.id}`}
                    onClick={() => setSelectedRide(ride)}
                    className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 hover:bg-slate-800/30 transition-all cursor-pointer group flex flex-col gap-3 shadow-sm active:scale-[0.99]"
                  >
                    {/* Top Row: Code, Vehicle Badge, Status, Date */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-xl bg-slate-800 border border-slate-700/80 flex items-center gap-1.5">
                          {getVehicleIcon(ride.ride_type)}
                          <span className="text-[11px] font-bold text-slate-300">
                            {getVehicleLabel(ride.ride_type)}
                          </span>
                        </div>
                        <span className="font-mono-num text-xs font-black text-white px-2 py-0.5 rounded-lg bg-slate-800/60 border border-slate-700/50">
                          {ride.ride_code || ride.id.slice(0, 10)}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {isCompleted ? (
                          <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[11px] font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Completed</span>
                          </span>
                        ) : isCancelled ? (
                          <span className="px-2.5 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-400 text-[11px] font-bold flex items-center gap-1">
                            <XCircle className="w-3 h-3" />
                            <span>Cancelled</span>
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[11px] font-bold flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span className="capitalize">{ride.status.replace(/_/g, ' ')}</span>
                          </span>
                        )}
                        <span className="text-[11px] text-slate-400">
                          {formatRideDate(ride.created_at)}
                        </span>
                      </div>
                    </div>

                    {/* Middle Row: Route Journey Points */}
                    <div className="flex flex-col gap-2 relative pl-5 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
                      {/* Pickup */}
                      <div className="flex items-start gap-2 relative">
                        <div className="absolute -left-5 top-1 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-slate-900 shrink-0" />
                        <span className="text-xs text-slate-300 font-medium truncate max-w-full">
                          {ride.pickup_address || 'Pickup Location'}
                        </span>
                      </div>

                      {/* Dropoff */}
                      <div className="flex items-start gap-2 relative">
                        <div className="absolute -left-5 top-1 w-2.5 h-2.5 rounded-full bg-rose-500 ring-4 ring-slate-900 shrink-0" />
                        <span className="text-xs text-slate-300 font-medium truncate max-w-full">
                          {ride.dropoff_address || 'Destination'}
                        </span>
                      </div>
                    </div>

                    {/* Bottom Row: Distance, Driver/Passenger Info, Fare & Receipt Trigger */}
                    <div className="pt-2.5 border-t border-slate-800/80 flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-3 text-xs text-slate-400">
                        {ride.distance_km ? (
                          <span className="font-mono-num font-semibold text-slate-300">
                            {ride.distance_km.toFixed(1)} km
                          </span>
                        ) : null}
                        {ride.duration_minutes ? (
                          <span className="font-mono-num font-semibold text-slate-300">
                            {ride.duration_minutes} mins
                          </span>
                        ) : null}

                        {role === 'passenger' ? (
                          <div className="flex items-center gap-1.5 text-slate-300">
                            <User className="w-3.5 h-3.5 text-slate-500" />
                            <span className="font-bold text-xs truncate max-w-[140px]">
                              {ride.captain_name || 'Captain'}
                            </span>
                            {ride.vehicle_model && (
                              <span className="text-[10px] text-slate-400 font-mono-num truncate max-w-[100px]">
                                • {ride.vehicle_model}
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-slate-300">
                            <User className="w-3.5 h-3.5 text-slate-500" />
                            <span className="font-bold text-xs truncate max-w-[140px]">
                              {ride.passenger_name || 'Passenger'}
                            </span>
                            {ride.passenger_phone && (
                              <span className="text-[10px] text-slate-400 font-mono-num">
                                • {ride.passenger_phone}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <span className="text-base font-black text-emerald-400 font-mono-num flex items-center justify-end">
                            ₹{fare.toLocaleString('en-IN')}
                          </span>
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                            {ride.payment_method || 'CASH'} • {ride.payment_status || 'paid'}
                          </span>
                        </div>

                        <div className="p-1.5 rounded-xl bg-slate-800 text-slate-400 group-hover:text-white group-hover:bg-slate-700 transition-colors">
                          <ChevronRight className="w-4 h-4" />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Detailed Ride Receipt Modal Overlay */}
          {selectedRide && (
            <div className="absolute inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex flex-col p-4 sm:p-6 overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3.5 mb-4">
                <div className="flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-emerald-400" />
                  <span className="font-bold text-white text-base">Trip Receipt & Details</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedRide(null)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-white bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Receipt Content Container */}
              <div className="space-y-4 max-w-lg mx-auto w-full">
                {/* Status & Fare Header */}
                <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-xs text-slate-400 font-medium">
                      {role === 'captain' ? 'Fare Earned' : 'Total Fare Paid'}
                    </span>
                    <span className="text-3xl font-black text-emerald-400 font-mono-num mt-0.5">
                      ₹
                      {Number(
                        selectedRide.fare_amount ??
                          selectedRide.final_fare ??
                          selectedRide.offered_fare ??
                          0
                      ).toLocaleString('en-IN')}
                    </span>
                    <span className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 font-bold uppercase text-[10px]">
                        {selectedRide.payment_method || 'Cash'}
                      </span>
                      <span>• Payment {selectedRide.payment_status || 'Paid'}</span>
                    </span>
                  </div>

                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <IndianRupee className="w-6 h-6 stroke-[2.5]" />
                  </div>
                </div>

                {/* Captain Tripwise 10% Commission Deduction Card */}
                {role === 'captain' && (
                  <div className="p-4 rounded-2xl bg-slate-900 border border-amber-500/30 space-y-2.5">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-amber-300 flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-amber-400" />
                        <span>10% Platform Commission Breakdown</span>
                      </span>
                      <span className="font-mono text-rose-400">
                        -₹{(Number(selectedRide.fare_amount ?? selectedRide.final_fare ?? selectedRide.offered_fare ?? 0) * 0.10).toFixed(2)}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px]">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-semibold block">Gross Fare</span>
                        <span className="font-mono font-bold text-white">
                          ₹{Number(selectedRide.fare_amount ?? selectedRide.final_fare ?? selectedRide.offered_fare ?? 0).toFixed(2)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-amber-400 uppercase font-semibold block">10% Platform Fee</span>
                        <span className="font-mono font-bold text-amber-300">
                          -₹{(Number(selectedRide.fare_amount ?? selectedRide.final_fare ?? selectedRide.offered_fare ?? 0) * 0.10).toFixed(2)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-emerald-400 uppercase font-semibold block">Net Take-Home</span>
                        <span className="font-mono font-black text-emerald-400">
                          +₹{(Number(selectedRide.fare_amount ?? selectedRide.final_fare ?? selectedRide.offered_fare ?? 0) * 0.90).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Ride Details Card */}
                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-400 pb-2 border-b border-slate-800">
                    <span>Ride Code</span>
                    <span className="font-mono-num font-bold text-white">
                      {selectedRide.ride_code || selectedRide.id}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-400 pb-2 border-b border-slate-800">
                    <span>Vehicle Service</span>
                    <span className="font-bold text-white flex items-center gap-1.5">
                      {getVehicleIcon(selectedRide.ride_type)}
                      {getVehicleLabel(selectedRide.ride_type)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-400 pb-2 border-b border-slate-800">
                    <span>Status</span>
                    <span
                      className={`font-bold capitalize ${
                        selectedRide.status.includes('completed')
                          ? 'text-emerald-400'
                          : selectedRide.status.includes('cancelled')
                          ? 'text-rose-400'
                          : 'text-amber-400'
                      }`}
                    >
                      {selectedRide.status.replace(/_/g, ' ')}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-400 pb-2 border-b border-slate-800">
                    <span>Date & Time</span>
                    <span className="font-bold text-white">
                      {new Date(selectedRide.created_at).toLocaleString('en-IN')}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Distance & Duration</span>
                    <span className="font-bold text-white font-mono-num">
                      {selectedRide.distance_km || 0} km • {selectedRide.duration_minutes || 0} mins
                    </span>
                  </div>
                </div>

                {/* Pickup & Destination */}
                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                  <div className="flex items-start gap-2.5">
                    <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                      <MapPin className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                        Pickup Location
                      </span>
                      <span className="text-xs text-white font-medium">
                        {selectedRide.pickup_address}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 pt-2 border-t border-slate-800">
                    <div className="w-6 h-6 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0 mt-0.5">
                      <MapPin className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                        Dropoff Destination
                      </span>
                      <span className="text-xs text-white font-medium">
                        {selectedRide.dropoff_address}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Party Details (Driver or Passenger) */}
                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                      {role === 'passenger' ? 'Captain Details' : 'Passenger Details'}
                    </span>
                    <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded font-bold">
                      Verified
                    </span>
                  </div>

                  {role === 'passenger' ? (
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-white">
                          {selectedRide.captain_name || 'Registered Driver'}
                        </span>
                        <span className="text-xs text-slate-400 font-mono-num">
                          {selectedRide.vehicle_model || 'Motorcycle'} • {selectedRide.plate_number || 'PB 65 AB 1234'}
                        </span>
                      </div>
                      {selectedRide.captain_phone && (
                        <a
                          href={`tel:${selectedRide.captain_phone}`}
                          className="p-2 rounded-xl bg-slate-800 hover:bg-emerald-500 hover:text-slate-950 text-slate-300 transition-colors"
                        >
                          <Phone className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-white">
                          {selectedRide.passenger_name || 'Passenger'}
                        </span>
                        <span className="text-xs text-slate-400 font-mono-num">
                          {selectedRide.passenger_phone || 'Registered User'}
                        </span>
                      </div>
                      {selectedRide.passenger_phone && (
                        <a
                          href={`tel:${selectedRide.passenger_phone}`}
                          className="p-2 rounded-xl bg-slate-800 hover:bg-emerald-500 hover:text-slate-950 text-slate-300 transition-colors"
                        >
                          <Phone className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  )}
                </div>

                {/* Copy Summary / Close Receipt Actions */}
                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => handleCopyReceipt(selectedRide)}
                    className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95 border border-slate-700"
                  >
                    {copiedReceipt ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-400" />
                        <span>Copied to Clipboard</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>Copy Receipt</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedRide(null)}
                    className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition-all cursor-pointer active:scale-95 shadow-md"
                  >
                    Back to History
                  </button>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
