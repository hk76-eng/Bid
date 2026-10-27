import React, { useState, useEffect, useRef } from 'react';
import {
  Captain,
  MotorideRide,
  QRCodeSetting,
  FareSettings,
  WalletTransaction,
  TopupDepositRequest,
  MotorideRideStatus,
} from '../types/motoride';
import { MotorideMap } from '../components/common/MotorideMap';
import { RideChatModal } from '../components/common/RideChatModal';
import { TopupChatModal } from '../components/common/TopupChatModal';
import { CaptainPassengerRatingModal } from './CaptainPassengerRatingModal';
import {
  motorideApi,
  getRideAgreedFare,
  mergeRideSafely,
  STATUS_RANK,
  getStatusRank,
  canTransitionStatus,
  shouldApplyIncomingStatus,
  resolveAuthoritativeRide,
  toCanonicalStatus,
} from '../services/motorideApi';
import { realtimeSync } from '../services/realtimeSync';
import { calculateBearingDegrees, calculateRoadDistanceKm } from '../utils/distanceCalculator';
import { supabaseAuth, AuthUser } from '../lib/supabaseAuth';
import { safeStorage } from '../lib/safeStorage';
import { CaptainProfileDrawer } from './CaptainProfileDrawer';
import {
  Bike,
  Power,
  Navigation,
  Navigation2,
  Phone,
  QrCode,
  RotateCw,
  Send,
  AlertCircle,
  Clock,
  MapPin,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Maximize2,
  Minimize2,
  Loader2,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  User,
  Star,
  ShieldCheck,
  LocateFixed,
  Radio,
  TrendingUp,
  X,
  ArrowLeft,
  IndianRupee,
  History,
  Volume2,
  Wallet,
  PlusCircle,
  ArrowUpRight,
  ArrowDownLeft,
  Copy,
  UploadCloud,
} from 'lucide-react';
import defaultRituAvatar from '../assets/images/passenger_ritu_avatar_1790347071742.jpg';
import { MotorideRideHistoryModal } from '../components/MotorideRideHistoryModal';
import { compressImage } from '../utils/imageCompressor';
import { CaptainDocumentsTab } from './CaptainDocumentsTab';

interface CaptainWorkspaceProps {
  captainId?: string;
  captainName?: string;
  currentUser?: AuthUser | null;
  walletBalance?: number;
  onWalletBalanceUpdated?: (newBalance: number) => void;
  onOpenWallet?: () => void;
  onSignOut?: () => void;
  isOnline?: boolean;
  onToggleOnline?: () => void;
  onActiveTripChange?: (isActive: boolean) => void;
}

// Realistic road distance calculator for urban travel proximity
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  return calculateRoadDistanceKm(lat1, lon1, lat2, lon2);
}

// Service / Vehicle Badge Helper (Motobike, Auto, Cab, Courier)
export function getServiceBadge(rideType?: string) {
  switch (rideType?.toLowerCase()) {
    case 'auto':
      return {
        label: 'Auto Rickshaw',
        shortLabel: 'Auto',
        icon: '🛺',
        bg: 'bg-amber-50 text-amber-950 border-amber-300',
        badgeBg: 'bg-amber-100 text-amber-950 border-amber-400',
      };
    case 'car':
      return {
        label: 'Comfort AC Cab',
        shortLabel: 'Cab / Car',
        icon: '🚗',
        bg: 'bg-blue-50 text-blue-950 border-blue-300',
        badgeBg: 'bg-blue-100 text-blue-950 border-blue-400',
      };
    case 'courier':
      return {
        label: 'Courier Parcel',
        shortLabel: 'Courier',
        icon: '📦',
        bg: 'bg-emerald-50 text-emerald-950 border-emerald-300',
        badgeBg: 'bg-emerald-100 text-emerald-950 border-emerald-400',
      };
    case 'bike':
    default:
      return {
        label: 'Motobike',
        shortLabel: 'Motobike',
        icon: '🏍️',
        bg: 'bg-emerald-600 text-white border-emerald-500',
        badgeBg: 'bg-emerald-600 text-white border-emerald-500',
      };
  }
}

// Helper to format ride request elapsed time (e.g. 1 min, 2 min, 15 min)
export function getRequestElapsedText(createdAt?: string | number | Date | null) {
  if (!createdAt) return '1 min';
  const createdMs = typeof createdAt === 'number' ? createdAt : new Date(createdAt).getTime();
  if (isNaN(createdMs) || createdMs <= 0) return '1 min';
  const diffMinutes = Math.max(1, Math.floor((Date.now() - createdMs) / 60000));
  if (diffMinutes >= 60) {
    const hours = Math.floor(diffMinutes / 60);
    return `${hours}h`;
  }
  return `${diffMinutes} min`;
}

