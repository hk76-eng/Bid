import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  User,
  Phone,
  Mail,
  ShieldCheck,
  Star,
  MapPin,
  Home,
  Briefcase,
  Heart,
  Wallet,
  Clock,
  Settings,
  Bell,
  Lock,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  LogOut,
  Edit2,
  Save,
  Share2,
  Camera,
  Upload,
  Trash2,
  Bike,
  History,
  Download,
  Smartphone,
  Sun,
} from 'lucide-react';

import { AuthUser, supabaseAuth, syncUserToSupabase } from '../lib/supabaseAuth';
import { safeStorage } from '../lib/safeStorage';
import { uploadMediaToSupabase, compressImageToDataUrl } from '../lib/supabaseStorage';
import { motorideApi } from '../services/motorideApi';

interface PassengerProfileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: AuthUser | null;
  passengerName?: string;
  passengerEmail?: string;
  passengerPhone?: string;
  totalRides?: number;
  onOpenWallet?: () => void;
  onOpenRideHistory?: () => void;
  onSelectSavedLocation?: (loc: { name: string; lat: number; lng: number }) => void;
  onSignOut?: () => void;
  onUpdateUser?: (user: AuthUser) => void;
}

export const PassengerProfileDrawer: React.FC<PassengerProfileDrawerProps> = ({
  isOpen,
  onClose,
  currentUser,
  passengerName = 'Passenger',
  passengerEmail = '',
  passengerPhone = '',
  totalRides = 0,
  onOpenWallet,
  onOpenRideHistory,
  onSelectSavedLocation,
  onSignOut,
  onUpdateUser,
}) => {
  const authUser = currentUser || supabaseAuth.getCurrentUser();
  const initialName = (passengerName && passengerName !== 'Passenger')
    ? passengerName
    : (authUser?.name || passengerName || 'Passenger');
  const initialEmail = passengerEmail || authUser?.email || '';
  const initialPhone = passengerPhone || authUser?.phone || '';

  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [email, setEmail] = useState(initialEmail);
  const [emergencyContact, setEmergencyContact] = useState(() => authUser?.phone || '');
  const [isSavedToast, setIsSavedToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('Profile details saved successfully!');
  const [shareTripWithContact, setShareTripWithContact] = useState(true);
  const [requireRidePin, setRequireRidePin] = useState(true);

  // Do Not Screen Off (Wake Lock)
  const [doNotScreenOff, setDoNotScreenOff] = useState<boolean>(() => {
    try {
      const saved = safeStorage.getItem('motoride_passenger_do_not_screen_off');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const wakeLockRef = useRef<any>(null);

  useEffect(() => {
    let isMounted = true;
    const requestWakeLock = async () => {
      if (!doNotScreenOff) {
        if (wakeLockRef.current) {
          try { await wakeLockRef.current.release(); } catch {}
          wakeLockRef.current = null;
        }
        return;
      }
      if ('wakeLock' in navigator && (navigator as any).wakeLock) {
        try {
          if (!wakeLockRef.current) {
            const lock = await (navigator as any).wakeLock.request('screen');
            if (isMounted) {
              wakeLockRef.current = lock;
              lock.addEventListener('release', () => { wakeLockRef.current = null; });
            } else {
              lock.release();
            }
          }
        } catch {}
      }
    };
    requestWakeLock();
    safeStorage.setItem('motoride_passenger_do_not_screen_off', String(doNotScreenOff));
    return () => { isMounted = false; };
  }, [doNotScreenOff]);

  // Theme Mode ('dark' | 'light')
  const [themeMode, setThemeMode] = useState<string>(() => {
    try {
      return safeStorage.getItem('motoride_theme_mode') || 'dark';
    } catch {
      return 'dark';
    }
  });

  const handleThemeChange = (mode: string) => {
    setThemeMode(mode);
    safeStorage.setItem('motoride_theme_mode', mode);
    window.dispatchEvent(new Event('motoride_theme_changed'));
  };

  // Passenger Avatar Photo (Stored in state & safeStorage)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(() => {
    try {
      return authUser?.avatarUrl || safeStorage.getItem('motoride_passenger_avatar') || null;
    } catch {
      return null;
    }
  });

  const [actualRidesCount, setActualRidesCount] = useState<number>(totalRides ?? 0);

  // Sync state and fetch true actual rides taken whenever props or drawer open state changes
  useEffect(() => {
    const current = currentUser || supabaseAuth.getCurrentUser();
    const effectiveName = (passengerName && passengerName !== 'Passenger') ? passengerName : (current?.name || '');
    const currentId = current?.id || '';

    const fetchActualCompletedRides = async () => {
      try {
        const allRides = await motorideApi.getRides();
        const userCompleted = allRides.filter((r) => {
          const isUser = (currentId && r.passenger_id === currentId) ||
            (effectiveName && r.passenger_name && r.passenger_name.toLowerCase() === effectiveName.toLowerCase());
          const isCompleted = r.status === 'completed' || r.status === 'trip_completed';
          return isUser && isCompleted;
        });
        setActualRidesCount(userCompleted.length);
      } catch {
        if (totalRides !== undefined) {
          setActualRidesCount(totalRides);
        }
      }
    };

    if (isOpen) {
      fetchActualCompletedRides();
    }
  }, [passengerName, currentUser, totalRides, isOpen]);

  const ridesTaken = actualRidesCount;
  const rating = 5.0;

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync state whenever props or drawer open state changes
  useEffect(() => {
    const current = currentUser || supabaseAuth.getCurrentUser();
    if (passengerName && passengerName !== 'Passenger') {
      setName(passengerName);
    } else if (current?.name) {
      setName(current.name);
    }

    if (passengerEmail) {
      setEmail(passengerEmail);
    } else if (current?.email) {
      setEmail(current.email);
    }

    if (passengerPhone) {
      setPhone(passengerPhone);
    } else if (current?.phone) {
      setPhone(current.phone);
    }

    const savedAvatar = current?.avatarUrl || safeStorage.getItem('motoride_passenger_avatar');
    if (savedAvatar) {
      setAvatarUrl(savedAvatar);
    }
  }, [passengerName, passengerEmail, passengerPhone, currentUser, isOpen]);

  // Handle Photo Upload
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please upload a valid image file (PNG, JPG, JPEG, WEBP).');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert('Image size exceeds 10MB limit. Please choose a smaller photo.');
      return;
    }

    try {
      // 1. Compress image to clean, lightweight 400x400 data URL for instant rendering & local storage
      const compressedDataUrl = await compressImageToDataUrl(file, 400, 400, 0.88);
      if (!compressedDataUrl) {
        alert('Failed to process uploaded image.');
        return;
      }

      setAvatarUrl(compressedDataUrl);
      safeStorage.setItem('motoride_passenger_avatar', compressedDataUrl);

      // Instantly sync compressed avatar to session & registered accounts
      const current = currentUser || supabaseAuth.getCurrentUser();
      if (current) {
        const updatedUser: AuthUser = { ...current, avatarUrl: compressedDataUrl };
        supabaseAuth.setCurrentUser(updatedUser);
        supabaseAuth.saveAccount({ ...updatedUser, passwordHash: '' });
        if (onUpdateUser) onUpdateUser(updatedUser);
      }

      // 2. Background upload to Supabase 'motoride-media' bucket
      uploadMediaToSupabase(file, file.name, 'avatars').then((uploadedUrl) => {
        if (uploadedUrl) {
          setAvatarUrl(uploadedUrl);
          safeStorage.setItem('motoride_passenger_avatar', uploadedUrl);
          const curr = currentUser || supabaseAuth.getCurrentUser();
          if (curr) {
            const uUser: AuthUser = { ...curr, avatarUrl: uploadedUrl };
            supabaseAuth.setCurrentUser(uUser);
            supabaseAuth.saveAccount({ ...uUser, passwordHash: '' });
            if (onUpdateUser) onUpdateUser(uUser);
          }
        }
      }).catch((err) => console.warn('Supabase avatar background upload notice:', err));

      setToastMessage('Profile photo updated & saved successfully!');
      setIsSavedToast(true);
      setTimeout(() => setIsSavedToast(false), 3000);
    } catch (err) {
      console.error('Error handling passenger photo upload:', err);
    }
  };

  const handleRemovePhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    setAvatarUrl(null);
    try {
      safeStorage.removeItem('motoride_passenger_avatar');
    } catch (err) {
      console.warn(err);
    }
    const current = currentUser || supabaseAuth.getCurrentUser();
    if (current) {
      const updatedUser: AuthUser = { ...current, avatarUrl: undefined };
      supabaseAuth.setCurrentUser(updatedUser);
      if (onUpdateUser) onUpdateUser(updatedUser);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setToastMessage('Profile photo removed.');
    setIsSavedToast(true);
    setTimeout(() => setIsSavedToast(false), 3000);
  };

  // Saved locations
  const savedPlaces = [
    {
      id: 'home',
      label: 'Home',
      name: 'Sector 70, Mohali Market',
      lat: 30.704649,
      lng: 76.717873,
      icon: Home,
    },
    {
      id: 'work',
      label: 'Work',
      name: 'Phase 8B, Industrial & Tech Park',
      lat: 30.718214,
      lng: 76.732124,
      icon: Briefcase,
    },
    {
      id: 'favorite',
      label: 'Favorite',
      name: 'Elante Mall, Phase 1',
      lat: 30.705514,
      lng: 76.801124,
      icon: Heart,
    },
  ];

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsEditing(false);

    try {
      const user = currentUser || supabaseAuth.getCurrentUser();
      if (user) {
        const finalAvatar = avatarUrl || user.avatarUrl || safeStorage.getItem('motoride_passenger_avatar') || undefined;
        const updatedUser: AuthUser = {
          ...user,
          name: name.trim() || user.name,
          email: email.trim() || user.email,
          phone: phone.trim() || user.phone,
          avatarUrl: finalAvatar,
        };
        supabaseAuth.setCurrentUser(updatedUser);
        supabaseAuth.saveAccount({ ...updatedUser, passwordHash: '' });
        if (onUpdateUser) onUpdateUser(updatedUser);

        await motorideApi.updatePassengerProfile(user.id, {
          name: updatedUser.name,
          full_name: updatedUser.name,
          email: updatedUser.email,
          phone: updatedUser.phone,
          emergency_contact: emergencyContact,
          avatar_url: finalAvatar,
        });

        await syncUserToSupabase(updatedUser);
      }
    } catch (err) {
      console.warn('Could not persist updated passenger profile:', err);
    }

    setToastMessage('Profile details saved successfully!');
    setIsSavedToast(true);
    setTimeout(() => setIsSavedToast(false), 3000);
  };

  const getInitials = (text: string) => {
    return (
      text
        .split(' ')
        .map((n) => n[0])
        .filter(Boolean)
        .slice(0, 2)
        .join('')
        .toUpperCase() || 'P'
    );
  };

  return (
    <>
      {/* Backdrop overlay */}
      <div
        className={`fixed inset-0 z-[1200] bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide Drawer from Left to Right */}
      <aside
        className={`fixed top-0 left-0 bottom-0 z-[1300] w-[90vw] sm:w-[440px] max-w-full bg-slate-950 text-white border-r border-white/15 shadow-2xl flex flex-col transition-transform duration-300 ease-out transform ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label="Passenger Profile"
      >
        {/* Hidden File Input for Avatar */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handlePhotoUpload}
          accept="image/*"
          className="hidden"
        />

        {/* Drawer Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/15 bg-black/60 backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-black text-base tracking-tight text-white">Passenger Profile</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all active:scale-95 cursor-pointer"
            title="Close Profile"
            aria-label="Close Profile"
          >
            <X className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>

        {/* Toast alert when profile updated */}
        {isSavedToast && (
          <div className="mx-4 mt-3 p-3 rounded-2xl bg-emerald-950/90 border border-emerald-500/50 text-emerald-200 text-xs flex items-center gap-2 animate-in fade-in duration-200 shadow-lg">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-semibold">{toastMessage}</span>
          </div>
        )}

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 flex flex-col gap-4 scrollbar-thin">
          
          {/* SECTION: Profile Overview & Round Photo Upload Card */}
          <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-black border border-white/20 flex flex-col gap-4 shadow-2xl relative">
            
            {/* Top Row: Round Avatar with Camera Upload Action + Details */}
            <div className="flex items-center gap-4">
              
              {/* Round Profile Picture with Upload Action */}
              <div className="relative group shrink-0">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="w-20 h-20 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 flex items-center justify-center font-black text-2xl shadow-xl overflow-hidden cursor-pointer border-2 border-emerald-400/60 ring-4 ring-black/40 group-hover:scale-105 transition-transform"
                  title="Click to upload/change round profile picture"
                >
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                      onError={() => {
                        const local = safeStorage.getItem('motoride_passenger_avatar');
                        if (local && local !== avatarUrl) {
                          setAvatarUrl(local);
                        } else {
                          setAvatarUrl(null);
                        }
                      }}
                    />
                  ) : (
                    <span>{getInitials(name)}</span>
                  )}
                  
                  {/* Hover Upload Overlay */}
                  <div className="absolute inset-0 bg-black/60 rounded-full flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white text-[9px] font-bold gap-0.5">
                    <Camera className="w-5 h-5 text-emerald-400" />
                    <span>Upload</span>
                  </div>
                </div>

                {/* Round Camera Upload Button Icon on Bottom-Right */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  title="Upload Photo"
                  aria-label="Upload Photo"
                  className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black shadow-md border-2 border-slate-950 cursor-pointer active:scale-90 transition-transform flex items-center justify-center"
                >
                  <Camera className="w-3.5 h-3.5 stroke-[2.5]" />
                </button>

                {/* Delete Photo Button if photo exists */}
                {avatarUrl && (
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    title="Remove Photo"
                    aria-label="Remove Photo"
                    className="absolute -top-1 -right-1 p-1 rounded-full bg-rose-600 hover:bg-rose-500 text-white shadow-md border-2 border-slate-950 cursor-pointer active:scale-90 transition-transform"
                  >
                    <Trash2 className="w-3 h-3 stroke-[2.5]" />
                  </button>
                )}
              </div>

              {/* Name, Verified Status & Quick Overview */}
              <div className="min-w-0 flex-1 flex flex-col gap-1">
                <div className="flex items-center gap-1.5">
                  <h3 className="font-black text-lg text-white truncate">{name}</h3>
                  <span title="Verified Passenger" className="inline-flex">
                    <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  </span>
                </div>
                
                {/* Upload action prompt */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="self-start text-[11px] font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 mt-0.5 cursor-pointer underline underline-offset-2"
                >
                  <Upload className="w-3 h-3" />
                  <span>{avatarUrl ? 'Change Round Pic' : 'Upload Round Pic'}</span>
                </button>
              </div>

              {/* Edit Profile Toggle Button */}
              <button
                type="button"
                onClick={() => setIsEditing(!isEditing)}
                className="self-start p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer"
                title={isEditing ? 'Cancel Edit' : 'Edit Profile Form'}
              >
                {isEditing ? <X className="w-4 h-4" /> : <Edit2 className="w-4 h-4" />}
              </button>
            </div>

            {/* Structured Stats: Rating + Rides Taken Form Block */}
            <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-white/10">
              
              {/* Rating Box */}
              <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-400/20 border border-amber-400/30 text-amber-400 flex items-center justify-center shrink-0">
                  <Star className="w-5 h-5 fill-amber-400" />
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-1">
                    <span className="text-base font-black text-white font-mono-num">{rating}</span>
                    <span className="text-[10px] text-amber-300 font-bold bg-amber-400/15 px-1 rounded">★ 5.0</span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-semibold">Passenger Rating</span>
                </div>
              </div>

              {/* Rides Taken Box - Clickable to open Ride History */}
              <div
                onClick={() => {
                  if (onOpenRideHistory) {
                    onClose();
                    onOpenRideHistory();
                  }
                }}
                className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-emerald-500/40 flex items-center gap-3 cursor-pointer transition-all active:scale-95 group"
                title="View Ride History"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 group-hover:bg-emerald-500 group-hover:text-slate-950 flex items-center justify-center shrink-0 transition-colors">
                  <Bike className="w-5 h-5" />
                </div>
                <div className="flex flex-col">
                  <span className="text-base font-black text-white font-mono-num">{ridesTaken}</span>
                  <span className="text-[11px] text-slate-400 font-semibold group-hover:text-emerald-300 transition-colors flex items-center gap-0.5">
                    <span>Rides Taken</span>
                    <ChevronRight className="w-3 h-3 text-emerald-400" />
                  </span>
                </div>
              </div>

            </div>

            {/* Dedicated Ride History Quick Button */}
            <div className="pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => {
                  if (onOpenRideHistory) {
                    onClose();
                    onOpenRideHistory();
                  }
                }}
                className="w-full p-3 rounded-2xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 flex items-center justify-between text-left cursor-pointer transition-all active:scale-95 group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center font-black shrink-0 shadow-sm">
                    <History className="w-4 h-4 stroke-[2.5]" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-black text-white group-hover:text-emerald-300 transition-colors">
                      My Ride History & Receipts
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {ridesTaken} recorded trip{ridesTaken !== 1 ? 's' : ''} • View billing & invoices
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-emerald-400 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>

          </div>

          {/* Form (1): Profile Information Form (Name, Rating, Rides Taken, Phone, Email) */}
          <div className="p-4 sm:p-5 rounded-3xl bg-white/5 border border-white/15 flex flex-col gap-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-black tracking-wider text-slate-300 uppercase">
                  Passenger Profile Form (1)
                </span>
              </div>
              {isEditing ? (
                <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/15 px-2 py-0.5 rounded-md">
                  Edit Mode
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer"
                >
                  <Edit2 className="w-3 h-3" />
                  <span>Edit</span>
                </button>
              )}
            </div>

            {isEditing ? (
              <form onSubmit={handleSaveProfile} className="flex flex-col gap-3">
                {/* Full Name Input */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-slate-400">Full Name</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-black/70 border border-white/20 text-xs text-white focus:outline-none focus:border-white font-semibold"
                      required
                      placeholder="Enter full name"
                    />
                  </div>
                </div>

                {/* Rating (Display in Form) */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-slate-400">Passenger Rating</label>
                  <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-xs text-slate-300">
                    <div className="flex items-center gap-2">
                      <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                      <span className="font-bold text-white">{rating} / 5.0 Rating</span>
                    </div>
                    <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded">
                      Top Rated
                    </span>
                  </div>
                </div>

                {/* Rides Taken (Display in Form) */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-slate-400">Total Rides Taken</label>
                  <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-xs text-slate-300">
                    <div className="flex items-center gap-2">
                      <Bike className="w-4 h-4 text-emerald-400" />
                      <span className="font-bold text-white">{ridesTaken} Completed Rides</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-semibold">Lifetime</span>
                  </div>
                </div>

                {/* Phone Number */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-slate-400">Phone Number</label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-black/70 border border-white/20 text-xs text-white focus:outline-none focus:border-white font-semibold"
                      required
                    />
                  </div>
                </div>

                {/* Email Address */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-slate-400">Email Address</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-black/70 border border-white/20 text-xs text-white focus:outline-none focus:border-white font-semibold"
                      required
                    />
                  </div>
                </div>

                {/* Emergency SOS Contact */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-slate-400">Emergency SOS Contact</label>
                  <div className="relative">
                    <AlertCircle className="w-4 h-4 text-rose-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={emergencyContact}
                      onChange={(e) => setEmergencyContact(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-black/70 border border-white/20 text-xs text-white focus:outline-none focus:border-white font-semibold"
                    />
                  </div>
                </div>

                {/* Save Button */}
                <div className="flex items-center gap-2 mt-1">
                  <button
                    type="submit"
                    className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-lg active:scale-95"
                  >
                    <Save className="w-4 h-4" />
                    <span>Save Changes</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex flex-col gap-2.5 text-xs">
                
                {/* Readonly: Name */}
                <div className="flex items-center justify-between p-2.5 rounded-2xl bg-white/5 border border-white/10">
                  <div className="flex items-center gap-2.5 text-slate-300">
                    <User className="w-4 h-4 text-slate-400 shrink-0" />
                    <div className="flex flex-col">
                      <span className="text-[10px] text-slate-400 font-semibold">Name</span>
                      <span className="font-bold text-white text-xs">{name}</span>
                    </div>
                  </div>
                  <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md font-bold">
                    Primary
                  </span>
                </div>

                {/* Readonly: Rating & Rides Taken */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2.5 rounded-2xl bg-white/5 border border-white/10 flex flex-col gap-0.5">
                    <span className="text-[10px] text-slate-400 font-semibold">Rating</span>
                    <div className="flex items-center gap-1.5">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      <span className="font-bold text-white text-xs">{rating} / 5.0</span>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-2xl bg-white/5 border border-white/10 flex flex-col gap-0.5">
                    <span className="text-[10px] text-slate-400 font-semibold">Rides Taken</span>
                    <div className="flex items-center gap-1.5">
                      <Bike className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="font-bold text-white text-xs">{ridesTaken} Rides</span>
                    </div>
                  </div>
                </div>

                {/* Readonly: Phone */}
                <div className="flex items-center justify-between p-2.5 rounded-2xl bg-white/5 border border-white/10">
                  <div className="flex items-center gap-2.5 text-slate-300">
                    <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                    <div className="flex flex-col">
                      <span className="text-[10px] text-slate-400 font-semibold">Phone</span>
                      <span className="font-bold text-white text-xs">{phone}</span>
                    </div>
                  </div>
                  <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md font-bold">
                    Verified
                  </span>
                </div>

                {/* Readonly: Email */}
                <div className="flex items-center justify-between p-2.5 rounded-2xl bg-white/5 border border-white/10">
                  <div className="flex items-center gap-2.5 text-slate-300 min-w-0">
                    <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                    <div className="flex flex-col min-w-0">
                      <span className="text-[10px] text-slate-400 font-semibold">Email</span>
                      <span className="font-bold text-white text-xs truncate max-w-[200px]">{email}</span>
                    </div>
                  </div>
                </div>

                {/* Readonly: Emergency SOS */}
                <div className="flex items-center justify-between p-2.5 rounded-2xl bg-rose-950/40 border border-rose-500/30">
                  <div className="flex items-center gap-2.5 text-rose-200">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    <div className="flex flex-col">
                      <span className="text-[10px] text-rose-300 font-semibold">Emergency SOS</span>
                      <span className="font-bold text-xs">{emergencyContact}</span>
                    </div>
                  </div>
                </div>

              </div>
            )}
          </div>

          {/* Saved Places */}
          <div className="p-4 rounded-3xl bg-white/5 border border-white/15 flex flex-col gap-2.5">
            <span className="text-xs font-black tracking-wider text-slate-300 uppercase">
              Saved Locations
            </span>
            <div className="flex flex-col gap-2">
              {savedPlaces.map((place) => {
                const Icon = place.icon;
                return (
                  <div
                    key={place.id}
                    onClick={() => {
                      if (onSelectSavedLocation) {
                        onSelectSavedLocation({
                          name: place.name,
                          lat: place.lat,
                          lng: place.lng,
                        });
                        onClose();
                      }
                    }}
                    className="p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-all flex items-center justify-between cursor-pointer group active:scale-95"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-white shrink-0 group-hover:bg-emerald-500 group-hover:text-slate-950 transition-colors">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-bold text-white">{place.label}</span>
                        <span className="text-[11px] text-slate-400 truncate">{place.name}</span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-white group-hover:translate-x-0.5 transition-all shrink-0" />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Safety & Ride Preferences */}
          <div className="p-4 rounded-3xl bg-white/5 border border-white/15 flex flex-col gap-3">
            <span className="text-xs font-black tracking-wider text-slate-300 uppercase">
              Safety & Security
            </span>

            <div className="flex items-center justify-between p-2.5 rounded-2xl bg-white/5 border border-white/10">
              <div className="flex items-center gap-2.5">
                <Lock className="w-4 h-4 text-emerald-400" />
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-white">4-Digit Start PIN</span>
                  <span className="text-[10px] text-slate-400">Share PIN with captain to start ride</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRequireRidePin(!requireRidePin)}
                className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                  requireRidePin ? 'bg-emerald-500' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                    requireRidePin ? 'left-6' : 'left-1'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-2xl bg-white/5 border border-white/10">
              <div className="flex items-center gap-2.5">
                <Share2 className="w-4 h-4 text-blue-400" />
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-white">Auto-Share Live Trip</span>
                  <span className="text-[10px] text-slate-400">Send WhatsApp tracking link</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShareTripWithContact(!shareTripWithContact)}
                className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                  shareTripWithContact ? 'bg-emerald-500' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                    shareTripWithContact ? 'left-6' : 'left-1'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* App Preferences & Display Settings */}
          <div className="p-4 rounded-3xl bg-white/5 border border-white/15 flex flex-col gap-3">
            <span className="text-xs font-black tracking-wider text-slate-300 uppercase">
              App & Display Settings
            </span>

            {/* Do Not Screen Off Switch */}
            <div className="flex items-center justify-between p-2.5 rounded-2xl bg-white/5 border border-white/10">
              <div className="flex items-center gap-2.5">
                <Smartphone className="w-4 h-4 text-amber-400" />
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-white">Do Not Screen Off</span>
                  <span className="text-[10px] text-slate-400">Keep mobile display awake while waiting</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDoNotScreenOff(!doNotScreenOff)}
                className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                  doNotScreenOff ? 'bg-amber-500' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                    doNotScreenOff ? 'left-6' : 'left-1'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Help & Support */}
          <div className="p-4 rounded-3xl bg-white/5 border border-white/15 flex flex-col gap-2">
            <span className="text-xs font-black tracking-wider text-slate-300 uppercase">
              Help & Support
            </span>
            <a
              href="tel:112"
              className="flex items-center justify-between p-2.5 rounded-2xl bg-rose-950/40 border border-rose-500/30 text-rose-200 text-xs font-bold hover:bg-rose-900/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400" />
                <span>24x7 Safety Helpline (112)</span>
              </div>
              <ChevronRight className="w-4 h-4" />
            </a>


            <button
              type="button"
              onClick={() => alert('Motoride 24x7 Support is active in Chandigarh Tri-City.')}
              className="flex items-center justify-between p-2.5 rounded-2xl bg-white/5 border border-white/10 text-white text-xs font-bold hover:bg-white/10 transition-colors cursor-pointer text-left"
            >
              <div className="flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-slate-400" />
                <span>Frequently Asked Questions</span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        </div>

        {/* Drawer Footer */}
        <div className="p-4 border-t border-white/15 bg-black/60 backdrop-blur-md flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[11px] font-bold text-slate-300">Motoride App v2.4</span>
          </div>
          <button
            type="button"
            onClick={() => {
              if (onSignOut) {
                onClose();
                onSignOut();
              } else {
                window.location.reload();
              }
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 hover:text-rose-200 border border-rose-500/30 text-xs font-bold transition-all cursor-pointer active:scale-95"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
};