export const CaptainWorkspace: React.FC<CaptainWorkspaceProps> = ({
  captainId = '',
  captainName = 'Captain',
  currentUser,
  walletBalance: propWalletBalance,
  onWalletBalanceUpdated,
  onOpenWallet,
  onSignOut,
  isOnline: propIsOnline,
  onToggleOnline: propToggleOnline,
  onActiveTripChange,
}) => {
  // Strictly enforce that authUser is a Captain account, never a passenger account
  const authUser = (currentUser && currentUser.role === 'captain')
    ? currentUser
    : supabaseAuth.getCurrentUserForRole('captain');
  const isMojobiketaxi =
    (authUser?.email?.toLowerCase().trim() === 'mojobiketaxi@gmail.com') ||
    (captainId === 'cpt_mojobiketaxi');
  const storedSavedName = safeStorage.getItem('motoride_captain_name');
  const resolvedInitialName =
    storedSavedName ||
    authUser?.name ||
    (captainName && captainName !== 'Captain' ? captainName : undefined) ||
    (isMojobiketaxi ? 'Hemant kashyap' : 'Captain');

  const [captain, setCaptain] = useState<Captain | null>(() => {
    if (authUser) {
      const effId = isMojobiketaxi ? 'cpt_mojobiketaxi' : (authUser.id || captainId);
      const storedName = safeStorage.getItem('motoride_captain_name');
      const storedPhone = safeStorage.getItem('motoride_captain_phone');
      const storedEmail = safeStorage.getItem('motoride_captain_email');
      const storedModel = safeStorage.getItem('motoride_captain_vehicle_model');
      const storedPlate = safeStorage.getItem('motoride_captain_plate');
      const storedDl = safeStorage.getItem('motoride_captain_dl');
      const storedSos = safeStorage.getItem('motoride_captain_sos');
      const storedAvatar = safeStorage.getItem('motoride_captain_avatar');

      return {
        id: effId,
        profile_id: `prof_${effId}`,
        full_name: storedName || authUser?.name || resolvedInitialName,
        email: storedEmail || authUser?.email || (isMojobiketaxi ? 'mojobiketaxi@gmail.com' : ''),
        phone: storedPhone || authUser?.phone || (isMojobiketaxi ? '+91 9876543210' : ''),
        avatar_url: storedAvatar || authUser.avatarUrl,
        is_online: true,
        is_approved: true,
        is_active: true,
        current_lat: 30.704649,
        current_lng: 76.717873,
        rating: 4.95,
        total_rides: 142,
        vehicle: {
          id: `veh_${effId}`,
          captain_id: effId,
          model: storedModel || authUser?.vehicleModel || (isMojobiketaxi ? 'Honda Activa 6G' : 'Motorcycle'),
          plate_number: storedPlate || authUser?.plateNumber || (isMojobiketaxi ? 'PB65AX9922' : ''),
          vehicle_type: (authUser.vehicleType as any) || 'bike',
          color: 'Black',
          is_active: true,
        },
        license_number: storedDl || '',
        emergency_contact: storedSos || '',
        created_at: authUser.memberSince || '2024-01-01T00:00:00.000Z',
      };
    }
    return null;
  });
  const [internalOnline, setInternalOnline] = useState<boolean>(true);
  const isOnline = propIsOnline !== undefined ? propIsOnline : internalOnline;
  const [availableRides, setAvailableRides] = useState<MotorideRide[]>([]);
  const [activeRide, setActiveRide] = useState<MotorideRide | null>(null);
  const [inspectedRide, setInspectedRide] = useState<MotorideRide | null>(null);
  const [counterFareInput, setCounterFareInput] = useState<{ [rideId: string]: number }>({});
  const [showCounterModal, setShowCounterModal] = useState<string | null>(null);
  const [qrSettings, setQrSettings] = useState<QRCodeSetting | null>(null);
  const [fareSettings, setFareSettings] = useState<FareSettings | null>(null);
  const [walletTransactions, setWalletTransactions] = useState<WalletTransaction[]>([]);
  const [walletBalance, setWalletBalance] = useState<number>(() => {
    if (propWalletBalance !== undefined) return propWalletBalance;
    const cached = safeStorage.getItem('motoride_captain_wallet_balance');
    return cached && !isNaN(Number(cached)) ? Number(cached) : 500;
  });

  // Keep walletBalance in sync with propWalletBalance from main App state
  useEffect(() => {
    if (propWalletBalance !== undefined && propWalletBalance !== walletBalance) {
      setWalletBalance(propWalletBalance);
    }
  }, [propWalletBalance]);
  const [todayIncome, setTodayIncome] = useState<number>(0);
  const [todayCompletedRidesCount, setTodayCompletedRidesCount] = useState<number>(0);
  const [isProfileOpen, setIsProfileOpen] = useState<boolean>(false);
  const [isRideHistoryOpen, setIsRideHistoryOpen] = useState<boolean>(false);
  const [showChatModal, setShowChatModal] = useState<boolean>(false);
  const [hasUnreadMessages, setHasUnreadMessages] = useState<boolean>(false);
  const showChatModalRef = useRef<boolean>(false);
  showChatModalRef.current = showChatModal;
  const [showPassengerRatingModal, setShowPassengerRatingModal] = useState<boolean>(false);
  const [completedRideForRating, setCompletedRideForRating] = useState<MotorideRide | null>(null);
  const [isFinishingRide, setIsFinishingRide] = useState<boolean>(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<boolean>(false);
  const [mapFocusTarget, setMapFocusTarget] = useState<{ lat: number; lng: number; zoom?: number; timestamp: number } | null>(null);

  // Default to false so the map and Captain live GPS position are immediately 100% visible
  const [is100Full, setIs100Full] = useState<boolean>(false);
  const [inspectViewMode, setInspectViewMode] = useState<'both' | 'map' | 'details'>('both');

  // Notify parent container when active ride status changes so top header can be hidden
  useEffect(() => {
    onActiveTripChange?.(Boolean(activeRide));
  }, [activeRide, onActiveTripChange]);

  // Dedicated Wallet Tab, Documents Tab & Payout state
  const [activeTab, setActiveTab] = useState<'requests' | 'wallet' | 'documents'>('requests');
  const [topupAmountInput, setTopupAmountInput] = useState<string>('200');
  const [payoutAmountInput, setPayoutAmountInput] = useState<string>('');
  const [payoutUpiInput, setPayoutUpiInput] = useState<string>('');
  const [isProcessingTopup, setIsProcessingTopup] = useState<boolean>(false);
  const [isProcessingPayout, setIsProcessingPayout] = useState<boolean>(false);
  const [walletMessage, setWalletMessage] = useState<string | null>(null);
  const [copiedUpiToast, setCopiedUpiToast] = useState<boolean>(false);

  // 25-Second Acceptance Countdown Timer State
  const TOTAL_ACCEPTANCE_SECONDS = 25;
  const [acceptanceTimerRideId, setAcceptanceTimerRideId] = useState<string | null>(null);
  const [acceptanceRemainingMs, setAcceptanceRemainingMs] = useState<number>(TOTAL_ACCEPTANCE_SECONDS * 1000);
  const acceptanceStartTimestampRef = useRef<number>(Date.now());
  const autoPassedRideIdsRef = useRef<Set<string>>(new Set());
  const availableRidesRef = useRef<MotorideRide[]>(availableRides);
  availableRidesRef.current = availableRides;

  // Real-time Notification when Passenger Declines Captain's Offer
  const [declinedOfferAlert, setDeclinedOfferAlert] = useState<{
    message: string;
    fare?: number;
    rideId?: string;
  } | null>(null);

  // Live Elapsed Timer Tick (updates "1 min", "2 min", etc. in real time)
  const [, setLiveTimeTick] = useState<number>(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setLiveTimeTick((prev) => prev + 1);
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (declinedOfferAlert) {
      const timer = setTimeout(() => setDeclinedOfferAlert(null), 8000);
      return () => clearTimeout(timer);
    }
  }, [declinedOfferAlert]);

  // Top-Up QR Deposit Proof & Chat state
  const [utrInput, setUtrInput] = useState<string>('');
  const [paymentSlipInput, setPaymentSlipInput] = useState<string | null>(null);
  const [isSubmittingProof, setIsSubmittingProof] = useState<boolean>(false);
  const [captainTopupRequests, setCaptainTopupRequests] = useState<TopupDepositRequest[]>([]);
  const [activeChatRequest, setActiveChatRequest] = useState<TopupDepositRequest | null>(null);

  const loadCaptainTopupRequests = async () => {
    try {
      const list = await motorideApi.getTopupRequests({ captain_id: captainId });
      setCaptainTopupRequests(list);
    } catch {}
  };

  useEffect(() => {
    if (activeTab === 'wallet' && captainId) {
      loadCaptainTopupRequests();
    }
  }, [activeTab, captainId]);

  const handleSubmitDepositProof = async () => {
    const amt = Number(topupAmountInput);
    if (!amt || isNaN(amt) || amt <= 0) {
      alert('Please enter a valid top-up amount');
      return;
    }
    if (!paymentSlipInput) {
      alert('Please upload your payment slip proof or receipt screenshot');
      return;
    }

    setIsSubmittingProof(true);
    try {
      const targetCaptainId = captainId || authUser?.id || captain?.id || safeStorage.getItem('motoride_captain_id') || captain?.phone || authUser?.phone || '';
      const targetCaptainPhone = captain?.phone || authUser?.phone || safeStorage.getItem('motoride_captain_phone') || '';
      const req = await motorideApi.createTopupRequest({
        captain_id: targetCaptainId,
        captain_name: captain?.full_name || captainName || authUser?.name || 'Captain',
        captain_phone: targetCaptainPhone,
        captain_avatar: captain?.avatar_url || '',
        amount: amt,
        utr_number: utrInput.trim(),
        payment_slip_url: paymentSlipInput,
      });

      if (req) {
        setWalletMessage(`✅ Screenshot & payment proof sent successfully! Verification chat opened.`);
        setTimeout(() => setWalletMessage(null), 5000);
        setUtrInput('');
        setPaymentSlipInput(null);
        await loadCaptainTopupRequests();
        setActiveChatRequest(req);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to submit top-up request');
    } finally {
      setIsSubmittingProof(false);
    }
  };

  const handleExecuteTopup = async () => {
    const amt = Number(topupAmountInput);
    if (!amt || isNaN(amt) || amt <= 0) {
      alert('Please enter a valid top-up amount');
      return;
    }
    setIsProcessingTopup(true);
    try {
      const res = await motorideApi.topupWallet(captainId, amt);
      setWalletBalance(res.balance);
      setWalletMessage(`✅ Top-up of ₹${amt} executed successfully! Wallet balance updated.`);
      setTimeout(() => setWalletMessage(null), 4000);
      const w = await motorideApi.getWallet(captainId);
      if (w && w.transactions) setWalletTransactions(w.transactions);
    } catch (err: any) {
      alert(err.message || 'Failed to process top-up');
    } finally {
      setIsProcessingTopup(false);
    }
  };

  const handleExecutePayout = async () => {
    const amt = Number(payoutAmountInput);
    if (!amt || isNaN(amt) || amt <= 0) {
      alert('Please enter a valid payout amount');
      return;
    }
    if (amt > walletBalance) {
      alert(`Insufficient balance. Maximum withdrawable amount is ₹${walletBalance.toFixed(2)}`);
      return;
    }
    if (!payoutUpiInput.trim()) {
      alert('Please enter your UPI ID or Bank account details for payout');
      return;
    }

    setIsProcessingPayout(true);
    try {
      const res = await motorideApi.requestWithdrawal(captainId, amt, payoutUpiInput.trim());
      setWalletBalance(res.balance);
      setWalletMessage(`💸 Payout request of ₹${amt} submitted to ${payoutUpiInput.trim()}! Balance updated.`);
      setTimeout(() => setWalletMessage(null), 4000);
      setPayoutAmountInput('');
      const w = await motorideApi.getWallet(captainId);
      if (w && w.transactions) setWalletTransactions(w.transactions);
    } catch (err: any) {
      alert(err.message || 'Failed to submit payout request');
    } finally {
      setIsProcessingPayout(false);
    }
  };

  const handleCopyUpi = (upiId: string) => {
    navigator.clipboard.writeText(upiId);
    setCopiedUpiToast(true);
    setTimeout(() => setCopiedUpiToast(false), 2000);
  };

  // Component refs to ensure real-time callbacks never miss updates due to stale closures
  const activeRideRef = useRef<MotorideRide | null>(null);
  activeRideRef.current = activeRide;

  const captainRef = useRef<Captain | null>(null);
  captainRef.current = captain;

  const captainIdRef = useRef<string>(captainId);
  captainIdRef.current = captainId;

  const authUserRef = useRef<any>(authUser);
  authUserRef.current = authUser;

  // In-memory set of rated / completed ride IDs to guarantee instant 0ms dismissal without race conditions
  const ratedRideIdsRef = useRef<Set<string>>(new Set<string>());

  const isRideForThisCaptain = (ride: MotorideRide): boolean => {
    if (!ride || !ride.id) return false;
    const currentActive = activeRideRef.current;
    const currentCaptain = captainRef.current;
    const currentCaptainId = captainIdRef.current;
    const currentAuth = authUserRef.current;

    const isMatchCaptainId = (id?: string) => {
      if (!id) return false;
      return (
        id === currentCaptainId ||
        (currentCaptain && id === currentCaptain.id) ||
        (currentAuth && id === currentAuth.id) ||
        (isMojobiketaxi && (id === 'cpt_mojobiketaxi' || id === 'cpt_instant_01')) ||
        id === 'cpt_instant_01'
      );
    };

    const isMatchPhone = (phone?: string) => {
      if (!phone) return false;
      const clean = phone.replace(/[\s\-\+]/g, '');
      const capPhone = currentCaptain?.phone?.replace(/[\s\-\+]/g, '');
      const authPhone = currentAuth?.phone?.replace(/[\s\-\+]/g, '');
      return (
        Boolean(capPhone && (clean === capPhone || clean.endsWith(capPhone) || capPhone.endsWith(clean))) ||
        Boolean(authPhone && (clean === authPhone || clean.endsWith(authPhone) || authPhone.endsWith(clean)))
      );
    };

    // 1. Matches active ride currently on captain's screen
    if (currentActive && currentActive.id === ride.id) return true;

    // 2. Matches stored active captain ride ID in localStorage
    const storedActiveId = safeStorage.getItem('motoride_active_captain_ride_id');
    if (storedActiveId && storedActiveId === ride.id) return true;

    // 3. Matches captain_id to any known identifier for this captain session
    if (ride.captain_id && isMatchCaptainId(ride.captain_id)) {
      return true;
    }

    // 4. Matches captain phone
    if (ride.captain_phone && isMatchPhone(ride.captain_phone)) {
      return true;
    }

    // 5. Matches accepted offer belonging to this captain
    if (Array.isArray(ride.offers) && ride.offers.length > 0) {
      const hasAcceptedOfferForMe = ride.offers.some(
        (o) => o.status === 'accepted' && (isMatchCaptainId(o.captain_id) || isMatchPhone(o.captain_phone))
      );
      if (hasAcceptedOfferForMe) return true;

      // In initial requested/counter-offered state, any offer placed by this captain matches
      if (ride.status === 'requested' || ride.status === 'captain_offered') {
        const hasMyOffer = ride.offers.some(
          (o) => isMatchCaptainId(o.captain_id) || isMatchPhone(o.captain_phone)
        );
        if (hasMyOffer) return true;
      }
    }

    return false;
  };

  // Captain Real-Time GPS Tracking State (Immediate restore from localStorage + live watchPosition)
  const [captainGps, setCaptainGps] = useState<{
    lat: number;
    lng: number;
    accuracy: number | null;
    heading: number | null;
    speed: number | null;
    timestamp: number;
  }>(() => {
    try {
      const cached = localStorage.getItem('motoride_last_captain_gps');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.lat && parsed.lng) {
          return {
            lat: parsed.lat,
            lng: parsed.lng,
            accuracy: parsed.accuracy ?? 15,
            heading: parsed.heading ?? 45,
            speed: parsed.speed ?? 0,
            timestamp: Date.now(),
          };
        }
      }
    } catch {}
    // Fallback: check if passenger GPS was cached on this device
    try {
      const passengerSaved = safeStorage.getItem('motoride_last_passenger_gps');
      if (passengerSaved) {
        const pParsed = JSON.parse(passengerSaved);
        if (pParsed.lat && pParsed.lng) {
          return {
            lat: pParsed.lat,
            lng: pParsed.lng,
            accuracy: 15,
            heading: 45,
            speed: 0,
            timestamp: Date.now(),
          };
        }
      }
    } catch {}

    return {
      lat: 30.704649,
      lng: 76.717873,
      accuracy: 15,
      heading: 45,
      speed: 0,
      timestamp: Date.now(),
    };
  });

  const [gpsStatus, setGpsStatus] = useState<'idle' | 'acquiring' | 'live' | 'denied' | 'unavailable' | 'timeout'>('acquiring');
  const [gpsErrorMessage, setGpsErrorMessage] = useState<string | null>(null);
  const [lastUploadedAt, setLastUploadedAt] = useState<number>(0);
  const watchIdRef = useRef<number | null>(null);
  const lastUploadedGpsRef = useRef<{ lat: number; lng: number; time: number }>({
    lat: 0,
    lng: 0,
    time: 0,
  });

  // Real-Time Passenger Live GPS Tracking (from Supabase)
  const [passengerLiveGps, setPassengerLiveGps] = useState<{
    latitude: number;
    longitude: number;
    accuracy?: number | null;
    heading?: number | null;
    speed?: number | null;
    updated_at?: string;
  } | null>(null);
  const [nowTick, setNowTick] = useState<number>(Date.now());

  // 5s ticker for checking stale signal
  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 5000);
    return () => clearInterval(timer);
  }, []);

  const getCaptainRatedRideIds = (cid: string): string[] => {
    try {
      const set = new Set<string>(ratedRideIdsRef.current);
      const keys = [
        'motoride_captain_rated_rides',
        ...(cid ? [`motoride_captain_rated_rides_${cid}`] : []),
        ...(captainId ? [`motoride_captain_rated_rides_${captainId}`] : []),
        ...(captain?.id ? [`motoride_captain_rated_rides_${captain.id}`] : []),
        ...(authUser?.id ? [`motoride_captain_rated_rides_${authUser.id}`] : []),
      ];
      keys.forEach((k) => {
        try {
          const arr = JSON.parse(safeStorage.getItem(k) || '[]');
          if (Array.isArray(arr)) {
            arr.forEach((id) => set.add(id));
          }
        } catch {}
      });
      return Array.from(set);
    } catch {
      return Array.from(ratedRideIdsRef.current);
    }
  };

  const markCaptainRideAsRated = (cid: string, rideId: string) => {
    try {
      ratedRideIdsRef.current.add(rideId);
      const keysToSave = [
        'motoride_captain_rated_rides',
        ...(cid ? [`motoride_captain_rated_rides_${cid}`] : []),
        ...(captainId ? [`motoride_captain_rated_rides_${captainId}`] : []),
        ...(captain?.id ? [`motoride_captain_rated_rides_${captain.id}`] : []),
        ...(authUser?.id ? [`motoride_captain_rated_rides_${authUser.id}`] : []),
      ];
      keysToSave.forEach((key) => {
        try {
          const list: string[] = JSON.parse(safeStorage.getItem(key) || '[]');
          if (!list.includes(rideId)) {
            list.push(rideId);
            safeStorage.setItem(key, JSON.stringify(list));
          }
        } catch {}
      });
    } catch {}
  };

  // Captain Live GPS Geolocation Engine (navigator.geolocation.watchPosition)
  const handlePositionSuccess = (position: GeolocationPosition) => {
    const { latitude, longitude, accuracy, heading, speed } = position.coords;
    const now = position.timestamp || Date.now();

    setCaptainGps({
      lat: latitude,
      lng: longitude,
      accuracy: accuracy ?? 15,
      heading: heading ?? null,
      speed: speed ?? null,
      timestamp: now,
    });
    setGpsStatus('live');
    setGpsErrorMessage(null);

    // Save in localStorage for immediate restoration on next app opening
    try {
      localStorage.setItem(
        'motoride_last_captain_gps',
        JSON.stringify({ lat: latitude, lng: longitude, accuracy, heading, speed })
      );
    } catch {}

    setCaptain((prev) => prev ? { ...prev, current_lat: latitude, current_lng: longitude } : prev);

    // Sync to Supabase & Backend:
    const prev = lastUploadedGpsRef.current;
    const distM = calculateDistance(prev.lat, prev.lng, latitude, longitude) * 1000;
    const timeDelta = now - prev.time;

    if (distM >= 2 || timeDelta >= 2000 || prev.time === 0) {
      lastUploadedGpsRef.current = { lat: latitude, lng: longitude, time: now };
      setLastUploadedAt(now);

      const targetCapId = captainId || captain?.id || authUser?.id || safeStorage.getItem('motoride_captain_id') || '';
      const effName = captain?.full_name || captainName || authUser?.name || safeStorage.getItem('motoride_captain_name') || 'Captain';
      const effEmail = captain?.email || authUser?.email || '';
      const effPhone = captain?.phone || authUser?.phone || safeStorage.getItem('motoride_captain_phone') || '';

      if (targetCapId) {
        motorideApi
          .updateCaptainLiveLocation({
            captain_id: targetCapId,
            name: effName,
            email: effEmail,
            phone: effPhone,
            ride_id: activeRide?.id || null,
            latitude,
            longitude,
            accuracy: accuracy ?? null,
            heading: heading ?? null,
            speed: speed ?? null,
          })
          .catch((err) => console.warn('Supabase captain live location sync notice:', err));
      }
    }
  };

  const handlePositionError = (err: GeolocationPositionError) => {
    console.warn('Captain Geolocation notice:', err.code, err.message);
    if (err.code === 1) {
      setGpsStatus('denied');
      setGpsErrorMessage('Please allow location access to track your live captain position.');
    } else if (err.code === 2) {
      setGpsStatus('unavailable');
      setGpsErrorMessage('Device GPS signal unavailable. Please ensure location is enabled.');
    } else if (err.code === 3) {
      setGpsStatus('timeout');
      setGpsErrorMessage('GPS request timed out. Retrying connection...');
    } else {
      setGpsStatus('denied');
      setGpsErrorMessage('Please enable location access.');
    }
  };

  const startWatchingLocation = () => {
    if (watchIdRef.current !== null && 'geolocation' in navigator) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    if (!('geolocation' in navigator)) {
      setGpsStatus('unavailable');
      setGpsErrorMessage('Geolocation API is not supported in this browser.');
      return;
    }

    setGpsStatus('acquiring');
    setGpsErrorMessage(null);

    // Immediate one-off get for instant position acquisition
    try {
      navigator.geolocation.getCurrentPosition(
        (pos) => handlePositionSuccess(pos),
        (err) => {
          // Fallback to low accuracy if high accuracy fails
          try {
            navigator.geolocation.getCurrentPosition(
              (pos) => handlePositionSuccess(pos),
              (finalErr) => handlePositionError(finalErr),
              { enableHighAccuracy: false, timeout: 10000, maximumAge: 30000 }
            );
          } catch {}
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 5000 }
      );
    } catch (e) {
      console.warn('Initial captain geolocation attempt caught:', e);
    }

    // Continuous watch
    try {
      const id = navigator.geolocation.watchPosition(
        (pos) => handlePositionSuccess(pos),
        (err) => {
          if (gpsStatus === 'acquiring') {
            handlePositionError(err);
          }
        },
        {
          enableHighAccuracy: true,
          maximumAge: 1500,
          timeout: 10000,
        }
      );
      watchIdRef.current = id;
    } catch (e) {
      console.warn('Captain watchPosition setup error:', e);
    }
  };

  useEffect(() => {
    // Start watching location immediately without delay for instant GPS acquisition
    startWatchingLocation();
    return () => {
      if (watchIdRef.current !== null && 'geolocation' in navigator) {
        try {
          navigator.geolocation.clearWatch(watchIdRef.current);
        } catch {}
        watchIdRef.current = null;
      }
    };
  }, [captainId, activeRide?.id]);

  // Subscribe to Passenger Live Location from Supabase when ride is active
  useEffect(() => {
    if (!activeRide) {
      setPassengerLiveGps(null);
      return;
    }

    // 1. Fetch latest persisted location from Supabase
    motorideApi
      .getPassengerLiveLocation(activeRide.id, activeRide.passenger_id)
      .then((loc) => {
        if (loc) {
          setPassengerLiveGps(loc);
        }
      })
      .catch((err) => console.warn('Captain fetch passenger location notice:', err));

    // 2. Subscribe to live changes emitted by Supabase postgres_changes
    const unsub = realtimeSync.on('PASSENGER_LOCATION_UPDATED', (loc: {
      passenger_id: string;
      ride_id: string | null;
      latitude: number;
      longitude: number;
      accuracy?: number | null;
      heading?: number | null;
      speed?: number | null;
      updated_at?: string;
    }) => {
      if (
        (loc.ride_id && loc.ride_id === activeRide.id) ||
        loc.passenger_id === activeRide.passenger_id
      ) {
        setPassengerLiveGps(loc);
      }
    });

    return () => {
      unsub();
    };
  }, [activeRide?.id, activeRide?.passenger_id]);

  useEffect(() => {
    loadCaptainData();
    loadAvailableRides();
    loadActiveRide();
    loadSettings();

    // Listen to real-time events
    const unsubRideCreated = realtimeSync.on('RIDE_CREATED', (newRide: MotorideRide) => {
      if (!newRide || !newRide.id || newRide.id.includes('demo') || newRide.passenger_id === 'usr_demo_100') {
        return;
      }
      if (newRide.status !== 'requested' && newRide.status !== 'captain_offered') {
        return;
      }
      if (newRide.status?.includes('cancelled')) {
        return;
      }
      // Never accept stale requests created more than 120 seconds ago
      if (Date.now() - new Date(newRide.created_at || 0).getTime() > 120000) {
        return;
      }
      setAvailableRides((prev) => {
        const exists = prev.some((r) => r.id === newRide.id);
        if (exists) {
          return prev.map((r) => (r.id === newRide.id ? { ...r, ...newRide } : r));
        }
        return [newRide, ...prev.filter((r) => !r.id.includes('demo') && r.passenger_id !== 'usr_demo_100' && !r.status?.includes('cancelled'))];
      });
      setIs100Full(true);
      // Vibrate mobile device when new ride arrives
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate([100, 50, 100]);
        } catch {}
      }
    });

    const handleCaptainRideUpdate = (updatedRide: MotorideRide) => {
      if (!updatedRide || !updatedRide.id) return;
      if (isRideForThisCaptain(updatedRide)) {
        const ratedIds = getCaptainRatedRideIds(captainIdRef.current || captainRef.current?.id || '');
        const isRatedOrDone = updatedRide.captain_rated || ratedIds.includes(updatedRide.id);

        if (
          updatedRide.status?.includes('cancelled') ||
          isRatedOrDone
        ) {
          safeStorage.removeItem('motoride_active_captain_ride_id');
          if (activeRideRef.current?.id === updatedRide.id) {
            activeRideRef.current = null;
            setActiveRide(null);
          }
          setShowPassengerRatingModal(false);
          setCompletedRideForRating(null);
          loadCaptainData();
        } else {
          // If captain currently has an active live ride, strictly block updates from any other ride ID
          if (activeRideRef.current && activeRideRef.current.id !== updatedRide.id) {
            const currentRank = STATUS_RANK[activeRideRef.current.status] || 0;
            if (currentRank >= 3 && currentRank <= 5 && !activeRideRef.current.status.includes('cancelled')) {
              return; // Ignore other rides
            }
          }
          // Guard against stale backwards status transition
          if (activeRideRef.current && activeRideRef.current.id === updatedRide.id) {
            if (!shouldApplyIncomingStatus(activeRideRef.current.status, updatedRide.status)) {
              console.warn(
                `[Captain Realtime] Blocked backwards status transition from ${activeRideRef.current.status} to ${updatedRide.status}`
              );
              return;
            }
          }

          safeStorage.setItem('motoride_active_captain_ride_id', updatedRide.id);
          setActiveRide((prev) => resolveAuthoritativeRide(prev, updatedRide));

          if (updatedRide.status === 'captain_accepted' || updatedRide.status === 'accepted') {
            setInspectedRide(null);
            setAcceptanceTimerRideId(null);
            setIs100Full(false);
            if (!activeRideRef.current || (activeRideRef.current.status !== 'captain_accepted' && activeRideRef.current.status !== 'accepted')) {
              playRideAcceptedTune();
            }
          }

          if ((updatedRide.status === 'completed' || updatedRide.status === 'trip_completed') && !updatedRide.captain_rated && !ratedIds.includes(updatedRide.id)) {
            setCompletedRideForRating(updatedRide);
            setShowPassengerRatingModal(true);
          } else if (isRatedOrDone) {
            setShowPassengerRatingModal(false);
            setCompletedRideForRating(null);
          }
        }
      }

      if (updatedRide.status?.includes('cancelled') || (updatedRide.status !== 'requested' && updatedRide.status !== 'captain_offered')) {
        setInspectedRide((prev) => (prev?.id === updatedRide.id ? null : prev));
        setAcceptanceTimerRideId((prev) => (prev === updatedRide.id ? null : prev));
      }

      setAvailableRides((prev) => {
        const myCapId = captainIdRef.current || captainRef.current?.id || authUserRef.current?.id;
        if (updatedRide.status?.includes('cancelled') || (updatedRide.status !== 'requested' && updatedRide.status !== 'captain_offered')) {
          return prev.filter((r) => r.id !== updatedRide.id);
        }
        if (myCapId && updatedRide.declined_captain_ids?.includes(myCapId)) {
          return prev.filter((r) => r.id !== updatedRide.id);
        }
        const exists = prev.some((r) => r.id === updatedRide.id);
        if (exists) {
          return prev.map((r) => (r.id === updatedRide.id ? mergeRideSafely(r, updatedRide) : r));
        }
        return [updatedRide, ...prev];
      });
    };

    const unsubRideUpdated = realtimeSync.on('RIDE_UPDATED', handleCaptainRideUpdate);
    const unsubRideStatusChanged = realtimeSync.on('RIDE_STATUS_CHANGED', (payload: any) => {
      const ride = payload?.ride || payload;
      if (ride) handleCaptainRideUpdate(ride);
    });

    const unsubRideAccepted = realtimeSync.on('RIDE_ACCEPTED', (acceptedRide: MotorideRide) => {
      if (!acceptedRide || !acceptedRide.id) return;
      if (isRideForThisCaptain(acceptedRide)) {
        safeStorage.setItem('motoride_active_captain_ride_id', acceptedRide.id);
        setActiveRide(acceptedRide);
        setInspectedRide(null);
        setAcceptanceTimerRideId(null);
        setIs100Full(false);
        playRideAcceptedTune();
      }
      setAvailableRides((prev) => prev.filter((r) => r.id !== acceptedRide.id));
    });

    const unsubRideOffer = realtimeSync.on('RIDE_OFFER_RECEIVED', (payload: any) => {
      const ride = payload?.ride;
      if (ride && ride.id) {
        setAvailableRides((prev) => {
          const exists = prev.some((r) => r.id === ride.id);
          if (exists) {
            return prev.map((r) => (r.id === ride.id ? mergeRideSafely(r, ride) : r));
          }
          if (ride.status === 'requested' || ride.status === 'captain_offered') {
            return [ride, ...prev];
          }
          return prev;
        });
      }
    });

    const unsubRideDeleted = realtimeSync.on('RIDE_DELETED', (payload: any) => {
      const id = payload?.id || payload?.ride_id;
      if (id) {
        setAvailableRides((prev) => prev.filter((r) => r.id !== id));
      }
    });

    const unsubRideCancelled = realtimeSync.on('RIDE_CANCELLED', (payload: any) => {
      const ride = payload?.ride || payload;
      const rideId = payload?.ride_id || ride?.id;
      if (rideId) {
        setAvailableRides((prev) => prev.filter((r) => r.id !== rideId));
        setInspectedRide((prev) => (prev?.id === rideId ? null : prev));
        setAcceptanceTimerRideId((prev) => (prev === rideId ? null : prev));
        setIs100Full(true);
        if (activeRideRef.current && activeRideRef.current.id === rideId) {
          safeStorage.removeItem('motoride_active_captain_ride_id');
          activeRideRef.current = null;
          setActiveRide(null);
          setShowPassengerRatingModal(false);
          setCompletedRideForRating(null);
          setInspectedRide(null);
          loadCaptainData();
        }
      }
    });

    // Real-time listener: Passenger declined this captain's offer
    const unsubOfferDeclined = realtimeSync.on('RIDE_OFFER_DECLINED', (payload: any) => {
      const myCapId = captainIdRef.current || captainRef.current?.id || authUserRef.current?.id;
      const targetCapId = payload?.captain_id;
      const declinedRideId = payload?.ride_id || payload?.ride?.id;

      if (!targetCapId || targetCapId === myCapId) {
        if (declinedRideId) {
          setAvailableRides((prev) => prev.filter((r) => r.id !== declinedRideId));
          setInspectedRide((prev) => (prev?.id === declinedRideId ? null : prev));
          setAcceptanceTimerRideId((prev) => (prev === declinedRideId ? null : prev));
          setIs100Full(true);
        }
        const fareText = payload?.counter_fare ? ` of ₹${payload.counter_fare}` : '';
        setDeclinedOfferAlert({
          message: payload?.message || `Passenger declined your offer price${fareText}. Passed to other captains.`,
          fare: payload?.counter_fare,
          rideId: declinedRideId,
        });
        playDeclineAlertChime();
      }
      if (payload?.ride) {
        handleCaptainRideUpdate(payload.ride);
      }
    });

    const unsubActiveSync = realtimeSync.on('ACTIVE_RIDES_SYNC_RECEIVED', (rides: MotorideRide[]) => {
      if (Array.isArray(rides) && rides.length > 0) {
        const now = Date.now();
        const myCapId = captainIdRef.current || captainRef.current?.id || authUserRef.current?.id;
        const valid = rides.filter(
          (r) =>
            r &&
            (r.status === 'requested' || r.status === 'captain_offered') &&
            !r.status?.includes('cancelled') &&
            !r.id.includes('demo') &&
            r.passenger_id !== 'usr_demo_100' &&
            (!myCapId || !r.declined_captain_ids?.includes(myCapId)) &&
            // Ignore stale requests older than 120s
            now - new Date(r.created_at || 0).getTime() <= 120000
        );
        if (valid.length > 0) {
          setAvailableRides((prev) => {
            const map = new Map<string, MotorideRide>();
            prev.forEach((r) => {
              if (
                r &&
                !r.status?.includes('cancelled') &&
                now - new Date(r.created_at || 0).getTime() <= 120000
              ) {
                map.set(r.id, r);
              }
            });
            valid.forEach((r) => map.set(r.id, { ...(map.get(r.id) || {}), ...r }));
            return Array.from(map.values()).sort(
              (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            );
          });
        }
      }
    });

    // Real-time synchronization when rides are completed and earnings update
    const unsubEarningsUpdated = realtimeSync.on('EARNINGS_UPDATED', () => {
      loadCaptainData();
    });

    const unsubFareUpdated = realtimeSync.on('FARE_SETTINGS_UPDATED', (fare: FareSettings) => {
      if (fare) setFareSettings(fare);
    });

    const unsubQrUpdated = realtimeSync.on('QR_SETTINGS_UPDATED', (qr: QRCodeSetting) => {
      if (qr) setQrSettings(qr);
    });

    const isPhoneMatch = (p1?: string, p2?: string) => {
      if (!p1 || !p2) return false;
      if (p1 === p2) return true;
      const d1 = p1.replace(/\D/g, '').slice(-10);
      const d2 = p2.replace(/\D/g, '').slice(-10);
      return Boolean(d1 && d2 && d1 === d2);
    };

    const unsubTopupUpdated = realtimeSync.on('TOPUP_REQUEST_UPDATED', (payload: any) => {
      loadCaptainTopupRequests();
      loadCaptainData();
      const currentId = captainIdRef.current || captainRef.current?.id || authUserRef.current?.id || '';
      const currentPhone = captainRef.current?.phone || authUserRef.current?.phone || '';
      const reqCaptId = payload?.request?.captain_id || payload?.user_id || payload?.captain_id || '';
      const reqCaptPhone = payload?.request?.captain_phone || payload?.phone || '';
      const isMyTopup = (
        (reqCaptId && (reqCaptId === currentId || reqCaptId === currentPhone || reqCaptId === authUserRef.current?.id || isPhoneMatch(reqCaptId, currentPhone))) ||
        (reqCaptPhone && (reqCaptPhone === currentPhone || reqCaptPhone === currentId || isPhoneMatch(reqCaptPhone, currentPhone) || isPhoneMatch(reqCaptPhone, currentId))) ||
        (payload?.profile_id && (payload.profile_id === currentId || payload.profile_id === authUserRef.current?.id))
      );

      if (isMyTopup) {
        if (payload?.wallet?.balance !== undefined) {
          setWalletBalance(payload.wallet.balance);
        }
        if (payload?.status === 'approved' || payload?.request?.status === 'approved') {
          setWalletMessage(`🎉 Payment verified! Your wallet has been credited immediately.`);
          setTimeout(() => setWalletMessage(null), 5000);
        }
      }
    });

    const unsubWalletUpdated = realtimeSync.on('WALLET_UPDATED', (payload: any) => {
      const currentId = captainIdRef.current || captainRef.current?.id || authUserRef.current?.id || '';
      const currentPhone = captainRef.current?.phone || authUserRef.current?.phone || '';
      const targetId = payload?.user_id || payload?.captain_id || '';
      const targetPhone = payload?.phone || '';
      const isMyWallet = (
        (targetId && (targetId === currentId || targetId === currentPhone || targetId === authUserRef.current?.id || isPhoneMatch(targetId, currentPhone))) ||
        (targetPhone && (targetPhone === currentPhone || targetPhone === currentId || isPhoneMatch(targetPhone, currentPhone) || isPhoneMatch(targetPhone, currentId))) ||
        (payload?.profile_id && (payload.profile_id === currentId || payload.profile_id === authUserRef.current?.id))
      );

      if (isMyWallet) {
        if (typeof payload?.balance === 'number') {
          setWalletBalance(payload.balance);
        }
        loadCaptainData();
      }
    });

    const unsubProfilesUpdated = realtimeSync.on('PROFILES_UPDATED', (prof: any) => {
      const currentId = captainIdRef.current || captainRef.current?.id || authUserRef.current?.id || '';
      const currentPhone = captainRef.current?.phone || authUserRef.current?.phone || '';
      if (prof && (prof.id === currentId || prof.phone === currentPhone || prof.phone === currentId || prof.id === authUserRef.current?.id || isPhoneMatch(prof.phone, currentPhone))) {
        if (typeof prof.wallet_balance === 'number') {
          setWalletBalance(prof.wallet_balance);
        }
      }
    });

    // Automatic daily reset: check if the calendar date changed in the local business timezone (Asia/Kolkata)
    // When midnight passes, Today's Income automatically resets to ₹0 without requiring manual actions.
    let lastCheckedDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
    const rolloverInterval = setInterval(() => {
      const currentDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
      if (currentDate !== lastCheckedDate) {
        lastCheckedDate = currentDate;
        loadCaptainData();
      }
    }, 10000);

    // Continuous 2.5-second polling to ensure cross-browser/mobile sync even if SSE sleeps on mobile
    let pollCount = 0;
    const pollInterval = setInterval(() => {
      loadAvailableRides();
      loadActiveRide();
      pollCount++;
      // Sync captain data and wallet balance every 2 ticks (~5s)
      if (pollCount % 2 === 0) {
        loadCaptainData();
        if (activeTab === 'wallet') {
          loadCaptainTopupRequests();
        }
      }
    }, 2500);

    // Immediate re-fetch when switching back to mobile browser tab or storage changes
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        loadAvailableRides();
        loadActiveRide();
        loadCaptainData();
        loadSettings();
      }
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (
        e.key === 'motoride_active_rides_cache' ||
        e.key === 'motoride_rides_store' ||
        e.key === 'motoride_realtime_ping'
      ) {
        loadAvailableRides();
        loadActiveRide();
      }
    };

    window.addEventListener('focus', handleVisibility);
    window.addEventListener('storage', handleStorageChange);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      unsubRideCreated();
      unsubRideUpdated();
      unsubRideStatusChanged();
      unsubRideAccepted();
      unsubRideOffer();
      unsubRideDeleted();
      unsubRideCancelled();
      unsubOfferDeclined();
      unsubActiveSync();
      unsubEarningsUpdated();
      unsubFareUpdated();
      unsubQrUpdated();
      unsubTopupUpdated();
      unsubWalletUpdated();
      unsubProfilesUpdated();
      clearInterval(rolloverInterval);
      clearInterval(pollInterval);
      window.removeEventListener('focus', handleVisibility);
      window.removeEventListener('storage', handleStorageChange);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [captainId, activeRide?.id]);

  // Dedicated Supabase Realtime channel subscription for the active ride
  useEffect(() => {
    if (!activeRide?.id) return;
    const rideId = activeRide.id;
    let isCancelled = false;

    const unsubSpecificRide = motorideApi.subscribeToRide(rideId, (latestRide) => {
      if (isCancelled || !latestRide) return;
      if (!shouldApplyIncomingStatus(activeRideRef.current?.status, latestRide.status)) {
        return; // Drop stale backwards status
      }
      const ratedIds = getCaptainRatedRideIds(captainIdRef.current || captainRef.current?.id || '');
      const isRatedOrDone = latestRide.captain_rated || ratedIds.includes(latestRide.id);
      if (
        latestRide.status?.includes('cancelled') ||
        isRatedOrDone
      ) {
        safeStorage.removeItem('motoride_active_captain_ride_id');
        activeRideRef.current = null;
        setActiveRide(null);
        setShowPassengerRatingModal(false);
        setCompletedRideForRating(null);
        loadCaptainData();
      } else {
        safeStorage.setItem('motoride_active_captain_ride_id', latestRide.id);
        setActiveRide((prev) => resolveAuthoritativeRide(prev, latestRide));
        if (
          (latestRide.status === 'completed' || latestRide.status === 'trip_completed') &&
          !latestRide.captain_rated &&
          !ratedIds.includes(latestRide.id)
        ) {
          setCompletedRideForRating(latestRide);
          setShowPassengerRatingModal(true);
        } else if (isRatedOrDone) {
          setShowPassengerRatingModal(false);
          setCompletedRideForRating(null);
        }
      }
    });

    return () => {
      isCancelled = true;
      unsubSpecificRide();
    };
  }, [activeRide?.id]);

  useEffect(() => {
    if (inspectedRide && (inspectedRide.id.includes('demo') || inspectedRide.passenger_id === 'usr_demo_100')) {
      setInspectedRide(null);
    }
  }, [inspectedRide]);

  // Active ride live movement simulator: moves captain to Location A during 'captain_accepted', and to Location B during 'trip_started'
  useEffect(() => {
    if (!activeRide) return;

    const canonicalStatus = toCanonicalStatus(activeRide.status);
    const isAccepted = canonicalStatus === 'accepted';
    const isTripStarted = canonicalStatus === 'in_progress';

    if (!isAccepted && !isTripStarted) return;

    const interval = setInterval(() => {
      const targetLat = isAccepted ? activeRide.pickup_lat : activeRide.dropoff_lat;
      const targetLng = isAccepted ? activeRide.pickup_lng : activeRide.dropoff_lng;

      setCaptainGps((prev) => {
        const dLat = targetLat - prev.lat;
        const dLng = targetLng - prev.lng;
        const dist = Math.hypot(dLat, dLng);

        if (dist < 0.0001) {
          return prev;
        }

        // Advance smoothly towards target
        const fraction = Math.max(0.12, Math.min(0.25, 0.0004 / (dist || 1)));
        const newLat = prev.lat + dLat * fraction;
        const newLng = prev.lng + dLng * fraction;
        const fixedLat = Number(newLat.toFixed(6));
        const fixedLng = Number(newLng.toFixed(6));

        const heading = calculateBearingDegrees(prev.lat, prev.lng, targetLat, targetLng);
        const speed = isTripStarted ? 35 : 25;

        motorideApi.updateCaptainLiveLocation({
          captain_id: captainId,
          ride_id: activeRide.id,
          latitude: fixedLat,
          longitude: fixedLng,
          heading,
          speed,
        });

        return {
          ...prev,
          lat: fixedLat,
          lng: fixedLng,
          heading,
          speed,
          timestamp: Date.now(),
        };
      });
    }, 1800);

    return () => clearInterval(interval);
  }, [activeRide?.id, activeRide?.status, captainId]);

  const loadCaptainData = async () => {
    try {
      const effCapId = isMojobiketaxi ? 'cpt_mojobiketaxi' : (captainId || authUser?.id || '');
      const cpt = await motorideApi.getCaptainById(effCapId);
      if (cpt) {
        const isMojo = (cpt.email?.toLowerCase().trim() === 'mojobiketaxi@gmail.com') || isMojobiketaxi;
        const storedName = safeStorage.getItem('motoride_captain_name');
        const storedPhone = safeStorage.getItem('motoride_captain_phone');
        const storedEmail = safeStorage.getItem('motoride_captain_email');
        const storedModel = safeStorage.getItem('motoride_captain_vehicle_model');
        const storedPlate = safeStorage.getItem('motoride_captain_plate');
        const storedDl = safeStorage.getItem('motoride_captain_dl');
        const storedSos = safeStorage.getItem('motoride_captain_sos');
        const storedAvatar = safeStorage.getItem('motoride_captain_avatar');

        const resolvedName = storedName || cpt.full_name || authUser?.name || resolvedInitialName || (isMojo ? 'Hemant kashyap' : 'Captain');
        const resolvedPhone = storedPhone || cpt.phone || authUser?.phone || (isMojo ? '+91 9876543210' : '');
        const resolvedEmail = storedEmail || cpt.email || authUser?.email || (isMojo ? 'mojobiketaxi@gmail.com' : '');
        const resolvedModel = storedModel || cpt.vehicle?.model || (authUser as any)?.vehicleModel || (isMojo ? 'Honda Activa 6G' : 'Motorcycle');
        const resolvedPlate = storedPlate || cpt.vehicle?.plate_number || (authUser as any)?.plateNumber || (isMojo ? 'PB65AX9922' : '');

        setCaptain((prev) => ({
          ...(prev || ({} as Captain)),
          ...cpt,
          full_name: resolvedName,
          email: resolvedEmail,
          phone: resolvedPhone,
          avatar_url: storedAvatar || cpt.avatar_url || prev?.avatar_url,
          vehicle: {
            id: isMojo ? 'veh_cpt_mojobiketaxi' : (cpt.vehicle?.id || (prev?.vehicle?.id ?? 'veh_1')),
            captain_id: isMojo ? 'cpt_mojobiketaxi' : effCapId,
            is_active: true,
            model: resolvedModel,
            plate_number: resolvedPlate,
            vehicle_type: cpt.vehicle?.vehicle_type || prev?.vehicle?.vehicle_type || 'bike',
            color: cpt.vehicle?.color || prev?.vehicle?.color || 'Black',
          },
          license_number: storedDl || (cpt as any).license_number || (prev as any)?.license_number || '',
          emergency_contact: storedSos || (cpt as any).emergency_contact || (prev as any)?.emergency_contact || '',
        }));
        setInternalOnline(Boolean(cpt.is_online));
      }
      const targetCaptainId = isMojobiketaxi ? 'cpt_mojobiketaxi' : (captainId || authUser?.id || captain?.id || safeStorage.getItem('motoride_captain_id') || '');
      const targetCaptainPhone = safeStorage.getItem('motoride_captain_phone') || captain?.phone || authUser?.phone || (isMojobiketaxi ? '+91 9876543210' : '');
      const w = await motorideApi.getWallet(targetCaptainId, targetCaptainPhone);
      if (w && w.wallet) {
        setWalletBalance(w.wallet.balance || 0);
        setWalletTransactions(w.transactions || []);
        onWalletBalanceUpdated?.(w.wallet.balance || 0);
      }

      // Fetch Today's Income calculated dynamically from the database
      // Only includes rides completed today with status = 'completed' or 'trip_completed'
      try {
        const incomeRes = await motorideApi.getCaptainTodayIncome(captainId);
        if (incomeRes) {
          setTodayIncome(incomeRes.today_income);
          setTodayCompletedRidesCount(incomeRes.completed_rides_today);
        }
      } catch (incomeErr) {
        console.warn('Today income fetch notice:', incomeErr);
      }
    } catch {}
  };

  // Play arrival confirmation chime when captain arrives at pickup
  const playCaptainArrivedTune = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        const ctx = new AudioContextClass();
        if (ctx.state === 'suspended') {
          ctx.resume();
        }

        const notes = [
          { f: 880.00, t: 0.0, d: 0.45, v: 0.4 },
          { f: 659.25, t: 0.22, d: 0.55, v: 0.45 },
          { f: 987.77, t: 0.65, d: 0.45, v: 0.4 },
          { f: 1318.51, t: 0.85, d: 0.70, v: 0.5 },
        ];

        notes.forEach(({ f, t, d, v }) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(f, ctx.currentTime + t);

          gain.gain.setValueAtTime(0, ctx.currentTime + t);
          gain.gain.linearRampToValueAtTime(v, ctx.currentTime + t + 0.03);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + d);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(ctx.currentTime + t);
          osc.stop(ctx.currentTime + t + d + 0.05);
        });
      }

      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([200, 100, 200, 100, 300]);
      }
    } catch (e) {
      console.warn('Audio playback notice:', e);
    }
  };

  // Soft nice caller tune alert for incoming ride requests
  const playIncomingCallTune = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      
      const notes = [523.25, 659.25, 783.99, 987.77, 1046.50]; // C5, E5, G5, B5, C6 soft marimba chime
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.12);
        
        gain.gain.setValueAtTime(0, ctx.currentTime + idx * 0.12);
        gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + idx * 0.12 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.12 + 0.35);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start(ctx.currentTime + idx * 0.12);
        osc.stop(ctx.currentTime + idx * 0.12 + 0.4);
      });
    } catch (e) {
      console.warn('Audio playback notice:', e);
    }
  };

  // Play triumphant sound alert when ride is accepted
  const playRideAcceptedTune = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      
      const notes = [659.25, 783.99, 1046.50, 1318.51]; // E5, G5, C6, E6
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.1);
        
        gain.gain.setValueAtTime(0, ctx.currentTime + idx * 0.1);
        gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + idx * 0.1 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.1 + 0.3);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start(ctx.currentTime + idx * 0.1);
        osc.stop(ctx.currentTime + idx * 0.1 + 0.35);
      });

      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([150, 75, 150]);
      }
    } catch (e) {
      console.warn('Audio playback notice:', e);
    }
  };

  // Soft gentle sound when request auto-passes to next request or live requests list
  const playPassChime = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const notes = [783.99, 523.25]; // G5, C5 soft descending whoosh
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.08);
        gain.gain.setValueAtTime(0, ctx.currentTime + idx * 0.08);
        gain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + idx * 0.08 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.08 + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + idx * 0.08);
        osc.stop(ctx.currentTime + idx * 0.08 + 0.3);
      });
    } catch {}
  };

  // Sound alert when passenger declines captain's offer price
  const playDeclineAlertChime = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const notes = [659.25, 523.25, 440.0]; // E5, C5, A4 descending alert
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.1);
        gain.gain.setValueAtTime(0, ctx.currentTime + idx * 0.1);
        gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + idx * 0.1 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.1 + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + idx * 0.1);
        osc.stop(ctx.currentTime + idx * 0.1 + 0.4);
      });
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([150, 100, 150]);
      }
    } catch {}
  };

  // Play exciting sound alert when trip starts
  const playTripStartedTune = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      
      const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98]; // C5, E5, G5, C6, E6, G6
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.08);
        
        gain.gain.setValueAtTime(0, ctx.currentTime + idx * 0.08);
        gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + idx * 0.08 + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.08 + 0.25);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start(ctx.currentTime + idx * 0.08);
        osc.stop(ctx.currentTime + idx * 0.08 + 0.3);
      });

      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([100, 50, 100, 50, 200]);
      }
    } catch (e) {
      console.warn('Audio playback notice:', e);
    }
  };

  // Play subtle sound alert when passenger sends a chat message
  const playMessageNotificationChime = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      if (ctx.state === 'suspended') ctx.resume();

      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(659.25, now);
      gain1.gain.setValueAtTime(0, now);
      gain1.gain.linearRampToValueAtTime(0.18, now + 0.02);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.22);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880, now + 0.1);
      gain2.gain.setValueAtTime(0, now + 0.1);
      gain2.gain.linearRampToValueAtTime(0.22, now + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.1);
      osc2.stop(now + 0.37);

      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([100, 50, 100]);
      }
    } catch (e) {
      console.warn('Audio playback notice:', e);
    }
  };

  // Track unread passenger chat messages across all live ride statuses (including starting & active trip)
  useEffect(() => {
    const isLiveRide = activeRide && activeRide.id && activeRide.status !== 'completed' && activeRide.status !== 'trip_completed' && !activeRide.status.includes('cancelled');
    if (!isLiveRide || !activeRide.id) {
      setHasUnreadMessages(false);
      return;
    }

    const rideId = activeRide.id;

    // Check existing unread messages on mount / ride status change
    const checkUnread = async () => {
      try {
        const msgs = await motorideApi.getRideMessages(rideId);
        const lastRead = Number(safeStorage.getItem(`motoride_last_read_chat_${rideId}`) || '0');
        const hasUnread = msgs.some(
          (m) => m.sender_role === 'passenger' && new Date(m.created_at).getTime() > lastRead
        );
        if (hasUnread && !showChatModalRef.current) {
          setHasUnreadMessages(true);
        }
      } catch {}
    };
    checkUnread();

    // Fast check interval (every 1.5s)
    const interval = setInterval(async () => {
      if (showChatModalRef.current) return;
      try {
        const msgs = await motorideApi.getRideMessages(rideId);
        const lastRead = Number(safeStorage.getItem(`motoride_last_read_chat_${rideId}`) || '0');
        const hasUnread = msgs.some(
          (m) => m.sender_role === 'passenger' && new Date(m.created_at).getTime() > lastRead
        );
        if (hasUnread) {
          setHasUnreadMessages((prev) => {
            if (!prev) playMessageNotificationChime();
            return true;
          });
        }
      } catch {}
    }, 1500);

    // Instant real-time listener for passenger message
    const handleIncoming = (payload: any) => {
      if (payload && payload.ride_id === rideId && payload.sender_role === 'passenger') {
        if (!showChatModalRef.current) {
          setHasUnreadMessages(true);
          playMessageNotificationChime();
        } else {
          safeStorage.setItem(`motoride_last_read_chat_${rideId}`, Date.now().toString());
        }
      }
    };

    const handleCustomMsg = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      if (detail) {
        if (detail.rideId === rideId || detail.ride_id === rideId) {
          checkUnread();
        }
      }
    };

    const handleStorage = (e: StorageEvent) => {
      if (e.key === `motoride_chat_msgs_${rideId}`) {
        checkUnread();
      }
    };

    const unsub = realtimeSync.on('RIDE_MESSAGE_RECEIVED', handleIncoming);
    window.addEventListener('motoride_chat_updated', handleCustomMsg);
    window.addEventListener('motoride_chat_message', handleCustomMsg);
    window.addEventListener('storage', handleStorage);

    return () => {
      clearInterval(interval);
      unsub();
      window.removeEventListener('motoride_chat_updated', handleCustomMsg);
      window.removeEventListener('motoride_chat_message', handleCustomMsg);
      window.removeEventListener('storage', handleStorage);
    };
  }, [activeRide?.id, activeRide?.status]);

  const prevRideIdsRef = useRef<Set<string>>(new Set());
  const isInitializedRef = useRef<boolean>(false);

  useEffect(() => {
    if (!isOnline) {
      isInitializedRef.current = false;
      prevRideIdsRef.current = new Set();
      return;
    }
    const currentIds = new Set(availableRides.map(r => r.id));
    if (!isInitializedRef.current) {
      prevRideIdsRef.current = currentIds;
      isInitializedRef.current = true;
      return;
    }

    let hasNew = false;
    for (const id of currentIds) {
      if (!prevRideIdsRef.current.has(id)) {
        hasNew = true;
        break;
      }
    }
    if (hasNew) {
      playIncomingCallTune();
      setIs100Full(true);
      // Reset auto-pass cache for new incoming requests
      for (const id of currentIds) {
        if (!prevRideIdsRef.current.has(id)) {
          autoPassedRideIdsRef.current.delete(id);
        }
      }
    }
    prevRideIdsRef.current = currentIds;
  }, [availableRides, isOnline]);

  // 25-Second Acceptance Countdown Timer & Auto-Pass Logic
  const handleAutoPass = (expiredRideId: string | null) => {
    if (expiredRideId) {
      autoPassedRideIdsRef.current.add(expiredRideId);
    }

    const currentList = availableRidesRef.current || [];
    if (currentList.length === 0) {
      setInspectedRide(null);
      setAcceptanceTimerRideId(null);
      setIs100Full(true);
      return;
    }

    const currentIndex = currentList.findIndex((r) => r.id === expiredRideId);
    // Find next unpassed ride
    const unpassedRides = currentList.filter((r) => !autoPassedRideIdsRef.current.has(r.id));

    if (unpassedRides.length > 0) {
      const nextRide = unpassedRides[0];
      setInspectedRide(nextRide);
      setAcceptanceTimerRideId(nextRide.id);
      acceptanceStartTimestampRef.current = Date.now();
      setAcceptanceRemainingMs(TOTAL_ACCEPTANCE_SECONDS * 1000);
      playPassChime();
    } else if (currentList.length > 1 && currentIndex !== -1) {
      // Cycle to the next ride in the list
      const nextIndex = (currentIndex + 1) % currentList.length;
      const nextRide = currentList[nextIndex];
      setInspectedRide(nextRide);
      setAcceptanceTimerRideId(nextRide.id);
      acceptanceStartTimestampRef.current = Date.now();
      setAcceptanceRemainingMs(TOTAL_ACCEPTANCE_SECONDS * 1000);
      playPassChime();
    } else {
      // Single ride or all passed: Show the Live Requests List!
      setInspectedRide(null);
      setAcceptanceTimerRideId(null);
      setIs100Full(true);
      playPassChime();
    }
  };

  const handlePassCurrentRequest = () => {
    handleAutoPass(inspectedRide?.id || acceptanceTimerRideId);
  };

  useEffect(() => {
    // If not online, or currently on an active ride, or no available rides, stop timer
    if (!isOnline || activeRide) {
      setAcceptanceTimerRideId(null);
      return;
    }

    const currentList = availableRides;
    if (currentList.length === 0) {
      setAcceptanceTimerRideId(null);
      if (inspectedRide) setInspectedRide(null);
      return;
    }

    // Determine target ride for countdown
    let targetRide = inspectedRide;
    if (!targetRide || !currentList.some((r) => r.id === targetRide?.id)) {
      // If none specifically inspected, target the first unpassed ride
      const unpassed = currentList.find((r) => !autoPassedRideIdsRef.current.has(r.id));
      if (!unpassed) {
        // All available rides have already been auto-passed; do not loop or re-target
        setAcceptanceTimerRideId(null);
        return;
      }
      targetRide = unpassed;
    }

    if (targetRide && targetRide.id !== acceptanceTimerRideId) {
      setAcceptanceTimerRideId(targetRide.id);
      acceptanceStartTimestampRef.current = Date.now();
      setAcceptanceRemainingMs(TOTAL_ACCEPTANCE_SECONDS * 1000);
    }

    const interval = setInterval(() => {
      const elapsed = Date.now() - acceptanceStartTimestampRef.current;
      const remaining = Math.max(0, TOTAL_ACCEPTANCE_SECONDS * 1000 - elapsed);
      setAcceptanceRemainingMs(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
        handleAutoPass(acceptanceTimerRideId || targetRide?.id || null);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [availableRides, inspectedRide?.id, activeRide?.id, isOnline, acceptanceTimerRideId]);

  const countdownSeconds = Math.ceil(acceptanceRemainingMs / 1000);
  const progressPercent = Math.min(
    100,
    Math.max(0, (acceptanceRemainingMs / (TOTAL_ACCEPTANCE_SECONDS * 1000)) * 100)
  );

  const loadAvailableRides = async () => {
    try {
      const myCapId = captainId || captain?.id || authUser?.id;
      if (fareSettings?.require_admin_approval_for_rides && captain && !captain.is_approved) {
        setAvailableRides([]);
        return;
      }
      const list = await motorideApi.getRides({ active_for_captain: true, captain_id: myCapId });
      if (Array.isArray(list)) {
        const realRides = list.filter(
          (r) =>
            r &&
            r.id &&
            !r.id.includes('demo') &&
            r.passenger_id !== 'usr_demo_100' &&
            (!myCapId || !r.declined_captain_ids?.includes(myCapId)) &&
            !r.status?.includes('cancelled')
        );

        // If currently inspected ride was cancelled or is no longer available, dismiss inspection
        setInspectedRide((curr) => {
          if (!curr) return null;
          if (curr.status?.includes('cancelled')) return null;
          const isStillValid = realRides.some((r) => r.id === curr.id);
          return isStillValid ? curr : null;
        });

        setAvailableRides((prev) => {
          const map = new Map<string, MotorideRide>();

          // 1. Authoritative active rides from server
          realRides.forEach((r) => {
            if (
              r &&
              (r.status === 'requested' || r.status === 'captain_offered') &&
              (!myCapId || !r.declined_captain_ids?.includes(myCapId)) &&
              !r.status?.includes('cancelled')
            ) {
              map.set(r.id, r);
            }
          });

          // 2. Only retain brand-new local rides from prev if created within last 3.5s AND not cancelled
          const now = Date.now();
          prev.forEach((r) => {
            if (
              r &&
              (r.status === 'requested' || r.status === 'captain_offered') &&
              (!myCapId || !r.declined_captain_ids?.includes(myCapId)) &&
              !r.status?.includes('cancelled') &&
              !map.has(r.id)
            ) {
              const age = now - new Date(r.created_at || 0).getTime();
              if (age < 3500) {
                map.set(r.id, r);
              }
            }
          });

          const nextList = Array.from(map.values()).sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );

          if (
            prev.length === nextList.length &&
            prev.every(
              (p, i) =>
                p.id === nextList[i]?.id &&
                p.status === nextList[i]?.status &&
                p.offers?.length === nextList[i]?.offers?.length
            )
          ) {
            return prev;
          }

          return nextList;
        });
      }
    } catch (err) {
      console.warn('Captain loadAvailableRides notice:', err);
    }
  };

  const loadActiveRide = async () => {
    try {
      const storedActiveId = safeStorage.getItem('motoride_active_captain_ride_id');
      const targetActiveId = activeRideRef.current?.id || storedActiveId;
      const ratedIds = getCaptainRatedRideIds(captainId || captain?.id || authUser?.id || '');

      // 1. If captain currently has an active ride, prioritize fetching and updating THAT specific ride!
      if (targetActiveId) {
        const specific = await motorideApi.getRideById(targetActiveId);
        if (specific) {
          if (
            specific.status?.includes('cancelled') ||
            specific.status === 'completed' ||
            specific.captain_rated ||
            ratedIds.includes(specific.id)
          ) {
            safeStorage.removeItem('motoride_active_captain_ride_id');
            activeRideRef.current = null;
            setActiveRide(null);
            setShowPassengerRatingModal(false);
            setCompletedRideForRating(null);
            loadCaptainData();
            return;
          }

          safeStorage.setItem('motoride_active_captain_ride_id', specific.id);
          setActiveRide((prev) => resolveAuthoritativeRide(prev, specific));

          if (
            specific.status === 'trip_completed' &&
            !specific.captain_rated &&
            !ratedIds.includes(specific.id)
          ) {
            setCompletedRideForRating(specific);
            setShowPassengerRatingModal(true);
          } else {
            setCompletedRideForRating(null);
            setShowPassengerRatingModal(false);
          }
          return;
        }
      }

      // 2. Only look for a new ride if captain has NO active ride
      const list = await motorideApi.getRides();
      if (Array.isArray(list)) {
        const current = list.find((r) => {
          if (!r || r.id.includes('demo') || r.passenger_id === 'usr_demo_100') return false;
          const canonical = toCanonicalStatus(r.status);
          const isActiveStatus =
            canonical === 'accepted' ||
            canonical === 'captain_arrived' ||
            canonical === 'in_progress' ||
            (canonical === 'completed' && !r.captain_rated && !ratedIds.includes(r.id));
          if (!isActiveStatus) return false;

          return isRideForThisCaptain(r);
        });

        if (current) {
          safeStorage.setItem('motoride_active_captain_ride_id', current.id);
          setActiveRide((prev) => resolveAuthoritativeRide(prev, current));
          if (
            toCanonicalStatus(current.status) === 'completed' &&
            !current.captain_rated &&
            !ratedIds.includes(current.id)
          ) {
            setCompletedRideForRating(current);
            setShowPassengerRatingModal(true);
          } else {
            setCompletedRideForRating(null);
            setShowPassengerRatingModal(false);
          }
        } else {
          const currentLive = activeRideRef.current;
          const isLiveTrip = currentLive && !currentLive.status?.includes('cancelled') && toCanonicalStatus(currentLive.status) !== 'completed';
          if (!isLiveTrip && !targetActiveId) {
            activeRideRef.current = null;
            setActiveRide(null);
            setCompletedRideForRating(null);
            setShowPassengerRatingModal(false);
          }
        }
      }
    } catch {}
  };

  const loadSettings = async () => {
    try {
      const qr = await motorideApi.getQRSettings();
      if (qr) setQrSettings(qr);
      const fare = await motorideApi.getFareSettings();
      if (fare) setFareSettings(fare);
    } catch {}
  };

  const handleToggleOnline = async () => {
    if (propToggleOnline) {
      propToggleOnline();
      return;
    }
    try {
      const nextState = !isOnline;
      setInternalOnline(nextState);
      const targetCapId = captainId || captain?.id || authUser?.id || safeStorage.getItem('motoride_captain_id') || '';
      const lat = captainGps.lat > 0 ? captainGps.lat : undefined;
      const lng = captainGps.lng > 0 ? captainGps.lng : undefined;

      const updated = await motorideApi.toggleCaptainOnline(targetCapId, nextState, lat, lng);
      if (updated && typeof updated.is_online === 'boolean') {
        setInternalOnline(updated.is_online);
      }

      if (nextState && targetCapId && lat && lng) {
        motorideApi.updateCaptainLiveLocation({
          captain_id: targetCapId,
          name: captain?.full_name || captainName || authUser?.name || 'Captain',
          email: captain?.email || authUser?.email || '',
          phone: captain?.phone || authUser?.phone || '',
          latitude: lat,
          longitude: lng,
          heading: captainGps.heading ?? null,
        }).catch(() => {});
      }
    } catch (err: any) {
      console.warn('Failed to toggle status:', err);
    }
  };

  // Accept Ride Immediately
  const handleAcceptRide = async (ride: MotorideRide) => {
    try {
      const savedName = safeStorage.getItem('motoride_captain_name');
      const savedPhone = safeStorage.getItem('motoride_captain_phone');
      const savedModel = safeStorage.getItem('motoride_captain_vehicle_model');
      const savedPlate = safeStorage.getItem('motoride_captain_plate');
      const savedAvatar = safeStorage.getItem('motoride_captain_avatar');

      const resolvedName = isMojobiketaxi
        ? 'Hemant kashyap'
        : ((savedName && savedName.trim() && savedName !== 'Captain' && !savedName.toLowerCase().includes('mojobiketaxi'))
        ? savedName
        : (captain?.full_name && captain.full_name !== 'Captain' && !captain.full_name.toLowerCase().includes('mojobiketaxi'))
        ? captain.full_name
        : (authUser?.name && authUser.name !== 'Captain' && !authUser.name.toLowerCase().includes('mojobiketaxi') ? authUser.name : (resolvedInitialName !== 'Captain' ? resolvedInitialName : 'Captain')));

      const resolvedPhone = savedPhone || captain?.phone || authUser?.phone || '';
      const resolvedModel = savedModel || captain?.vehicle?.model || authUser?.vehicleModel || 'Motorcycle';
      const resolvedPlate = savedPlate || captain?.vehicle?.plate_number || authUser?.plateNumber || '';
      const captainSavedAvatar = savedAvatar || captain?.avatar_url || authUser?.avatarUrl || undefined;

      const resolvedRating = captain?.rating !== undefined ? captain.rating : ((authUser as any)?.rating || 5.0);
      const resolvedTotalRides = captain?.total_rides ?? 0;

      const updated = await motorideApi.acceptRide(ride.id, {
        captain_id: captain?.id || captainId,
        captain_name: resolvedName,
        captain_avatar: captainSavedAvatar,
        captain_phone: resolvedPhone,
        captain_rating: resolvedRating,
        captain_total_rides: resolvedTotalRides,
        vehicle_model: resolvedModel,
        plate_number: resolvedPlate,
        accepted_fare: ride.offered_fare,
      });
      setActiveRide(updated);
      playRideAcceptedTune();
      setAvailableRides((prev) => prev.filter((r) => r.id !== ride.id));
    } catch (err: any) {
      alert(err.message || 'Ride was already accepted by another captain.');
      loadAvailableRides();
    }
  };

  // Send Counter Offer
  const handleSendCounterOffer = async (rideId: string, customFare?: number) => {
    const proposedFare = customFare !== undefined ? customFare : counterFareInput[rideId];
    if (!proposedFare || proposedFare <= 0) {
      alert('Please enter a valid counter fare');
      return;
    }
    try {
      const savedName = safeStorage.getItem('motoride_captain_name');
      const savedPhone = safeStorage.getItem('motoride_captain_phone');
      const savedModel = safeStorage.getItem('motoride_captain_vehicle_model');
      const savedPlate = safeStorage.getItem('motoride_captain_plate');
      const savedAvatar = safeStorage.getItem('motoride_captain_avatar');

      const resolvedName = isMojobiketaxi
        ? 'Hemant kashyap'
        : ((savedName && savedName.trim() && savedName !== 'Captain' && !savedName.toLowerCase().includes('mojobiketaxi'))
        ? savedName
        : (captain?.full_name && captain.full_name !== 'Captain' && !captain.full_name.toLowerCase().includes('mojobiketaxi'))
        ? captain.full_name
        : (authUser?.name && authUser.name !== 'Captain' && !authUser.name.toLowerCase().includes('mojobiketaxi') ? authUser.name : (resolvedInitialName !== 'Captain' ? resolvedInitialName : 'Captain')));

      const resolvedPhone = savedPhone || captain?.phone || authUser?.phone || '';
      const resolvedModel = savedModel || captain?.vehicle?.model || authUser?.vehicleModel || 'Motorcycle';
      const resolvedPlate = savedPlate || captain?.vehicle?.plate_number || authUser?.plateNumber || '';
      const captainSavedAvatar = savedAvatar || captain?.avatar_url || authUser?.avatarUrl || undefined;

      const resolvedRating = captain?.rating !== undefined ? captain.rating : ((authUser as any)?.rating || 5.0);
      const resolvedTotalRides = captain?.total_rides ?? 0;

      await motorideApi.sendCounterOffer(rideId, {
        captain_id: captain?.id || captainId,
        captain_name: resolvedName,
        captain_avatar: captainSavedAvatar,
        captain_phone: resolvedPhone,
        rating: resolvedRating,
        captain_total_rides: resolvedTotalRides,
        total_rides: resolvedTotalRides,
        vehicle_model: resolvedModel,
        plate_number: resolvedPlate,
        counter_fare: proposedFare,
      });
      setShowCounterModal(null);
      loadAvailableRides();
    } catch (err: any) {
      alert(err.message || 'Failed to submit offer');
    }
  };

  const handleUpdateCaptainProfile = async (updated: Partial<Captain>) => {
    setCaptain((prev) => (prev ? { ...prev, ...updated } : null));

    try {
      const user = supabaseAuth.getCurrentUser();
      if (user) {
        if (updated.full_name) user.name = updated.full_name;
        if (updated.phone) user.phone = updated.phone;
        if (updated.email) user.email = updated.email;
        if (updated.avatar_url) user.avatarUrl = updated.avatar_url;
        if (updated.vehicle?.model) user.vehicleModel = updated.vehicle.model;
        if (updated.vehicle?.plate_number) user.plateNumber = updated.vehicle.plate_number;
        safeStorage.setItem('motoride_auth_user', JSON.stringify(user));
        supabaseAuth.setCurrentUser(user);
        supabaseAuth.saveAccount({ ...user, passwordHash: '' });
      }
      if (updated.full_name) safeStorage.setItem('motoride_captain_name', updated.full_name);
      if (updated.phone) safeStorage.setItem('motoride_captain_phone', updated.phone);
      if (updated.email) safeStorage.setItem('motoride_captain_email', updated.email);
      if (updated.avatar_url) safeStorage.setItem('motoride_captain_avatar', updated.avatar_url);
      if (updated.vehicle?.model) safeStorage.setItem('motoride_captain_vehicle_model', updated.vehicle.model);
      if (updated.vehicle?.plate_number) safeStorage.setItem('motoride_captain_plate', updated.vehicle.plate_number);
      if ((updated as any).license_number) safeStorage.setItem('motoride_captain_dl', (updated as any).license_number);
      if ((updated as any).emergency_contact) safeStorage.setItem('motoride_captain_sos', (updated as any).emergency_contact);

      window.dispatchEvent(new Event('motoride_captain_profile_updated'));
    } catch {}

    try {
      const idToUpdate = isMojobiketaxi ? 'cpt_mojobiketaxi' : (captain?.id || captainId || authUser?.id || '');
      if (idToUpdate) {
        await motorideApi.updateCaptainProfile(idToUpdate, {
          full_name: updated.full_name,
          name: updated.full_name,
          phone: updated.phone,
          email: updated.email || captain?.email || authUser?.email,
          avatar_url: updated.avatar_url || captain?.avatar_url,
          vehicle: updated.vehicle,
          license_number: (updated as any).license_number,
          emergency_contact: (updated as any).emergency_contact,
        } as any);
        if (updated.vehicle) {
          await motorideApi.updateCaptainVehicle(idToUpdate, {
            model: updated.vehicle.model,
            plate_number: updated.vehicle.plate_number,
            vehicle_type: updated.vehicle.vehicle_type,
            color: updated.vehicle.color,
          });
        }
      }
    } catch (e) {
      console.warn('Failed to sync captain profile to server:', e);
    }
  };

  // Inspect incoming ride request on map (shows Location A & B markers and route)
  const handleInspectRide = (ride: MotorideRide) => {
    setInspectedRide(ride);
    setInspectViewMode('both');
    setIs100Full(false);
    setAcceptanceTimerRideId(ride.id);
    acceptanceStartTimestampRef.current = Date.now();
    setAcceptanceRemainingMs(TOTAL_ACCEPTANCE_SECONDS * 1000);
    if (!counterFareInput[ride.id]) {
      setCounterFareInput((prev) => ({
        ...prev,
        [ride.id]: ride.offered_fare + 20,
      }));
    }
  };

  // Advance Trip Status: Validates lifecycle, updates Supabase first, and updates UI on confirmed response
  const handleStatusChange = async (nextStatus: MotorideRideStatus) => {
    if (!activeRide || isUpdatingStatus) return;

    const canonicalCurrent = toCanonicalStatus(activeRide.status);
    const canonicalNext = toCanonicalStatus(nextStatus);

    // Validate lifecycle progression rules
    if (canonicalNext === 'captain_arrived') {
      if (canonicalCurrent !== 'accepted') {
        console.warn(`[Captain State Machine] Cannot advance to captain_arrived from "${canonicalCurrent}"`);
        return;
      }
    } else if (canonicalNext === 'in_progress') {
      if (canonicalCurrent !== 'captain_arrived') {
        console.warn(`[Captain State Machine] Cannot advance to in_progress from "${canonicalCurrent}"`);
        return;
      }
    } else if (canonicalNext === 'completed') {
      if (canonicalCurrent !== 'in_progress') {
        console.warn(`[Captain State Machine] Cannot advance to completed from "${canonicalCurrent}"`);
        return;
      }
    }

    if (!canTransitionStatus(activeRide.status, canonicalNext)) {
      console.warn(`[Captain State Machine] Blocked backwards status transition from "${activeRide.status}" to "${canonicalNext}"`);
      return;
    }

    setIsUpdatingStatus(true);
    try {
      if (canonicalNext === 'completed') {
        const agreedFare = getRideAgreedFare(activeRide);
        const compRes = await motorideApi.completeRideWithCommission(
          activeRide.id,
          captainId,
          activeRide,
          agreedFare
        );
        if (!compRes.success && compRes.insufficient_balance) {
          alert('Insufficient wallet balance for 10% platform commission. Please recharge your wallet.');
          setIsUpdatingStatus(false);
          return;
        }

        const confirmedRide = compRes.ride || {
          ...activeRide,
          status: 'completed',
          captain_rated: false,
          updated_at: new Date().toISOString(),
        };

        setActiveRide(confirmedRide);
        setCompletedRideForRating(confirmedRide);
        setShowPassengerRatingModal(true);
      } else {
        const confirmedRide = await motorideApi.updateRideStatus(activeRide.id, canonicalNext, {
          final_distance_km: activeRide.distance_km,
          final_fare: getRideAgreedFare(activeRide),
          ride: activeRide,
          captain_id: captainId,
        });

        // Supabase update confirmed! Update UI and trigger contextual GPS / sounds
        setActiveRide(confirmedRide);
        safeStorage.setItem('motoride_active_captain_ride_id', confirmedRide.id);

        if (canonicalNext === 'captain_arrived') {
          playCaptainArrivedTune();
          setCaptainGps((prev) => ({
            ...prev,
            lat: activeRide.pickup_lat,
            lng: activeRide.pickup_lng,
            timestamp: Date.now(),
          }));
          motorideApi.updateCaptainLiveLocation({
            captain_id: captainId,
            ride_id: activeRide.id,
            latitude: activeRide.pickup_lat,
            longitude: activeRide.pickup_lng,
            heading: calculateBearingDegrees(activeRide.pickup_lat, activeRide.pickup_lng, activeRide.dropoff_lat, activeRide.dropoff_lng),
            speed: 0,
          }).catch(() => {});
        } else if (canonicalNext === 'in_progress') {
          playTripStartedTune();
          const bearing = calculateBearingDegrees(activeRide.pickup_lat, activeRide.pickup_lng, activeRide.dropoff_lat, activeRide.dropoff_lng);
          setCaptainGps((prev) => ({
            ...prev,
            lat: activeRide.pickup_lat,
            lng: activeRide.pickup_lng,
            heading: bearing,
            speed: 28,
            timestamp: Date.now(),
          }));
          motorideApi.updateCaptainLiveLocation({
            captain_id: captainId,
            ride_id: activeRide.id,
            latitude: activeRide.pickup_lat,
            longitude: activeRide.pickup_lng,
            heading: bearing,
            speed: 28,
          }).catch(() => {});
        }
      }
    } catch (err: any) {
      console.error(`[Captain Dashboard] Error advancing ride status to "${canonicalNext}":`, err);
      // Fallback: update local state successfully even if Supabase/network has a connection glitch
      setActiveRide((prev) => prev ? { ...prev, status: canonicalNext, updated_at: new Date().toISOString() } : null);
      if (activeRide?.id) {
        safeStorage.setItem('motoride_active_captain_ride_id', activeRide.id);
      }
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleFinishRideWithRating = async (
    score: number,
    review: string,
    tags: string[],
    skipRating: boolean = false
  ) => {
    const rideToFinish = completedRideForRating || activeRide;
    if (!rideToFinish) {
      setShowPassengerRatingModal(false);
      return;
    }

    const currentCapId = captainId || captain?.id || authUser?.id || '';

    // 0. INSTANT ZERO-LATENCY OPTIMISTIC CLOSE:
    // Mark as rated immediately and clear active ride in 0ms so the modal closes instantly
    // and returns the captain directly to the Live Requests radar screen!
    markCaptainRideAsRated(currentCapId, rideToFinish.id);
    safeStorage.removeItem('motoride_active_captain_ride_id');
    activeRideRef.current = null;
    setActiveRide(null);
    setCompletedRideForRating(null);
    setShowPassengerRatingModal(false);
    setIsFinishingRide(false);

    // Save locally immediately as completed & rated so no background poll or event can resurrect it
    const finishedRide: MotorideRide = {
      ...rideToFinish,
      status: 'completed',
      captain_rated: true,
      payment_status: 'paid',
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    motorideApi.saveRideLocallyDirect(finishedRide);
    loadAvailableRides();

    // 1. Asynchronous non-blocking background processing (commission deduction + rating persistence)
    (async () => {
      try {
        const finalFare = getRideAgreedFare(rideToFinish);

        // Atomic completeRideWithCommission for 10% deduction and low-balance check
        const compRes = await motorideApi.completeRideWithCommission(
          rideToFinish.id,
          currentCapId,
          finishedRide,
          finalFare
        );

        if (!compRes.success && compRes.insufficient_balance) {
          console.warn('Insufficient wallet balance for platform commission');
          setActiveTab('wallet');
          return;
        }

        // Update wallet balance in UI state if changed
        if (compRes.wallet_balance_after !== undefined) {
          const newBal = compRes.wallet_balance_after;
          setWalletBalance(newBal);
          onWalletBalanceUpdated?.(newBal);
          safeStorage.setItem('motoride_captain_wallet_balance', newBal.toString());
          if (currentCapId) {
            safeStorage.setItem(`motoride_wallet_${currentCapId}`, JSON.stringify({ balance: newBal, currency: '₹' }));
          }
          const curr = supabaseAuth.getCurrentUser();
          if (curr) {
            curr.walletBalance = newBal;
            supabaseAuth.setCurrentUser(curr);
            supabaseAuth.saveAccount({ ...curr, passwordHash: '' });
          }
        }

        // Submit Captain's rating for passenger in background
        if (!skipRating && rideToFinish.passenger_id) {
          try {
            await motorideApi.submitRideRating({
              ride_id: rideToFinish.id,
              rater_role: 'captain',
              captain_id: currentCapId,
              passenger_id: rideToFinish.passenger_id,
              score: score || 5,
              review: review,
              tags: tags,
            });
          } catch (ratingErr) {
            console.warn('Rating save error ignored:', ratingErr);
          }
        }

        loadCaptainData();
      } catch (err: any) {
        console.warn('Background finish ride error:', err);
      }
    })();
  };

  const handleCancelTrip = async () => {
    if (!activeRide) return;
    const rideIdToCancel = activeRide.id;
    try {
      setActiveRide(null);
      await motorideApi.updateRideStatus(rideIdToCancel, 'cancelled_by_captain', {
        cancellation_reason: 'Captain cancelled the trip',
      });
      loadCaptainData();
    } catch (err: any) {
      console.warn('Captain cancellation notice:', err);
      loadCaptainData();
    }
  };

  const currentRideOnMap = activeRide || inspectedRide || (availableRides.length > 0 ? availableRides[0] : null);

  // Marker visibility logic:
  // 1. Before ride request accept (inspecting / incoming ride request): show BOTH Marker A and Marker B details on map
  // 2. After captain accepts ride (captain_accepted): show pickup Marker A ONLY on map
  // 3. When captain arrives at pickup (captain_arrived) & starts trip (trip_started): immediately show drop location Marker B ONLY on map
  const canonicalCurrent = activeRide ? toCanonicalStatus(activeRide.status) : null;
  const isAcceptedPhase = canonicalCurrent === 'accepted';
  const isArrivedOrTripPhase = canonicalCurrent === 'captain_arrived' || canonicalCurrent === 'in_progress';

  const showPickupOnMap = isAcceptedPhase || (!activeRide && Boolean(currentRideOnMap));
  const showDropoffOnMap = isArrivedOrTripPhase || (!activeRide && Boolean(currentRideOnMap));

  const currentPickupLat = showPickupOnMap && currentRideOnMap ? currentRideOnMap.pickup_lat : null;
  const currentPickupLng = showPickupOnMap && currentRideOnMap ? currentRideOnMap.pickup_lng : null;
  const currentPickupAddress = showPickupOnMap && currentRideOnMap ? currentRideOnMap.pickup_address : undefined;

  const currentDropoffLat = showDropoffOnMap && currentRideOnMap ? currentRideOnMap.dropoff_lat : null;
  const currentDropoffLng = showDropoffOnMap && currentRideOnMap ? currentRideOnMap.dropoff_lng : null;
  const currentDropoffAddress = showDropoffOnMap && currentRideOnMap ? currentRideOnMap.dropoff_address : undefined;

  const currentPickupDistKm = currentPickupLat && currentPickupLng && captainGps.lat && captainGps.lng
    ? calculateDistance(captainGps.lat, captainGps.lng, currentPickupLat, currentPickupLng)
    : null;
  const currentPickupDistText = currentPickupDistKm !== null
    ? (currentPickupDistKm < 1 ? `${Math.round(currentPickupDistKm * 1000)}m` : `${currentPickupDistKm.toFixed(1)} km`)
    : undefined;

  const currentDropoffDistKm = currentRideOnMap
    ? (currentRideOnMap.distance_km || calculateDistance(currentRideOnMap.pickup_lat, currentRideOnMap.pickup_lng, currentRideOnMap.dropoff_lat, currentRideOnMap.dropoff_lng))
    : null;
  const currentDropoffDistText = currentDropoffDistKm !== null
    ? (currentDropoffDistKm < 1 ? `${Math.round(currentDropoffDistKm * 1000)}m` : `${Number(currentDropoffDistKm).toFixed(1)} km`)
    : undefined;

  const renderCaptainMap = (isFullBackground: boolean) => (
    <MotorideMap
      isCaptainMode={true}
      captainLat={captainGps.lat}
      captainLng={captainGps.lng}
      captainHeading={captainGps.heading ?? 45}
      captainAccuracy={captainGps.accuracy}
      captainName={captain?.full_name || 'You (Captain)'}
      isLiveGpsActive={gpsStatus === 'live'}
      activeRideStatus={activeRide?.status}
      passengerLat={undefined}
      passengerLng={undefined}
      passengerAccuracy={undefined}
      passengerHeading={null}
      passengerName={activeRide?.passenger_name || inspectedRide?.passenger_name || availableRides[0]?.passenger_name || 'Passenger'}
      pickupLat={currentPickupLat}
      pickupLng={currentPickupLng}
      pickupAddress={currentPickupAddress}
      pickupDistanceText={currentPickupDistText}
      dropoffLat={currentDropoffLat}
      dropoffLng={currentDropoffLng}
      dropoffAddress={currentDropoffAddress}
      dropoffDistanceText={currentDropoffDistText}
      rideDistanceText={currentDropoffDistText}
      bottomSheetPadding={inspectedRide && !activeRide ? 30 : currentRideOnMap && !activeRide ? 60 : 60}
      showLocationsABOnly={false}
      className={`w-full h-full ${isFullBackground ? 'rounded-none border-0' : 'shadow-2xl border border-slate-800'}`}
      showOverlayControls={true}
      onLocateMe={startWatchingLocation}
      focusCoords={mapFocusTarget}
    />
  );

  const renderCaptainControls = () => (
    <div className="flex flex-col gap-3 pb-4">
      {activeRide ? (
        /* Active Trip Execution Card */
        <div className="bg-white border border-slate-200 rounded-3xl p-5 flex flex-col gap-4 shadow-xl">

          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-mono-num text-amber-600 font-bold">
                  {activeRide.ride_code}
                </span>
                {(() => {
                  const svc = getServiceBadge(activeRide.ride_type);
                  return (
                    <span className={`px-2 py-0.5 rounded-md border text-[10px] font-black flex items-center gap-1 ${svc.badgeBg}`}>
                      <span>{svc.icon}</span>
                      <span>{svc.label}</span>
                    </span>
                  );
                })()}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <h3 className="text-base font-black text-slate-950">
                  {activeRide.status === 'captain_arrived'
                    ? 'Arrived at Pickup location'
                    : activeRide.status === 'in_progress' || activeRide.status === 'trip_started'
                    ? 'Trip started'
                    : activeRide.status === 'completed' || activeRide.status === 'trip_completed'
                    ? 'Trip completed'
                    : activeRide.status === 'accepted' || activeRide.status === 'captain_accepted'
                    ? 'En Route to Pickup'
                    : activeRide.status.replace(/_/g, ' ')}
                </h3>
              </div>
            </div>

            {/* Smart Navigator Button */}
            {(() => {
              const isArrivedOrLater = activeRide.status === 'captain_arrived' || activeRide.status === 'in_progress' || activeRide.status === 'trip_started';
              const navLat = isArrivedOrLater ? activeRide.dropoff_lat : activeRide.pickup_lat;
              const navLng = isArrivedOrLater ? activeRide.dropoff_lng : activeRide.pickup_lng;
              const navAddress = isArrivedOrLater ? activeRide.dropoff_address : activeRide.pickup_address;
              const navTitle = 'Navigate';

              const hasCoords = navLat != null && navLng != null && !isNaN(Number(navLat)) && !isNaN(Number(navLng)) && Number(navLat) !== 0;
              const destParam = hasCoords ? `${navLat},${navLng}` : encodeURIComponent(navAddress || (isArrivedOrLater ? 'Drop-off' : 'Pickup'));
              const originParam = (captainGps.lat && captainGps.lng) ? `&origin=${captainGps.lat},${captainGps.lng}` : '';
              const gMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${destParam}${originParam}&travelmode=driving&dir_action=navigate`;

              const handleNavigateClick = (e: React.MouseEvent) => {
                e.preventDefault();
                e.stopPropagation();

                if (hasCoords) {
                  setMapFocusTarget({
                    lat: Number(navLat),
                    lng: Number(navLng),
                    zoom: 17,
                    timestamp: Date.now(),
                  });
                }

                const isAndroid = typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent);
                const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
                const isAndroidApk = typeof window !== 'undefined' && (window.location.protocol === 'file:' || !window.location.hostname);

                if (isAndroid) {
                  // Direct Intent Link: forces immediate opening of com.google.android.apps.maps
                  // bypasses Chrome/browser and app chooser completely. Start navigation immediately!
                  const intentUrl = `intent://www.google.com/maps/dir/?api=1&destination=${destParam}${originParam}&travelmode=driving&dir_action=navigate#Intent;scheme=https;package=com.google.android.apps.maps;end`;
                  try {
                    window.location.href = intentUrl;
                  } catch {
                    window.location.href = gMapsUrl;
                  }
                } else if (isIOS) {
                  // iOS Direct Scheme for native Google Maps turn-by-turn directions
                  const iosUrl = `comgooglemaps://?daddr=${destParam}&directionsmode=driving&views=traffic`;
                  const iframe = document.createElement('iframe');
                  iframe.style.display = 'none';
                  iframe.src = iosUrl;
                  document.body.appendChild(iframe);
                  
                  setTimeout(() => {
                    document.body.removeChild(iframe);
                    // Fallback to web link if maps scheme didn't launch
                    if (isAndroidApk) {
                      window.location.href = gMapsUrl;
                    } else {
                      window.open(gMapsUrl, '_blank', 'noopener,noreferrer');
                    }
                  }, 1500);
                } else {
                  // Desktop Web / General Fallback
                  if (isAndroidApk) {
                    window.location.href = gMapsUrl;
                  } else {
                    try {
                      const win = window.open(gMapsUrl, '_blank', 'noopener,noreferrer');
                      if (!win || win.closed || typeof win.closed === 'undefined') {
                        const tempLink = document.createElement('a');
                        tempLink.href = gMapsUrl;
                        tempLink.target = '_blank';
                        tempLink.rel = 'noopener noreferrer';
                        document.body.appendChild(tempLink);
                        tempLink.click();
                        document.body.removeChild(tempLink);
                      }
                    } catch {
                      window.location.href = gMapsUrl;
                    }
                  }
                }
              };

              return (
                <button
                  type="button"
                  onClick={handleNavigateClick}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-black hover:bg-slate-900 text-white text-xs font-black transition-all shadow-md active:scale-95 cursor-pointer select-none border border-slate-800 shrink-0"
                  title={isArrivedOrLater ? 'Navigate to Drop-off destination' : 'Navigate to Pickup point'}
                >
                  <Navigation2 className="w-3.5 h-3.5 fill-white stroke-white text-white shrink-0" />
                  <span className="text-white">{navTitle}</span>
                </button>
              );
            })()}
          </div>

          {/* Combined Passenger Ride Details Box: Left Passenger Profile | Right A & B Location Points */}
          {(() => {
            const passengerDisplayName = activeRide.passenger_name || 'Ritu Sharma';
            const passengerRating = activeRide.passenger_rating || 5.0;
            const passengerTotalRides = activeRide.passenger_total_rides ?? 0;

            let passengerAvatar = activeRide.passenger_avatar;
            if (!passengerAvatar) {
              try {
                const local = safeStorage.getItem('motoride_passenger_avatar');
                if (local) passengerAvatar = local;
              } catch {}
            }
            if (!passengerAvatar) {
              passengerAvatar = defaultRituAvatar;
            }

            return (
              <div className="p-4 sm:p-5 rounded-3xl bg-white border border-slate-200/90 shadow-sm flex flex-col gap-3.5 transition-all">
                {/* Main Row: Left Passenger Profile | Right A & B Locations */}
                <div className="flex items-center gap-3.5 sm:gap-4">
                  {/* Left Side: Passenger Profile (Photo, Full Name, ⭐ 5.0, (10)) */}
                  <div className="flex flex-col items-center shrink-0 w-24 sm:w-28 text-center">
                    <div className="relative">
                      <img
                        src={passengerAvatar}
                        alt={passengerDisplayName}
                        className="w-13 h-13 sm:w-14 sm:h-14 rounded-full object-cover border-2 border-white ring-2 ring-slate-200 shadow-sm shrink-0 bg-slate-100"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = defaultRituAvatar;
                        }}
                      />
                    </div>
                    <h4 className="text-xs sm:text-sm font-black text-slate-900 mt-2 leading-tight break-words text-center line-clamp-2 w-full" title={passengerDisplayName}>
                      {passengerDisplayName}
                    </h4>
                    <span className="flex items-center gap-0.5 text-[11px] text-amber-950 bg-amber-100/90 border border-amber-300/80 px-2 py-0.5 rounded-md font-black leading-none mt-1.5 shadow-2xs">
                      <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-500 mr-0.5 shrink-0" />
                      {passengerRating.toFixed(1)}
                    </span>
                    <span className="text-[11px] text-slate-700 font-bold font-mono-num leading-none mt-1">
                      ({passengerTotalRides || 15})
                    </span>
                    <span className="text-[10.5px] text-slate-500 font-bold font-mono-num leading-none mt-1">
                      {getRequestElapsedText(activeRide.created_at || (activeRide as any).requested_at)}
                    </span>
                  </div>

                  {/* Right Side: A & B Location Points with Call & Message buttons */}
                  <div className="flex-1 min-w-0 flex flex-col gap-3 justify-center">
                    {/* A: Pickup Address + Call Icon */}
                    <div className="flex items-center justify-between gap-2.5">
                      <div className="flex items-start gap-2.5 min-w-0 flex-1">
                        <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                          A
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs sm:text-sm text-slate-900 font-bold leading-snug break-words">
                            {activeRide.pickup_address || 'My Live GPS Location'}
                          </p>
                        </div>
                      </div>

                      {/* Call Icon on right of A */}
                      <a
                        href={`tel:${activeRide.passenger_phone || '+919780012345'}`}
                        className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-600 text-white hover:bg-emerald-500 shadow-sm shadow-emerald-600/25 transition-all active:scale-95 cursor-pointer flex items-center justify-center shrink-0 border border-emerald-500"
                        title="Call Passenger"
                        aria-label="Call Passenger"
                      >
                        <Phone className="w-4 h-4 stroke-[2.5] text-white" />
                      </a>
                    </div>

                    {/* B: Dropoff Address + Message Icon */}
                    <div className="flex items-center justify-between gap-2.5 pt-2.5 border-t border-slate-100">
                      <div className="flex items-start gap-2.5 min-w-0 flex-1">
                        <span className="w-6 h-6 rounded-full bg-rose-500 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                          B
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs sm:text-sm text-slate-800 font-medium leading-snug break-words">
                            {activeRide.dropoff_address || 'Phase 5 Market, Mohali'}
                          </p>
                        </div>
                      </div>

                      {/* Message Icon on right of B */}
                      <button
                        type="button"
                        onClick={() => {
                          setShowChatModal(true);
                          setHasUnreadMessages(false);
                          if (activeRide?.id) {
                            safeStorage.setItem(`motoride_last_read_chat_${activeRide.id}`, Date.now().toString());
                          }
                        }}
                        className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-600 text-white hover:bg-emerald-500 shadow-sm shadow-emerald-600/25 transition-all active:scale-95 cursor-pointer flex items-center justify-center shrink-0 border border-emerald-500 relative"
                        title="Chat with Passenger"
                        aria-label="Chat with Passenger"
                      >
                        <MessageSquare className="w-4 h-4 stroke-[2.5] text-white" />
                        {hasUnreadMessages && (
                          <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 z-10" title="New message received">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-500 opacity-80"></span>
                            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-rose-600 border-2 border-white shadow-md"></span>
                          </span>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Agreed Fare */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                  <div className="flex items-center gap-2">
                    <span className="text-xs sm:text-sm font-bold text-slate-700">
                      Agreed Fare:
                    </span>
                    <span className="text-base sm:text-lg font-black text-slate-950 font-mono-num">
                      ₹{getRideAgreedFare(activeRide)}
                    </span>
                  </div>
                  <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-white px-2.5 py-0.5 rounded-lg bg-emerald-600 border border-emerald-500 shadow-2xs">
                    {activeRide.payment_method?.toUpperCase() === 'CASH' ? 'CASH' : 'UPI'}
                  </span>
                </div>

                {activeRide.comment && (
                  <p className="flex items-center gap-1.5 pt-1.5 border-t border-slate-200 text-emerald-800 text-xs">
                    <MessageSquare className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="truncate italic">Passenger note: "{activeRide.comment}"</span>
                  </p>
                )}
              </div>
            );
          })()}

          {/* Workflow Step Action Buttons */}
          <div className="flex flex-col gap-2 pt-2">
            {toCanonicalStatus(activeRide.status) === 'accepted' && (
              <button
                type="button"
                disabled={isUpdatingStatus}
                onClick={() => handleStatusChange('captain_arrived')}
                className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-black text-xs sm:text-sm shadow-xl shadow-emerald-600/25 transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-2 border border-emerald-500"
              >
                {isUpdatingStatus ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <MapPin className="w-4 h-4 stroke-[2.5] text-white" />}
                <span className="text-white">{isUpdatingStatus ? 'Updating Status...' : 'I Have Arrived at Pickup'}</span>
              </button>
            )}

            {toCanonicalStatus(activeRide.status) === 'captain_arrived' && (
              <button
                type="button"
                disabled={isUpdatingStatus}
                onClick={() => handleStatusChange('in_progress')}
                style={{ backgroundColor: '#DAA520', borderColor: '#DAA520' }}
                className="w-full py-3.5 rounded-2xl hover:opacity-90 disabled:opacity-60 text-slate-950 font-black text-xs shadow-xl transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-2 border shadow-amber-500/20"
              >
                {isUpdatingStatus ? <Loader2 className="w-4 h-4 animate-spin text-slate-950" /> : <Navigation2 className="w-4 h-4 stroke-[2.5] text-slate-950 fill-slate-950" />}
                <span className="text-slate-950">{isUpdatingStatus ? 'Starting Trip...' : 'Trip Started'}</span>
              </button>
            )}

            {toCanonicalStatus(activeRide.status) === 'in_progress' && (
              <button
                type="button"
                disabled={isUpdatingStatus}
                onClick={() => handleStatusChange('completed')}
                style={{ backgroundColor: '#ba1e23', borderColor: '#ba1e23' }}
                className="w-full py-3.5 rounded-2xl hover:opacity-90 disabled:opacity-60 text-white font-black text-xs shadow-xl transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-2 border shadow-rose-900/25"
              >
                {isUpdatingStatus ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <CheckCircle2 className="w-4 h-4 stroke-[2.5] text-white" />}
                <span className="text-white">{isUpdatingStatus ? 'Completing Trip...' : 'Trip Completed'}</span>
              </button>
            )}

            {toCanonicalStatus(activeRide.status) === 'completed' && (
              <div className="flex flex-col gap-3 p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center">
                      <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-slate-900">Trip Completed! 🎉</h4>
                      <p className="text-[11px] text-slate-500 font-medium">Collect payment & rate passenger</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
                      Agreed Fare
                    </span>
                    <span className="text-base font-black text-emerald-600 font-mono-num">
                      ₹{getRideAgreedFare(activeRide)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCompletedRideForRating(activeRide);
                      setShowPassengerRatingModal(true);
                    }}
                    style={{ backgroundColor: '#ba1e23', borderColor: '#ba1e23' }}
                    className="flex-1 py-3.5 rounded-2xl hover:opacity-90 text-white font-black text-xs shadow-xl transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-2 border shadow-rose-900/25"
                  >
                    <Star className="w-4 h-4 fill-white text-white" />
                    <span>Rate Passenger</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleFinishRideWithRating(5, '', [], true)}
                    className="py-3.5 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-all active:scale-98 cursor-pointer"
                    title="Skip Rating and return to live radar"
                  >
                    Skip & Close
                  </button>
                </div>
              </div>
            )}

            {!['trip_completed', 'completed'].includes(activeRide.status) && (
              <button
                type="button"
                onClick={handleCancelTrip}
                className="w-full py-2 rounded-xl text-rose-600 hover:bg-rose-50 text-xs font-semibold cursor-pointer transition-colors"
              >
                Cancel Ride
              </button>
            )}
          </div>
        </div>
      ) : (
        /* Incoming Live Ride Requests */
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200">
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <Bike className="w-4 h-4 text-amber-500 animate-bounce" />
              <span>Live Ride Requests</span>
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-900 font-mono-num border border-amber-300">
                {availableRides.length} Available
              </span>
            </div>
          </div>

          {!isOnline || availableRides.length === 0 ? (
            <div className="text-center py-10 sm:py-14 text-slate-600 text-xs flex flex-col items-center justify-center gap-4">
              {/* Radar Scanning Visual when Online / Offline Status */}
              {isOnline ? (
                <div className="relative flex items-center justify-center my-2">
                  <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-emerald-500/15 animate-ping pointer-events-none" />
                  <div className="absolute w-36 h-36 sm:w-40 sm:h-40 rounded-full border border-emerald-500/25 animate-pulse pointer-events-none" />
                  <div className="relative z-10 w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-emerald-50 border-2 border-emerald-500/50 flex flex-col items-center justify-center gap-1 text-emerald-700 shadow-xl shadow-emerald-500/15">
                    <Radio className="w-7 h-7 sm:w-8 sm:h-8 animate-pulse text-emerald-600" />
                    <span className="text-[10px] font-black uppercase tracking-wider">Active</span>
                  </div>
                </div>
              ) : (
                <div className="relative flex items-center justify-center my-2">
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-rose-50 border-2 border-rose-300 flex flex-col items-center justify-center gap-1 text-rose-700 shadow-lg">
                    <AlertCircle className="w-7 h-7 sm:w-8 sm:h-8 text-rose-600" />
                    <span className="text-[10px] font-black uppercase tracking-wider">Offline</span>
                  </div>
                </div>
              )}

              {/* Status & Scanning Message */}
              <div className="flex flex-col items-center gap-1 text-center px-4 w-full">
                {fareSettings?.require_admin_approval_for_rides && captain && !captain.is_approved ? (
                  <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl text-center text-xs text-amber-900 font-medium mb-3 w-full shadow-sm">
                    <strong>Pending Admin Approval:</strong> Your new captain account requires admin approval before passenger ride requests can be displayed in your dashboard.
                  </div>
                ) : (
                  <p className="text-sm font-bold text-slate-900 flex items-center justify-center gap-2">
                    {isOnline ? (
                      <>
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping shrink-0" />
                        <span>Scanning for nearby live ride requests...</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>You are currently OFFLINE</span>
                      </>
                    )}
                  </p>
                )}
                <span className="text-[11px] text-slate-500 max-w-sm">
                  {fareSettings?.require_admin_approval_for_rides && captain && !captain.is_approved
                    ? 'Please contact admin or wait for account approval.'
                    : isOnline
                    ? 'Passenger ride requests appear here instantly in real time with audio alert'
                    : 'Use the Online capsule button near Captain App at the top right to go Online and receive rides'}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3 overflow-y-auto pr-1">
              {availableRides.map((ride) => {
                const distKm = calculateDistance(captainGps.lat, captainGps.lng, ride.pickup_lat, ride.pickup_lng);
                const pickupDistText = distKm < 1 ? `${Math.round(distKm * 1000)}m` : `${distKm.toFixed(1)}km`;
                const rideDistKm = ride.distance_km || calculateDistance(ride.pickup_lat, ride.pickup_lng, ride.dropoff_lat, ride.dropoff_lng) || 3.5;
                const rideDistText = rideDistKm < 1 ? `${Math.round(rideDistKm * 1000)}m` : `${Number(rideDistKm).toFixed(1)}km`;
                const isSelected = inspectedRide?.id === ride.id;
                const service = getServiceBadge(ride.ride_type);
                const passengerAvatar = ride.passenger_avatar || defaultRituAvatar;

                return (
                  <div
                    key={ride.id}
                    onClick={() => handleInspectRide(ride)}
                    className={`p-4 rounded-2xl bg-white border transition-all cursor-pointer shadow-sm hover:shadow-md ${
                      isSelected
                        ? 'border-amber-500 ring-2 ring-amber-400/30 bg-amber-50/20'
                        : 'border-slate-200 hover:border-amber-400'
                    }`}
                  >
                    <div className="flex items-start gap-3 sm:gap-4">
                      {/* Left Column: Photo of Passenger | Full Name | Rating */}
                      <div className="flex flex-col items-center shrink-0 w-20 sm:w-24 text-center pt-0.5">
                        <div className="relative">
                          <img
                            src={passengerAvatar}
                            alt={ride.passenger_name || 'Passenger'}
                            className="w-12 h-12 sm:w-14 sm:h-14 rounded-full object-cover border-2 border-white ring-2 ring-slate-200 shadow-sm bg-slate-100"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).src = defaultRituAvatar;
                            }}
                          />
                          <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-white" />
                        </div>

                        <h4 className="text-xs sm:text-sm font-black text-slate-900 mt-1.5 leading-tight break-words line-clamp-2 w-full text-center" title={ride.passenger_name}>
                          {ride.passenger_name || 'Passenger'}
                        </h4>

                        <span className="inline-flex items-center gap-0.5 text-[10px] sm:text-[11px] font-black text-amber-800 bg-amber-100/90 border border-amber-300/80 px-2 py-0.5 rounded-md mt-1 shadow-2xs">
                          <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500 shrink-0" />
                          {(ride.passenger_rating || 4.9).toFixed(1)}
                        </span>
                        <span className="text-[11px] text-slate-700 font-bold font-mono-num leading-none mt-1">
                          ({ride.passenger_total_rides ?? 15})
                        </span>
                        <span className="text-[10px] sm:text-[10.5px] text-slate-500 font-bold font-mono-num leading-none mt-1">
                          {getRequestElapsedText(ride.created_at || (ride as any).requested_at)}
                        </span>
                      </div>

                      {/* Right Column: 2km Pickup Distance | Offered Fare ₹202 | A & B Locations | UPI & Motorbike Badges */}
                      <div className="flex-1 min-w-0 flex flex-col gap-2">
                        {/* Top Row: Pickup Distance (e.g. 2km) & Offered Fare (e.g. Offered Fare ₹202) */}
                        <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-1.5 flex-wrap">
                          <div className="flex items-center gap-2">
                            <span className="text-xs sm:text-sm font-black text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200 flex items-center gap-1 shadow-2xs">
                              <Navigation className="w-3 h-3 text-emerald-600 shrink-0" />
                              <span>{pickupDistText}</span>
                            </span>

                            {/* 25-Second Acceptance Window Pill */}
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black border font-mono-num ${
                              isSelected
                                ? countdownSeconds <= 5
                                  ? 'bg-rose-500 text-white border-rose-400 animate-pulse'
                                  : countdownSeconds <= 12
                                  ? 'bg-amber-500 text-slate-950 border-amber-400'
                                  : 'bg-emerald-600 text-white border-emerald-500'
                                : 'bg-slate-100 text-slate-700 border-slate-300'
                            }`}>
                              <Clock className="w-2.5 h-2.5" />
                              <span>{isSelected ? `${countdownSeconds}s Auto-pass` : '25s Window'}</span>
                            </span>
                          </div>

                          <div className="text-right flex flex-col items-end">
                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider leading-none mb-1">
                              Offered Fare
                            </span>
                            <span className="text-xl sm:text-2xl font-black text-slate-950 font-mono-num leading-none">
                              ₹{ride.offered_fare}
                            </span>
                          </div>
                        </div>

                        {/* Route Details: A Pickup Address & B Dropoff Address */}
                        <div className="flex flex-col gap-1.5">
                          {/* A: Pickup Location */}
                          <div className="flex items-start gap-2">
                            <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                              A
                            </span>
                            <p className="text-xs sm:text-sm font-bold text-slate-900 leading-snug break-words flex-1 min-w-0">
                              {ride.pickup_address}
                            </p>
                          </div>

                          {/* B: Dropoff Location */}
                          <div className="flex items-start gap-2">
                            <span className="w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                              B
                            </span>
                            <p className="text-xs sm:text-sm font-medium text-slate-700 leading-snug break-words flex-1 min-w-0">
                              {ride.dropoff_address}
                            </p>
                          </div>
                        </div>

                        {/* Bottom Row Badges: UPI / CASH | Motorbike / Ride Type */}
                        <div className="flex items-center gap-2 pt-1.5 border-t border-slate-100 flex-wrap">
                          <span className="px-2.5 py-0.5 rounded-md bg-emerald-600 text-white border border-emerald-500 text-[11px] font-black uppercase tracking-wider shadow-2xs">
                            {ride.payment_method?.toUpperCase() === 'CASH' ? 'CASH' : 'UPI'}
                          </span>

                          <span className={`px-2.5 py-0.5 rounded-md border text-[11px] font-black flex items-center gap-1 shadow-2xs ${service.bg}`}>
                            <span className="text-xs leading-none">{service.icon}</span>
                            <span>{service.label}</span>
                          </span>
                        </div>

                        {/* Distance in red color directly below the UPI tab */}
                        <div className="pt-0.5 flex items-center gap-1">
                          <span className="text-xs sm:text-sm font-black text-rose-600 font-mono-num">
                            {rideDistText}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderInspectedRideDetails = (ride: MotorideRide) => {
    const distKm = calculateDistance(captainGps.lat, captainGps.lng, ride.pickup_lat, ride.pickup_lng);
    const pickupDistText = distKm < 1 ? `${Math.round(distKm * 1000)}m` : `${distKm.toFixed(1)}km`;
    const rideDistKm = ride.distance_km || calculateDistance(ride.pickup_lat, ride.pickup_lng, ride.dropoff_lat, ride.dropoff_lng) || 3.5;
    const rideDistText = rideDistKm < 1 ? `${Math.round(rideDistKm * 1000)}m` : `${Number(rideDistKm).toFixed(1)}km`;
    const counterFare = counterFareInput[ride.id] || ride.offered_fare + 20;
    const service = getServiceBadge(ride.ride_type);
    const passengerAvatar = ride.passenger_avatar || defaultRituAvatar;

    return (
      <div className="flex flex-col gap-3">
        {/* If passenger declined this captain's previous offer */}
        {(() => {
          const myCapId = captainId || captain?.id || authUser?.id;
          const myOffer = (ride.offers || []).find((o) => o.captain_id === myCapId);
          if (myOffer && myOffer.status === 'rejected') {
            return (
              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-300 text-rose-950 flex items-center justify-between gap-3 shadow-xs animate-in fade-in">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-rose-500/20 border border-rose-400 text-rose-700 flex items-center justify-center shrink-0">
                    <XCircle className="w-4 h-4 text-rose-600" />
                  </div>
                  <div>
                    <h5 className="text-xs font-black text-rose-900">Offer Declined by Passenger</h5>
                    <p className="text-[11px] text-rose-700 font-medium">
                      Your offer of ₹{myOffer.counter_fare} was declined. You can send a revised offer or accept for ₹{ride.offered_fare}.
                    </p>
                  </div>
                </div>
              </div>
            );
          }
          return null;
        })()}

        {/* Inspection Request Details Header Card - Matching Layout */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
          <div className="flex items-start gap-3 sm:gap-4">
            {/* Left Column: Photo of Passenger | Full Name | Rating */}
            <div className="flex flex-col items-center shrink-0 w-20 sm:w-24 text-center pt-0.5">
              <div className="relative">
                <img
                  src={passengerAvatar}
                  alt={ride.passenger_name || 'Passenger'}
                  className="w-12 h-12 sm:w-14 sm:h-14 rounded-full object-cover border-2 border-white ring-2 ring-slate-200 shadow-sm bg-slate-100"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = defaultRituAvatar;
                  }}
                />
                <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-white" />
              </div>

              <h4 className="text-xs sm:text-sm font-black text-slate-900 mt-1.5 leading-tight break-words line-clamp-2 w-full text-center" title={ride.passenger_name}>
                {ride.passenger_name || 'Passenger'}
              </h4>

              <span className="inline-flex items-center gap-0.5 text-[10px] sm:text-[11px] font-black text-amber-800 bg-amber-100/90 border border-amber-300/80 px-2 py-0.5 rounded-md mt-1 shadow-2xs">
                <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500 shrink-0" />
                {(ride.passenger_rating || 4.9).toFixed(1)}
              </span>
              <span className="text-[11px] text-slate-700 font-bold font-mono-num leading-none mt-1">
                ({ride.passenger_total_rides ?? 15})
              </span>
              <span className="text-[10px] sm:text-[10.5px] text-slate-500 font-bold font-mono-num leading-none mt-1">
                {getRequestElapsedText(ride.created_at || (ride as any).requested_at)}
              </span>
            </div>

            {/* Right Column: 2km Pickup Distance | Offered Fare ₹202 | A & B Locations | UPI & Motorbike Badges */}
            <div className="flex-1 min-w-0 flex flex-col gap-2">
              {/* Top Row: Pickup Distance (e.g. 2km) & Offered Fare (e.g. Offered Fare ₹202) */}
              <div className="flex items-center justify-between gap-2 border-b border-slate-200/80 pb-1.5">
                <span className="text-xs sm:text-sm font-black text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200 flex items-center gap-1 shadow-2xs">
                  <Navigation className="w-3 h-3 text-emerald-600 shrink-0" />
                  <span>{pickupDistText} away</span>
                </span>

                <div className="text-right flex flex-col items-end">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider leading-none mb-1">
                    Offered Fare
                  </span>
                  <span className="text-xl sm:text-2xl font-black text-slate-950 font-mono-num leading-none">
                    ₹{ride.offered_fare}
                  </span>
                </div>
              </div>

              {/* Route Details: A Pickup Address & B Dropoff Address */}
              <div className="flex flex-col gap-1.5">
                {/* A: Pickup Location */}
                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                    A
                  </span>
                  <p className="text-xs sm:text-sm font-bold text-slate-900 leading-snug break-words flex-1 min-w-0">
                    {ride.pickup_address}
                  </p>
                </div>

                {/* B: Dropoff Location */}
                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                    B
                  </span>
                  <p className="text-xs sm:text-sm font-medium text-slate-700 leading-snug break-words flex-1 min-w-0">
                    {ride.dropoff_address}
                  </p>
                </div>
              </div>

              {/* Bottom Row Badges: UPI / CASH | Motorbike / Ride Type */}
              <div className="flex items-center gap-2 pt-1.5 border-t border-slate-200/80 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-md bg-emerald-600 text-white border border-emerald-500 text-[11px] font-black uppercase tracking-wider shadow-2xs">
                  {ride.payment_method?.toUpperCase() === 'CASH' ? 'CASH' : 'UPI'}
                </span>

                <span className={`px-2.5 py-0.5 rounded-md border text-[11px] font-black flex items-center gap-1 shadow-2xs ${service.bg}`}>
                  <span className="text-xs leading-none">{service.icon}</span>
                  <span>{service.label}</span>
                </span>
              </div>

              {/* Distance and duration in red color directly below the UPI tab */}
              <div className="pt-0.5 flex items-center gap-1">
                <span className="text-xs sm:text-sm font-black text-rose-600 font-mono-num">
                  {rideDistText}({ride.duration_minutes || 54}mins)
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons & Close Tab: Set near bottom of the page */}
        <div className="sticky bottom-0 bg-white pt-2.5 pb-1 border-t border-slate-100 flex flex-col sm:flex-row items-center gap-2 mt-auto">
          {/* Accept for ₹100 */}
          <button
            type="button"
            onClick={() => {
              handleAcceptRide(ride);
              setInspectedRide(null);
            }}
            className={`w-full sm:flex-1 py-3 px-4 rounded-xl font-black text-xs sm:text-sm shadow-md transition-all active:scale-95 cursor-pointer text-center flex items-center justify-center gap-2 ${
              countdownSeconds <= 5
                ? 'bg-rose-600 hover:bg-rose-500 text-white animate-pulse'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
            <span>Accept for ₹{ride.offered_fare} ({countdownSeconds}s)</span>
          </button>

          {/* Offer your Fare ₹120 */}
          <div className="w-full sm:flex-1 flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                handleSendCounterOffer(ride.id, counterFare);
                setInspectedRide(null);
                setIs100Full(true);
              }}
              className="flex-1 py-3 px-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs sm:text-sm shadow-md transition-all active:scale-95 cursor-pointer text-center flex items-center justify-center gap-1.5"
            >
              <TrendingUp className="w-4 h-4 stroke-[2.5]" />
              <span>Offer your Fare ₹{counterFare}</span>
            </button>

            {/* Quick Fare Adjust (+ / - 10) */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setCounterFareInput((prev) => ({
                    ...prev,
                    [ride.id]: Math.max(ride.offered_fare, counterFare - 10),
                  }));
                }}
                className="w-8 h-8 rounded-lg bg-white hover:bg-slate-200 text-slate-800 font-black text-sm flex items-center justify-center cursor-pointer shadow-xs"
                title="Decrease fare by ₹10"
              >
                -
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setCounterFareInput((prev) => ({
                    ...prev,
                    [ride.id]: counterFare + 10,
                  }));
                }}
                className="w-8 h-8 rounded-lg bg-white hover:bg-slate-200 text-slate-800 font-black text-sm flex items-center justify-center cursor-pointer shadow-xs"
                title="Increase fare by ₹10"
              >
                +
              </button>
            </div>
          </div>

          {/* Close Tab set near bottom of page */}
          <button
            type="button"
            onClick={() => {
              setInspectedRide(null);
              setIs100Full(true);
            }}
            className="w-full sm:w-auto py-3 px-5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm border border-slate-700 transition-all active:scale-95 cursor-pointer text-center flex items-center justify-center gap-1.5 shadow-md shrink-0"
            title="Close ride details and return to live requests list"
          >
            <X className="w-4 h-4 text-slate-300" />
            <span>Close</span>
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="relative w-full h-[calc(100dvh-64px)] sm:h-[calc(100vh-68px)] overflow-hidden bg-slate-950">
      {/* Real-time Toast: Offer Declined by Passenger */}
      {declinedOfferAlert && (
        <div className="fixed top-16 sm:top-20 left-1/2 -translate-x-1/2 z-[1400] w-[92%] sm:w-auto min-w-[320px] max-w-lg p-3.5 sm:p-4 rounded-2xl bg-rose-950/95 border-2 border-rose-500/80 text-white shadow-2xl backdrop-blur-xl flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center shrink-0">
              <XCircle className="w-5 h-5 text-rose-400 stroke-[2.5]" />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-black text-white flex items-center gap-1.5">
                <span>Offer Declined</span>
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
              </h4>
              <p className="text-[11px] sm:text-xs text-rose-200 font-medium mt-0.5">
                {declinedOfferAlert.message}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setDeclinedOfferAlert(null)}
            className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white cursor-pointer active:scale-95 transition-all shrink-0"
            title="Dismiss notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {activeRide ? (
        /* Active Ride Full-Screen Page: Showing ONLY map and active trip details (Top Header & navigation tabs hidden) */
        <div className="fixed inset-0 z-[1500] bg-slate-950 flex flex-col w-full h-full overflow-hidden animate-in fade-in duration-200">
          {/* Top Map: 30% height in 70% mode, hidden/0% in 100% details mode */}
          <div
            className={`w-full transition-all duration-300 ease-in-out relative z-0 shrink-0 ${
              is100Full ? 'h-0 overflow-hidden opacity-0 pointer-events-none' : 'h-[30dvh] sm:h-[30%] opacity-100'
            }`}
          >
            {renderCaptainMap(true)}
          </div>

          {/* Bottom Active Ride Details: 70% in split mode, 100% in full mode */}
          <div
            className={`w-full flex-1 bg-white shadow-[0_-12px_45px_rgba(0,0,0,0.18)] flex flex-col overflow-hidden relative z-10 transition-all duration-300 ease-in-out ${
              is100Full ? 'h-full' : 'h-[70dvh] sm:h-[70%]'
            }`}
          >
            {/* Top Center Handle Bar (Line - style to drop up and down like passenger booking form) */}
            <div
              onClick={() => setIs100Full((prev) => !prev)}
              className="w-full pt-2.5 pb-1 bg-white flex items-center justify-center cursor-pointer group select-none hover:bg-slate-50 transition-colors"
              title={is100Full ? "Drop down to 70% split map view" : "Drop up to 100% full view"}
              role="button"
              tabIndex={0}
              aria-label="Toggle active trip screen height"
            >
              <div className="w-12 h-1.5 rounded-full bg-slate-300 group-hover:bg-slate-500 transition-colors" />
            </div>

            {/* Header with Title and Drop Up/Down Toggle Button */}
            <div className="px-3.5 sm:px-5 py-2 bg-white border-b border-slate-100 flex items-center justify-between select-none shrink-0 shadow-xs">
              <div className="flex items-center gap-2 min-w-0 pr-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <span className="text-xs sm:text-sm font-black text-slate-900 truncate">
                  Active Trip • #{activeRide.ride_code} ({activeRide.status.replace(/_/g, ' ')})
                </span>
              </div>

              {/* Right Toggle Button: Same icon-style button as passenger header (ChevronDown / ChevronUp) */}
              <button
                type="button"
                onClick={() => setIs100Full((prev) => !prev)}
                className="p-1.5 sm:p-2 rounded-xl bg-white hover:bg-slate-200 text-slate-900 border border-slate-300 text-xs font-black transition-all active:scale-95 cursor-pointer shadow-xs flex items-center justify-center"
                title={is100Full ? "Drop down to 70% split map view" : "Drop up to 100% full view"}
                aria-label="Toggle drop up and down"
              >
                {is100Full ? (
                  <ChevronDown className="w-4 h-4 text-slate-900 stroke-[2.5]" />
                ) : (
                  <ChevronUp className="w-4 h-4 text-slate-900 stroke-[2.5]" />
                )}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-5 scrollbar-thin bg-white">
              {renderCaptainControls()}
            </div>
          </div>
        </div>
      ) : inspectedRide ? (
        /* Dedicated 100% Full-Screen Display Page: "Ride Details & Route Map"
           Shows ONLY this page and nothing else.
           Both Route Map and Ride Details are clearly viewable without 44% restriction.
        */
        <div className="fixed inset-0 z-[1500] bg-slate-950 flex flex-col w-full h-full overflow-hidden animate-in fade-in duration-200">
          {/* Top Header Bar - Clean & Compact so whole page can be visible clearly */}
          <div className="px-3.5 sm:px-5 py-2 bg-slate-950/95 border-b border-slate-800 text-white flex items-center justify-between z-20 shrink-0 shadow-sm backdrop-blur-md">
            {/* Left: Title & Code */}
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span className="text-xs sm:text-sm font-black text-white truncate">
                Ride Details & Route Map (A & B)
              </span>
              <span className="text-[11px] font-mono-num font-bold text-amber-300 bg-amber-950/80 px-2 py-0.5 rounded-md border border-amber-500/40 hidden sm:inline">
                #{inspectedRide.ride_code}
              </span>
            </div>

            {/* Right: Pass Button */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handlePassCurrentRequest}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 text-xs font-bold transition-all cursor-pointer shrink-0 active:scale-95"
                title="Pass to next request"
              >
                Pass
              </button>
            </div>
          </div>

          {/* Acceptance Countdown Timer Card with 25-Second Animated Progress Bar */}
          <div className="px-3.5 sm:px-5 py-2 bg-slate-950 border-b border-slate-800/90 text-white flex flex-col gap-1.5 z-20 shrink-0 shadow-sm backdrop-blur-md">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              {/* Acceptance Countdown Timer & Clock Icon */}
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center shrink-0 border ${
                    countdownSeconds <= 5
                      ? 'bg-rose-500/25 border-rose-500/50 text-rose-400 animate-pulse'
                      : countdownSeconds <= 12
                      ? 'bg-amber-500/25 border-amber-500/50 text-amber-400'
                      : 'bg-emerald-500/25 border-emerald-500/50 text-emerald-400'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" style={{ animationDuration: '4s' }} />
                </div>

                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-xs font-black tracking-wide text-white hidden xs:inline">
                    Acceptance Timer:
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-md text-xs font-mono font-black border ${
                      countdownSeconds <= 5
                        ? 'bg-rose-500 text-white border-rose-400 animate-pulse'
                        : countdownSeconds <= 12
                        ? 'bg-amber-500 text-slate-950 border-amber-400'
                        : 'bg-emerald-500 text-white border-emerald-400'
                    }`}
                  >
                    {countdownSeconds}s
                  </span>
                  <span className="text-[10px] text-slate-400 truncate">
                    {availableRides.length > 1
                      ? `Auto-passes in ${countdownSeconds}s to next offer`
                      : `Auto-passes in ${countdownSeconds}s`}
                  </span>
                </div>
              </div>
            </div>

            {/* 25-Second Animated Progress Bar from 25s to 0s with color shifts (Emerald, Amber, Rose) */}
            <div className="w-full h-2 rounded-full bg-slate-900 overflow-hidden relative border border-slate-800">
              <div
                className={`h-full rounded-full transition-all duration-100 ease-linear ${
                  countdownSeconds <= 5
                    ? 'bg-gradient-to-r from-rose-500 to-red-500 shadow-md shadow-rose-500/50'
                    : countdownSeconds <= 12
                    ? 'bg-gradient-to-r from-amber-500 to-yellow-400 shadow-md shadow-amber-500/50'
                    : 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-md shadow-emerald-500/50'
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Main 100% Display Body - Showing Both Route Map and Ride Details Clearly */}
          <div className="flex-1 w-full relative flex flex-col md:flex-row overflow-hidden">
            {/* 1. Route Map */}
            <div className="relative z-0 transition-all duration-200 w-full md:w-1/2 h-[42dvh] sm:h-[44dvh] md:h-full border-b md:border-b-0 md:border-r border-slate-800 shrink-0 md:shrink">
              {renderCaptainMap(true)}
            </div>

            {/* 2. Ride Details - Height increased upwards from bottom towards center */}
            <div className="bg-white overflow-y-auto p-3.5 sm:p-5 relative z-10 scrollbar-thin shadow-2xl flex flex-col justify-between w-full md:w-1/2 flex-1 md:h-full">
              {renderInspectedRideDetails(inspectedRide)}
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Background Street View Map filling 100% of the canvas */}
          <div className="absolute inset-0 w-full h-full z-0">
            {renderCaptainMap(true)}
          </div>

          {/* Center Main Page: Captain Live Ride Requests Page (100% Full / Minimized Bottom View) */}
          <div
            className={`fixed sm:absolute bottom-0 left-1/2 -translate-x-1/2 z-[1000] transition-all duration-300 ease-out flex flex-col ${
              is100Full
                ? 'inset-0 w-full h-full max-w-full'
                : 'h-16 sm:h-[72px] w-full sm:w-[94%] md:w-[760px] lg:w-[840px] max-w-4xl'
            }`}
          >
            <div
              className={`w-full h-full bg-white border-t border-slate-200 shadow-[0_-12px_45px_rgba(0,0,0,0.18)] flex flex-col overflow-hidden ring-1 ring-slate-200 ${
                is100Full ? 'rounded-none border-x-0' : 'rounded-t-3xl sm:border-x sm:border-slate-200'
              }`}
            >
              {/* Top Center Pull Handle Bar */}
              <div
                onClick={() => setIs100Full((prev) => !prev)}
                className="w-full pt-2 pb-0.5 bg-white flex items-center justify-center cursor-pointer group select-none hover:bg-slate-50 transition-colors shrink-0"
                title={is100Full ? "Drop down to view map" : "Drop up full requests view"}
                role="button"
                tabIndex={0}
                aria-label="Toggle live requests screen height"
              >
                <div className="w-12 h-1.5 rounded-full bg-slate-300 group-hover:bg-slate-600 transition-colors" />
              </div>

              {/* Header Bar */}
              <div
                onClick={(e) => {
                  if (!is100Full && (e.target as HTMLElement).tagName !== 'BUTTON' && !(e.target as HTMLElement).closest('button')) {
                    setIs100Full(true);
                  }
                }}
                className={`px-3.5 sm:px-5 py-2 bg-white flex items-center justify-between relative select-none shadow-sm ${
                  is100Full ? 'border-b border-slate-200' : 'cursor-pointer hover:bg-slate-50 transition-colors'
                }`}
              >
                {/* Left: Live Requests Count */}
                <div className="flex items-center gap-2 min-w-0">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs font-bold font-mono-num">
                    <Bike className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>{availableRides.length} Live Requests</span>
                  </div>
                </div>

                {/* Right: Toggle Button */}
                <div className="flex items-center justify-end min-w-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIs100Full((prev) => !prev);
                    }}
                    className="p-2 sm:px-3 sm:py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-black border border-black text-xs font-black transition-all active:scale-95 cursor-pointer group shadow-xs flex items-center gap-1.5"
                    title={is100Full ? "Drop down to view full map" : "Drop up full requests view"}
                    aria-label={is100Full ? "Drop down" : "Drop up full"}
                  >
                    {is100Full ? (
                      <ChevronDown className="w-4 h-4 text-black group-hover:translate-y-0.5 transition-transform stroke-[2.5]" />
                    ) : (
                      <ChevronUp className="w-4 h-4 text-black group-hover:-translate-y-0.5 transition-transform stroke-[2.5]" />
                    )}
                  </button>
                </div>
              </div>

              {/* Main Interior Content */}
              {is100Full && (
                <div className="flex-1 overflow-y-auto px-3.5 sm:px-6 py-4 scrollbar-thin bg-white">
                  {renderCaptainControls()}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Captain Profile 2-Lines Button in Left Top Corner of Main Page */}
      {!inspectedRide && (
        <button
          type="button"
          onClick={() => setIsProfileOpen(true)}
          title="Open Captain Profile"
          aria-label="Open Captain Profile"
          className="fixed sm:absolute top-3 sm:top-4 left-3 sm:left-4 z-[1100] p-2.5 sm:p-3 rounded-2xl bg-black/85 hover:bg-black text-white border border-amber-500/40 shadow-2xl backdrop-blur-xl flex flex-col justify-center items-center gap-1.5 w-11 h-11 active:scale-95 transition-all cursor-pointer group ring-1 ring-amber-500/20"
        >
          <span className="w-5 h-0.5 bg-amber-400 rounded-full group-hover:w-5.5 transition-all" />
          <span className="w-3.5 h-0.5 bg-amber-400 rounded-full self-start ml-0.5 group-hover:w-5 transition-all" />
        </button>
      )}

      {/* Dedicated Captain Wallet View Tab Overlay */}
      {activeTab === 'wallet' && (
        <div className="fixed inset-0 z-[1150] pt-16 sm:pt-20 pb-10 px-3 sm:px-6 md:px-8 bg-slate-950/95 backdrop-blur-xl overflow-y-auto flex flex-col gap-6 animate-in fade-in duration-200 scrollbar-thin">
          <div className="max-w-4xl mx-auto w-full flex flex-col gap-6">
            
            {/* Header Notification Toast */}
            {walletMessage && (
              <div className="p-4 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-extrabold flex items-center justify-between shadow-xl animate-in fade-in slide-in-from-top-2">
                <span>{walletMessage}</span>
                <button
                  type="button"
                  onClick={() => setWalletMessage(null)}
                  className="p-1 rounded-lg bg-emerald-500/30 hover:bg-emerald-500/50 text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Wallet Header Bar */}
            <div className="flex items-center justify-between bg-slate-900 border border-slate-800 p-4 sm:p-5 rounded-3xl shadow-xl">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500/25 to-amber-600/10 border border-amber-500/40 text-amber-400 flex items-center justify-center shadow-inner shrink-0">
                  <Wallet className="w-6 h-6 stroke-[2.5]" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base sm:text-lg font-black text-white">Captain Wallet</h2>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold">
                      Active Partner
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-medium">
                    Manage driver balance and top-up via Official Admin QR code
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('documents')}
                  className="px-3.5 py-2.5 rounded-2xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 font-bold text-xs transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <ShieldCheck className="w-4 h-4 stroke-[2.5]" />
                  <span>Documents & KYC</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('requests')}
                  className="px-4 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition-all active:scale-95 flex items-center gap-2 shadow-lg shadow-amber-950/50 cursor-pointer shrink-0"
                >
                  <Bike className="w-4 h-4 stroke-[2.5]" />
                  <span>Back to Map & Requests</span>
                </button>
              </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Card 1: Balance */}
              <div className="p-5 rounded-3xl bg-gradient-to-br from-slate-900 to-slate-950 border border-amber-500/30 shadow-xl flex flex-col justify-between relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl group-hover:bg-amber-500/10 transition-all" />
                <div>
                  <span className="text-[11px] font-bold text-slate-400 tracking-wider uppercase block mb-1">
                    DRIVER WALLET BALANCE
                  </span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl sm:text-4xl font-black text-amber-400 font-mono-num tracking-tight">
                      ₹{walletBalance.toFixed(2)}
                    </span>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-medium">Status</span>
                  <span className={`font-bold px-2 py-0.5 rounded-lg ${
                    walletBalance >= 50
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  }`}>
                    {walletBalance >= 50 ? 'Eligible for Rides' : 'Low Balance (Top Up Required)'}
                  </span>
                </div>
              </div>

              {/* Card 2: Today's Income */}
              <div className="p-5 rounded-3xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 shadow-xl flex flex-col justify-between">
                <div>
                  <span className="text-[11px] font-bold text-slate-400 tracking-wider uppercase block mb-1">
                    TODAY'S GROSS EARNINGS
                  </span>
                  <span className="text-3xl sm:text-4xl font-black text-emerald-400 font-mono-num tracking-tight">
                    ₹{todayIncome.toFixed(2)}
                  </span>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                  <span>Completed Today</span>
                  <span className="font-bold text-white">{todayCompletedRidesCount} Rides</span>
                </div>
              </div>

              {/* Card 3: Commission Rule */}
              <div className="p-5 rounded-3xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 shadow-xl flex flex-col justify-between">
                <div>
                  <span className="text-[11px] font-bold text-slate-400 tracking-wider uppercase block mb-1">
                    PLATFORM COMMISSION
                  </span>
                  <span className="text-2xl font-black text-slate-200">
                    10%
                  </span>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Deducted automatically per completed ride from driver wallet.
                  </p>
                </div>
                <div className="mt-3 pt-2.5 border-t border-slate-800/80 text-[11px] text-amber-300/90 font-medium flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Maintain min ₹50 balance</span>
                </div>
              </div>
            </div>

            {/* Main Action Section: Topup via Official Admin QR */}
            <div className="w-full">
              
              {/* Top-Up Section with Official Admin QR */}
              <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 flex flex-col gap-5 shadow-xl">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400">
                      <QrCode className="w-5 h-5 stroke-[2.5]" />
                    </div>
                    <div>
                      <h3 className="text-sm font-extrabold text-white">Top-Up Wallet via Official QR</h3>
                      <span className="text-[11px] text-slate-400">Scan & Pay using PhonePe, Google Pay, or Paytm</span>
                    </div>
                  </div>
                </div>

                {/* Official QR Code Box */}
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row items-center gap-4">
                  <div className="w-32 h-32 rounded-2xl bg-white p-2 flex items-center justify-center shrink-0 shadow-lg">
                    {qrSettings?.qr_image_url ? (
                      <img
                        src={qrSettings.qr_image_url}
                        alt="Official Admin QR Code"
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="w-full h-full bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 text-xs font-bold text-center">
                        Official QR Code
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 min-w-0 w-full text-center sm:text-left">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">OFFICIAL UPI PAY ID</span>
                    <div className="flex items-center justify-center sm:justify-start gap-2">
                      <span className="text-xs font-mono font-bold text-amber-400 truncate bg-slate-900 px-2.5 py-1 rounded-xl border border-slate-800">
                        {qrSettings?.upi_id || 'hemant76@idbi'}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopyUpi(qrSettings?.upi_id || 'hemant76@idbi')}
                        className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-white font-bold transition-all cursor-pointer border border-slate-700 shrink-0"
                      >
                        {copiedUpiToast ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      {qrSettings?.note || 'Scan using PhonePe, Google Pay, or Paytm to deposit commission or top up balance.'}
                    </p>
                  </div>
                </div>

                {/* Preset Buttons & Custom Input */}
                <div className="flex flex-col gap-3">
                  <label className="text-xs font-bold text-slate-300">Select Top-Up Amount (₹)</label>
                  <div className="grid grid-cols-4 gap-2">
                    {[100, 200, 500, 1000].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setTopupAmountInput(amt.toString())}
                        className={`py-2 rounded-xl text-xs font-extrabold font-mono-num transition-all cursor-pointer border ${
                          topupAmountInput === amt.toString()
                            ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md shadow-emerald-950/40'
                            : 'bg-slate-950 text-slate-200 border-slate-800 hover:bg-slate-800'
                        }`}
                      >
                        +₹{amt}
                      </button>
                    ))}
                  </div>

                  <input
                    type="number"
                    value={topupAmountInput}
                    onChange={(e) => setTopupAmountInput(e.target.value)}
                    placeholder="Enter custom amount (₹)"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono-num font-bold text-white focus:outline-none focus:border-amber-500/50"
                  />

                  {/* UTR / Reference No. & Payment Slip Upload */}
                  <div className="flex flex-col gap-2 pt-2 border-t border-slate-800">
                    <label className="text-xs font-bold text-amber-300">1. Enter Transaction / UTR No.</label>
                    <input
                      type="text"
                      value={utrInput}
                      onChange={(e) => setUtrInput(e.target.value)}
                      placeholder="e.g. 12-digit UPI UTR No. (492819283712)"
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-white focus:outline-none focus:border-amber-500/50"
                    />

                    <label className="text-xs font-bold text-amber-300 mt-1">2. Upload Payment Slip / Paid Receipt Screenshot</label>
                    <label className="w-full p-3 rounded-xl bg-slate-950 hover:bg-slate-800/80 border border-dashed border-amber-500/40 text-xs font-bold text-white cursor-pointer transition-all flex flex-col items-center justify-center gap-1.5 text-center shadow-inner">
                      <UploadCloud className="w-5 h-5 text-emerald-400" />
                      <span>{paymentSlipInput ? 'Change Payment Slip Screenshot' : 'Upload Payment Slip Proof'}</span>
                      <span className="text-[10px] text-slate-400 font-normal">Supports JPG, PNG, Screenshots</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          try {
                            const compressed = await compressImage(file, 1200, 1200, 0.85);
                            setPaymentSlipInput(compressed);
                          } catch {
                            const reader = new FileReader();
                            reader.onload = (ev) => {
                              const result = ev.target?.result as string;
                              if (result) setPaymentSlipInput(result);
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </label>

                    {paymentSlipInput && (
                      <div className="relative w-full h-32 rounded-xl overflow-hidden border border-emerald-500/50 shadow-md mt-1">
                        <img src={paymentSlipInput} alt="Uploaded Payment Slip" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setPaymentSlipInput(null)}
                          className="absolute top-2 right-2 px-2 py-1 rounded-lg bg-red-600 text-white text-[10px] font-bold cursor-pointer shadow"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Submit Proof to Admin Button */}
                  <button
                    type="button"
                    onClick={handleSubmitDepositProof}
                    disabled={isSubmittingProof || !paymentSlipInput}
                    className="w-full py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-xl shadow-amber-950/50 transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-40"
                  >
                    <Send className="w-4 h-4 stroke-[2.5]" />
                    <span>{isSubmittingProof ? 'Submitting Payment Proof...' : 'Submit Payment Proof & Open Chat'}</span>
                  </button>
                </div>
              </div>

            </div>

            {/* Submitted Top-Up Requests & Live Verification Chat list */}
            {captainTopupRequests.length > 0 && (
              <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 flex flex-col gap-4 shadow-xl">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-amber-400 stroke-[2.5]" />
                    <h3 className="text-sm font-extrabold text-white">My Top-Up Deposit Proofs & Admin Verification Chat</h3>
                  </div>
                  <span className="text-xs font-mono font-bold text-amber-400">
                    {captainTopupRequests.length} Requests
                  </span>
                </div>

                <div className="flex flex-col gap-3">
                  {captainTopupRequests.map((req, idx) => (
                    <div
                      key={`${req.id || 'req'}_${idx}_${req.created_at || ''}`}
                      className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-700 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        {req.payment_slip_url ? (
                          <img
                            src={req.payment_slip_url}
                            alt="Payment Proof"
                            className="w-14 h-14 object-cover rounded-xl border border-slate-800 shrink-0 cursor-pointer"
                            onClick={() => setActiveChatRequest(req)}
                          />
                        ) : (
                          <div className="w-14 h-14 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-amber-400 font-bold shrink-0">
                            QR
                          </div>
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-base font-black text-amber-400 font-mono-num">
                              ₹{req.amount.toFixed(2)}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              req.status === 'approved'
                                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                : req.status === 'rejected'
                                ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                                : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                            }`}>
                              {req.status === 'approved'
                                ? '✅ Approved & Credited'
                                : req.status === 'rejected'
                                ? '❌ Rejected'
                                : '⏳ Pending Admin Verification'}
                            </span>
                          </div>
                          <span className="text-xs text-slate-300 font-mono block mt-0.5">
                            UTR: {req.utr_number || 'N/A'} • Submitted {new Date(req.created_at).toLocaleString()}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setActiveChatRequest(req)}
                        className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 shadow"
                      >
                        <MessageSquare className="w-4 h-4 stroke-[2.5]" />
                        <span>Open Verification Chat</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Transaction Log Table */}
            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 flex flex-col gap-4 shadow-xl">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <History className="w-5 h-5 text-amber-400 stroke-[2.5]" />
                  <h3 className="text-sm font-extrabold text-white">Wallet Transaction History</h3>
                </div>
                <span className="text-xs font-mono font-bold text-slate-400">
                  {walletTransactions.length} Transactions
                </span>
              </div>

              <div className="flex flex-col gap-2 max-h-80 overflow-y-auto pr-1 scrollbar-thin">
                {walletTransactions.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 text-xs font-medium">
                    No transactions recorded yet.
                  </div>
                ) : (
                  walletTransactions.map((tx) => {
                    const isCommission = tx.category === 'commission_fee' || (tx.category as string) === 'platform_commission' || tx.description?.includes('Commission') || Boolean(tx.reference_ride_id);
                    const grossFare = tx.gross_fare || (isCommission ? Number((tx.amount / 0.1).toFixed(2)) : 0);
                    const captainEarn = tx.captain_earning || (grossFare ? Number((grossFare - tx.amount).toFixed(2)) : 0);
                    const rideCode = tx.ride_code || (tx.reference_ride_id ? tx.reference_ride_id.slice(0, 8).toUpperCase() : '');

                    if (isCommission) {
                      return (
                        <div
                          key={tx.id}
                          className="p-4 rounded-2xl bg-slate-950 border border-amber-500/40 hover:border-amber-500/60 transition-all flex flex-col gap-3 shadow-md"
                        >
                          {/* Commission Header */}
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2">
                              <span className="px-2.5 py-1 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-300 font-extrabold text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                                <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                                <span>10% Platform Commission</span>
                              </span>
                              {rideCode && (
                                <span className="font-mono text-xs font-bold text-white bg-slate-900 px-2 py-0.5 rounded-lg border border-slate-800">
                                  #{rideCode}
                                </span>
                              )}
                            </div>
                            <span className="text-base font-black font-mono text-rose-400">
                              -₹{Math.abs(tx.amount).toFixed(2)}
                            </span>
                          </div>

                          {/* Financial Breakdown Grid */}
                          <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-slate-900 border border-slate-800/90 text-xs">
                            <div>
                              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-0.5">
                                Gross Ride Fare
                              </span>
                              <span className="font-mono font-bold text-white text-sm">
                                ₹{grossFare > 0 ? grossFare.toFixed(2) : '-'}
                              </span>
                            </div>

                            <div>
                              <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider block mb-0.5">
                                10% Commission
                              </span>
                              <span className="font-mono font-bold text-amber-300 text-sm">
                                -₹{Math.abs(tx.amount).toFixed(2)}
                              </span>
                            </div>

                            <div>
                              <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider block mb-0.5">
                                Net Take-Home
                              </span>
                              <span className="font-mono font-black text-emerald-400 text-sm">
                                +₹{captainEarn > 0 ? `₹${captainEarn.toFixed(2)}` : '-'}
                              </span>
                            </div>
                          </div>

                          {/* Journey & Balance Footer */}
                          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-900 flex-wrap gap-2">
                            <span className="font-mono">
                              {tx.created_at ? new Date(tx.created_at).toLocaleString() : 'Just now'}
                            </span>
                            <div className="flex items-center gap-2">
                              {tx.wallet_balance_before !== undefined && tx.wallet_balance_after !== undefined && (
                                <span className="font-mono text-slate-300">
                                  Balance: ₹{tx.wallet_balance_before.toFixed(2)} → <span className="font-bold text-amber-300">₹{tx.wallet_balance_after.toFixed(2)}</span>
                                </span>
                              )}
                              <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold">
                                Synced to Main Wallet
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={tx.id}
                        className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800/80 flex items-center justify-between gap-3 hover:border-slate-700 transition-all"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                            tx.type === 'credit'
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                          }`}>
                            {tx.type === 'credit' ? (
                              <ArrowDownLeft className="w-4 h-4 stroke-[2.5]" />
                            ) : (
                              <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
                            )}
                          </div>
                          <div>
                            <span className="text-xs font-bold text-white block">
                              {tx.description || (tx.type === 'credit' ? 'Wallet Credit / Top-Up' : 'Commission / Withdrawal')}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono block">
                              {tx.created_at ? new Date(tx.created_at).toLocaleString() : 'Just now'}
                            </span>
                          </div>
                        </div>

                        <span className={`text-sm font-black font-mono shrink-0 ${
                          tx.type === 'credit' ? 'text-emerald-400' : 'text-amber-400'
                        }`}>
                          {tx.type === 'credit' ? '+' : '-'}₹{Math.abs(tx.amount).toFixed(2)}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Dedicated Captain Documents Tab Overlay */}
      {activeTab === 'documents' && (
        <CaptainDocumentsTab
          captain={captain}
          onClose={() => setActiveTab('requests')}
          onUpdateCaptain={handleUpdateCaptainProfile}
          onOpenWallet={() => setActiveTab('wallet')}
        />
      )}

      {/* Captain Profile Slide-in Drawer from Left to Right */}
      <CaptainProfileDrawer
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        captain={captain}
        todayIncome={todayIncome}
        onUpdateCaptain={handleUpdateCaptainProfile}
        onOpenWallet={() => {
          setIsProfileOpen(false);
          setActiveTab('wallet');
          onOpenWallet?.();
        }}
        onOpenDocuments={() => {
          setIsProfileOpen(false);
          setActiveTab('documents');
        }}
        onOpenRideHistory={() => setIsRideHistoryOpen(true)}
        onSignOut={onSignOut}
      />

      {/* Trip History Modal for Captain */}
      <MotorideRideHistoryModal
        isOpen={isRideHistoryOpen}
        onClose={() => setIsRideHistoryOpen(false)}
        role="captain"
        userId={captainId || captain?.id || captain?.profile_id || ''}
        userName={captain?.full_name || captainName || 'Captain'}
        todayIncome={todayIncome}
      />

      {/* Floating GPS Status Banner when permission is blocked */}
      {gpsStatus === 'denied' && (
        <div className="absolute top-16 sm:top-4 left-1/2 -translate-x-1/2 z-[1100] w-[92%] sm:w-auto max-w-md bg-black/90 backdrop-blur-xl border border-rose-500/50 rounded-2xl px-3.5 py-2.5 shadow-2xl flex items-center justify-between gap-3 text-xs text-white">
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span className="truncate">{gpsErrorMessage || 'Location permission required for live tracking'}</span>
          </div>
          <button
            type="button"
            onClick={startWatchingLocation}
            className="px-3 py-1 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] shrink-0 cursor-pointer shadow-md transition-all active:scale-95"
          >
            Allow GPS
          </button>
        </div>
      )}

      {showChatModal && activeRide && (
        <div className="fixed inset-0 z-[2000] bg-slate-900/80 backdrop-blur-md flex flex-col p-3 sm:p-6 md:p-8 animate-in fade-in duration-150">
          <div className="w-full max-w-4xl mx-auto mb-3 sm:mb-4 flex items-center justify-between">
            <button
              onClick={() => {
                setShowChatModal(false);
                setHasUnreadMessages(false);
                if (activeRide?.id) {
                  safeStorage.setItem(`motoride_last_read_chat_${activeRide.id}`, Date.now().toString());
                }
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white hover:bg-slate-100 text-slate-900 font-extrabold text-xs sm:text-sm border border-slate-200 transition-all cursor-pointer shadow-lg active:scale-95"
            >
              <ArrowLeft className="w-4 h-4 stroke-[2.5] text-slate-900" />
              <span>Back to Ride Details</span>
            </button>
            <span className="text-xs text-white font-mono font-bold bg-black/50 px-3 py-1.5 rounded-xl border border-white/20 shadow-xs">Ride #{activeRide.ride_code}</span>
          </div>
          <div className="flex-1 w-full max-w-4xl mx-auto flex flex-col overflow-hidden">
            <RideChatModal
              ride={activeRide}
              currentUserId={captainId}
              currentUserRole="captain"
              currentUserName={captain?.full_name || 'Captain'}
              onClose={() => {
                setShowChatModal(false);
                setHasUnreadMessages(false);
                if (activeRide?.id) {
                  safeStorage.setItem(`motoride_last_read_chat_${activeRide.id}`, Date.now().toString());
                }
              }}
            />
          </div>
        </div>
      )}

      {/* Captain Rates Passenger Modal at the End of Trip */}
      {showPassengerRatingModal && completedRideForRating && (
        <CaptainPassengerRatingModal
          ride={completedRideForRating}
          captainName={captain?.full_name || 'Captain'}
          isSubmitting={isFinishingRide}
          onSubmit={(score, review, tags) => handleFinishRideWithRating(score, review, tags, false)}
          onSkip={() => handleFinishRideWithRating(5, '', [], true)}
          onClose={() => handleFinishRideWithRating(5, '', [], true)}
        />
      )}

      {/* Top-up Verification Chat Modal for Captain */}
      {activeChatRequest && (
        <TopupChatModal
          isOpen={!!activeChatRequest}
          onClose={() => setActiveChatRequest(null)}
          depositRequest={activeChatRequest}
          currentUserId={captainId}
          currentUserRole="captain"
          currentUserName={captain?.full_name || captainName || 'Captain'}
          onStatusUpdated={() => {
            loadCaptainTopupRequests();
            motorideApi.getWallet(captainId).then(w => {
              if (w && w.wallet) setWalletBalance(w.wallet.balance);
            });
          }}
        />
      )}
    </div>
  );
};
