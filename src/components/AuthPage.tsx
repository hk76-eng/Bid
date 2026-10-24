import React, { useState, useEffect } from 'react';
import {
  Bike,
  Shield,
  User,
  ShieldCheck,
  Navigation,
  Sparkles,
  Lock,
  Mail,
  Phone,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldAlert,
  Car,
  Package,
  CheckCircle2,
  Database,
  Radio,
  Key,
  Star,
  Zap,
  MapPin,
  Clock,
  Compass,
  Download,
} from 'lucide-react';
import { UserRole, RideTypeCode, AppHyperlinkConfig } from '../types/motoride';
import { supabaseAuth, AuthUser } from '../lib/supabaseAuth';
import { isSupabaseConfigured } from '../lib/supabase';
import { motorideApi } from '../services/motorideApi';
import { realtimeSync } from '../services/realtimeSync';

interface AuthPageProps {
  onAuthenticated: (user: AuthUser) => void;
  defaultRole?: UserRole;
}

export const AuthPage: React.FC<AuthPageProps> = ({
  onAuthenticated,
  defaultRole = 'passenger',
}) => {
  const [selectedRole, setSelectedRole] = useState<UserRole>(defaultRole);
  const [authMode, setAuthMode] = useState<'signin' | 'signup' | 'forgot'>('signin');
  const [appLinkConfig, setAppLinkConfig] = useState<AppHyperlinkConfig>(() => motorideApi.getAppHyperlinkConfig());

  useEffect(() => {
    const handleUpdate = () => {
      setAppLinkConfig(motorideApi.getAppHyperlinkConfig());
    };
    window.addEventListener('storage', handleUpdate);
    const unsub = realtimeSync.on('APP_HYPERLINK_UPDATED', () => {
      handleUpdate();
    });
    return () => {
      window.removeEventListener('storage', handleUpdate);
      unsub?.();
    };
  }, []);

  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Sign In Form State (Starts completely empty for fresh accounts)
  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');

  // Password Reset Form State
  const [resetEmail, setResetEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  // Passenger Sign Up State
  const [psgName, setPsgName] = useState('');
  const [psgEmail, setPsgEmail] = useState('');
  const [psgPhone, setPsgPhone] = useState('');
  const [psgPassword, setPsgPassword] = useState('');

  // Captain Sign Up State
  const [cptName, setCptName] = useState('');
  const [cptEmail, setCptEmail] = useState('');
  const [cptPhone, setCptPhone] = useState('');
  const [cptVehicleModel, setCptVehicleModel] = useState('');
  const [cptPlateNumber, setCptPlateNumber] = useState('');
  const [cptVehicleType, setCptVehicleType] = useState<RideTypeCode>('bike');
  const [cptPassword, setCptPassword] = useState('');

  // Admin Sign Up State
  const [admName, setAdmName] = useState('');
  const [admEmail, setAdmEmail] = useState('');
  const [admPhone, setAdmPhone] = useState('');
  const [admPassword, setAdmPassword] = useState('');

  const handleRoleSelect = (role: UserRole) => {
    setSelectedRole(role);
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const handleSignInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanEmail = signInEmail.trim().toLowerCase();
    if (!cleanEmail || !signInEmail.includes('@')) {
      setErrorMessage('Please enter a valid email address');
      return;
    }
    if (!signInPassword) {
      setErrorMessage('Password is required');
      return;
    }

    setIsLoading(true);
    try {
      const { user, error } = await supabaseAuth.signIn({
        email: signInEmail.trim(),
        password: signInPassword,
        role: selectedRole,
      });

      if (error) {
        setErrorMessage(error);
      } else if (user) {
        onAuthenticated(user);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to sign in. Please check credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanEmail = resetEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    if (!newPassword || newPassword.length < 4) {
      setErrorMessage('Password must be at least 4 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setIsResetting(true);
    try {
      // 1. Update local storage credentials immediately
      supabaseAuth.updatePasswordLocally(cleanEmail, newPassword);

      // 2. Synchronize with backend API in parallel (non-blocking)
      motorideApi.resetPassword(cleanEmail, newPassword).catch(() => {});

      setSuccessMessage('Password updated successfully! Signing you in...');

      // 3. Immediately sign in
      const { user } = await supabaseAuth.signIn({
        email: cleanEmail,
        password: newPassword,
        role: selectedRole,
      });

      if (user) {
        setTimeout(() => {
          onAuthenticated(user);
        }, 300);
      } else {
        setSignInEmail(cleanEmail);
        setSignInPassword(newPassword);
        setAuthMode('signin');
      }
    } catch (err: any) {
      // Resilient fallback sign-in
      const { user } = await supabaseAuth.signIn({
        email: cleanEmail,
        password: newPassword,
        role: selectedRole,
      });
      if (user) {
        onAuthenticated(user);
      }
    } finally {
      setIsResetting(false);
    }
  };

  const handleSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    let name = '';
    let email = '';
    let phone = '';
    let password = '';
    let vehicleModel: string | undefined;
    let plateNumber: string | undefined;
    let vehicleType: RideTypeCode | undefined;

    if (selectedRole === 'passenger') {
      name = psgName.trim();
      email = psgEmail.trim();
      phone = psgPhone.trim();
      password = psgPassword;
    } else if (selectedRole === 'captain') {
      name = cptName.trim();
      email = cptEmail.trim();
      phone = cptPhone.trim();
      password = cptPassword;
      vehicleModel = cptVehicleModel.trim();
      plateNumber = cptPlateNumber.trim().toUpperCase();
      vehicleType = cptVehicleType;
    } else {
      name = admName.trim();
      email = admEmail.trim();
      phone = admPhone.trim();
      password = admPassword;
    }

    if (selectedRole === 'admin') {
      setErrorMessage('Admin accounts cannot be created via public sign up. Admin accounts are managed by system administrators.');
      return;
    }

    if (!name || !email || !password) {
      setErrorMessage('Please fill in all required fields');
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    const existingAccounts = supabaseAuth.getRegisteredAccounts();
    const duplicateAcc = existingAccounts.find(
      (a) => a.email && a.email.trim().toLowerCase() === cleanEmail
    );
    if (duplicateAcc) {
      setErrorMessage(
        `An account with email "${cleanEmail}" already exists (${duplicateAcc.role} profile). Duplicate accounts with the same email ID cannot be created. Please sign in or use a different email.`
      );
      setSignInEmail(cleanEmail);
      return;
    }

    setIsLoading(true);
    try {
      // Keep sign in email pre-populated with registered email
      setSignInEmail(email);

      const { user, error } = await supabaseAuth.signUp({
        name,
        email,
        phone,
        password,
        role: selectedRole,
        vehicleModel,
        plateNumber,
        vehicleType,
      });

      if (error) {
        setErrorMessage(error);
      } else if (user) {
        setSuccessMessage(`Account created successfully for ${email}! Logging into your ${selectedRole} dashboard...`);
        setTimeout(() => {
          onAuthenticated(user);
        }, 500);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Registration failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col justify-between relative overflow-hidden selection:bg-neutral-800 selection:text-white">
      {/* Background Subtle Noir Texture */}
      <div className="absolute inset-0 bg-black pointer-events-none" />

      {/* Top Header Brand */}
      <header className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-white/20 bg-black">
        <div className="flex items-center gap-3">
          <img
            src="/motoride-logo.png"
            alt="Motoride"
            referrerPolicy="no-referrer"
            className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl object-cover bg-black border border-white/30 shadow-lg shadow-black/90 shrink-0"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
          />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-black text-lg sm:text-xl tracking-tight text-white">
                Motoride
              </span>
              <span className="text-xs text-white/80 font-semibold hidden sm:inline">
                – Ride & Courier Booking
              </span>
            </div>
            <p className="text-[11px] text-white/80 font-medium">Real-Time Mobility, Parcel Delivery & Live Captain Bidding</p>
          </div>
        </div>

        {/* Right Side: 2-Role Quick Select Switcher */}
        <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3 flex-wrap">
          {/* 2-Role Quick Select Switcher (Passenger & Captain) */}
          <div className="flex items-center gap-1 p-1 bg-black border border-white/25 rounded-2xl shrink-0">
          <button
            type="button"
            onClick={() => handleRoleSelect('passenger')}
            className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              selectedRole === 'passenger'
                ? 'bg-white text-black font-black'
                : 'text-white/70 hover:text-white'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Passenger</span>
          </button>
          <button
            type="button"
            onClick={() => handleRoleSelect('captain')}
            className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              selectedRole === 'captain'
                ? 'bg-white text-black font-black'
                : 'text-white/70 hover:text-white'
            }`}
          >
            <Bike className="w-3.5 h-3.5" />
            <span>Captain</span>
          </button>
          <a
            href={appLinkConfig.url || "https://web2apkpro.com/download/E95FB02/Motoride"}
            target={appLinkConfig.openInNewTab !== false ? "_blank" : "_self"}
            rel="noopener noreferrer"
            className="px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 text-white hover:text-white/80 bg-black border border-white/25 hover:border-white/50 shadow-sm"
            title={`Download ${appLinkConfig.title || 'Motoride App'}`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>{appLinkConfig.title || 'Motoride App'}</span>
          </a>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="relative z-10 w-full max-w-md mx-auto px-4 sm:px-6 py-6 sm:py-10 flex-1 flex flex-col justify-center">
        <div>
          {/* Noir Black & White Auth Card */}
          <div>
            <div className="bg-black border border-white/20 rounded-[28px] p-6 sm:p-8 shadow-2xl shadow-black relative overflow-hidden">
              
              {/* Top Border Accent */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-white/40" />

              {/* Active Role Indicator */}
              <div className="mb-6 p-3.5 rounded-2xl bg-black border border-white/25 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-black text-white border border-white/30 flex items-center justify-center">
                    {selectedRole === 'passenger' && <User className="w-5 h-5 text-white stroke-[2.5]" />}
                    {selectedRole === 'captain' && <Bike className="w-5 h-5 text-white stroke-[2.5]" />}
                    {selectedRole === 'admin' && <Shield className="w-5 h-5 text-white stroke-[2.5]" />}
                  </div>
                  <div className="text-left">
                    <span className="block text-[10px] text-white/70 uppercase tracking-wider font-semibold">
                      Account Role
                    </span>
                    <span className="text-sm font-extrabold text-white capitalize">
                      {selectedRole === 'passenger' ? 'Passenger App' : selectedRole === 'captain' ? 'Captain (Driver) App' : 'Admin Operations Manager'}
                    </span>
                  </div>
                </div>

                <span className="text-[11px] font-semibold text-white/80">
                  {authMode === 'signin' ? 'Sign In Mode' : authMode === 'forgot' ? 'Reset Password' : 'New Account'}
                </span>
              </div>

              {/* 2. Sign In vs Sign Up Mode Switcher */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-black rounded-2xl border border-white/25 mb-6">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('signin');
                    setErrorMessage(null);
                    setSuccessMessage(null);
                    if (!signInEmail) {
                      const candidate = psgEmail || cptEmail || admEmail;
                      if (candidate) setSignInEmail(candidate);
                    }
                  }}
                  className={`py-2.5 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                    authMode === 'signin'
                      ? 'bg-black text-white shadow-md border border-white font-black'
                      : 'text-white/60 hover:text-white bg-black hover:bg-neutral-950'
                  }`}
                >
                  <Key className="w-4 h-4 text-white stroke-[2.5]" />
                  <span className="text-white">Sign In</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('signup');
                    setErrorMessage(null);
                    setSuccessMessage(null);
                  }}
                  className={`py-2.5 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                    authMode === 'signup'
                      ? 'bg-black text-white shadow-md border border-white font-black'
                      : 'text-white/60 hover:text-white bg-black hover:bg-neutral-950'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4 text-white stroke-[2.5]" />
                  <span className="text-white">Create Account</span>
                </button>
              </div>

              {/* Error Message */}
              {errorMessage && (
                <div className="mb-5 p-3.5 rounded-2xl bg-rose-950/90 border border-rose-500 text-rose-300 text-xs font-bold flex items-center gap-2.5 shadow-xl animate-in fade-in">
                  <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400 stroke-[2.5]" />
                  <span className="text-rose-200">{errorMessage}</span>
                </div>
              )}

              {/* Success Message */}
              {successMessage && (
                <div className="mb-5 p-3.5 rounded-2xl bg-black border border-white/40 text-white text-xs font-medium flex items-center gap-2.5 shadow-md">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-white stroke-[2.5]" />
                  <span className="text-white">{successMessage}</span>
                </div>
              )}

              {/* ======================================================== */}
              {/* MODE: SIGN IN FORM                                       */}
              {/* ======================================================== */}
              {authMode === 'signin' && (
                <form onSubmit={handleSignInSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-white uppercase tracking-wider mb-2">
                      {selectedRole.toUpperCase()} Email Address
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-white absolute left-4 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        required
                        value={signInEmail}
                        onChange={(e) => setSignInEmail(e.target.value)}
                        placeholder="Enter your registered email"
                        className="w-full bg-black border border-white/30 rounded-2xl py-3 pl-11 pr-4 text-xs sm:text-sm text-white placeholder-white/40 focus:outline-none focus:border-white focus:ring-1 focus:ring-white transition-all font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-white uppercase tracking-wider mb-2">
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-white absolute left-4 top-1/2 -translate-y-1/2" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={signInPassword}
                        onChange={(e) => setSignInPassword(e.target.value)}
                        placeholder="Enter your password"
                        className="w-full bg-black border border-white/30 rounded-2xl py-3 pl-11 pr-12 text-xs sm:text-sm text-white placeholder-white/40 focus:outline-none focus:border-white focus:ring-1 focus:ring-white transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4 text-white" /> : <Eye className="w-4 h-4 text-white" />}
                      </button>
                    </div>
                    <div className="flex justify-end mt-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setResetEmail(signInEmail);
                          setAuthMode('forgot');
                          setErrorMessage(null);
                          setSuccessMessage(null);
                        }}
                        className="text-[11px] font-bold text-white/80 hover:text-white underline cursor-pointer hover:no-underline transition-all"
                      >
                        Forgot Password? Change Password & Sign In
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3.5 px-4 rounded-2xl font-black text-xs sm:text-sm shadow-xl transition-all flex items-center justify-center gap-2 active:scale-[0.98] cursor-pointer disabled:opacity-50 bg-black hover:bg-neutral-900 text-white border-2 border-white shadow-black/80 ring-1 ring-white/20"
                  >
                    {isLoading ? (
                      <span className="flex items-center gap-2 text-white">
                        <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                        <span className="text-white">Authenticating...</span>
                      </span>
                    ) : (
                      <>
                        <span className="text-white">Sign In to {selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1)} Dashboard</span>
                        <ArrowRight className="w-4 h-4 text-white stroke-[2.5]" />
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* ======================================================== */}
              {/* MODE: FORGOT / CHANGE PASSWORD FORM                       */}
              {/* ======================================================== */}
              {authMode === 'forgot' && (
                <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
                  <div className="p-3.5 rounded-2xl bg-neutral-950 border border-white/20 text-[11px] text-white/80 leading-relaxed mb-1">
                    Enter your registered email and your new password below. We will securely update your password in the database and automatically sign you into the dashboard.
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-white uppercase tracking-wider mb-2">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-white absolute left-4 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        required
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        placeholder="Enter your registered email"
                        className="w-full bg-black border border-white/30 rounded-2xl py-3 pl-11 pr-4 text-xs sm:text-sm text-white placeholder-white/40 focus:outline-none focus:border-white focus:ring-1 focus:ring-white transition-all font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-white uppercase tracking-wider mb-2">
                      New Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-white absolute left-4 top-1/2 -translate-y-1/2" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Enter new password (min 4 characters)"
                        className="w-full bg-black border border-white/30 rounded-2xl py-3 pl-11 pr-12 text-xs sm:text-sm text-white placeholder-white/40 focus:outline-none focus:border-white focus:ring-1 focus:ring-white transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4 text-white" /> : <Eye className="w-4 h-4 text-white" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-white uppercase tracking-wider mb-2">
                      Confirm New Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-white absolute left-4 top-1/2 -translate-y-1/2" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm new password"
                        className="w-full bg-black border border-white/30 rounded-2xl py-3 pl-11 pr-12 text-xs sm:text-sm text-white placeholder-white/40 focus:outline-none focus:border-white focus:ring-1 focus:ring-white transition-all"
                      />
                    </div>
                  </div>

                  <div className="pt-2 flex flex-col gap-2">
                    <button
                      type="submit"
                      disabled={isResetting}
                      className="w-full py-3.5 px-4 rounded-2xl font-black text-xs sm:text-sm shadow-xl transition-all flex items-center justify-center gap-2 active:scale-[0.98] cursor-pointer disabled:opacity-50 bg-black hover:bg-neutral-900 text-white border-2 border-white shadow-black/80 ring-1 ring-white/20"
                    >
                      {isResetting ? (
                        <span className="flex items-center gap-2 text-white">
                          <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                          <span className="text-white">Updating Password...</span>
                        </span>
                      ) : (
                        <>
                          <span className="text-white">Change Password & Sign In</span>
                          <ArrowRight className="w-4 h-4 text-white stroke-[2.5]" />
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode('signin');
                        setErrorMessage(null);
                        setSuccessMessage(null);
                      }}
                      className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white/70 hover:text-white transition-all bg-transparent border border-white/10 hover:border-white/30 cursor-pointer"
                    >
                      Back to Sign In
                    </button>
                  </div>
                </form>
              )}

              {/* ======================================================== */}
              {/* MODE: SIGN UP FORM                                       */}
              {/* ======================================================== */}
              {authMode === 'signup' && (
                <form onSubmit={handleSignUpSubmit} className="space-y-4">
                  {selectedRole === 'passenger' && (
                    <>
                      <div>
                        <label className="block text-xs font-bold text-white uppercase tracking-wider mb-1.5">Full Name</label>
                        <input
                          type="text"
                          required
                          value={psgName}
                          onChange={(e) => setPsgName(e.target.value)}
                          placeholder="e.g. John Doe"
                          className="w-full bg-black border border-white/30 rounded-2xl py-2.5 px-4 text-xs sm:text-sm text-white placeholder-white/40 focus:outline-none focus:border-white focus:ring-1 focus:ring-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-white uppercase tracking-wider mb-1.5">Email Address</label>
                        <input
                          type="email"
                          required
                          value={psgEmail}
                          onChange={(e) => setPsgEmail(e.target.value)}
                          placeholder="e.g. passenger@example.com"
                          className="w-full bg-black border border-white/30 rounded-2xl py-2.5 px-4 text-xs sm:text-sm text-white placeholder-white/40 focus:outline-none focus:border-white focus:ring-1 focus:ring-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-white uppercase tracking-wider mb-1.5">Phone Number</label>
                        <input
                          type="tel"
                          required
                          value={psgPhone}
                          onChange={(e) => setPsgPhone(e.target.value)}
                          placeholder="e.g. +91 98765 43210"
                          className="w-full bg-black border border-white/30 rounded-2xl py-2.5 px-4 text-xs sm:text-sm text-white placeholder-white/40 focus:outline-none focus:border-white focus:ring-1 focus:ring-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-white uppercase tracking-wider mb-1.5">Password</label>
                        <input
                          type="password"
                          required
                          value={psgPassword}
                          onChange={(e) => setPsgPassword(e.target.value)}
                          placeholder="Create password"
                          className="w-full bg-black border border-white/30 rounded-2xl py-2.5 px-4 text-xs sm:text-sm text-white placeholder-white/40 focus:outline-none focus:border-white focus:ring-1 focus:ring-white"
                        />
                      </div>
                    </>
                  )}

                  {selectedRole === 'captain' && (
                    <>
                      <div>
                        <label className="block text-xs font-bold text-white uppercase tracking-wider mb-1.5">Captain Full Name</label>
                        <input
                          type="text"
                          required
                          value={cptName}
                          onChange={(e) => setCptName(e.target.value)}
                          placeholder="e.g. Alex Kumar"
                          className="w-full bg-black border border-white/30 rounded-2xl py-2.5 px-4 text-xs sm:text-sm text-white placeholder-white/40 focus:outline-none focus:border-white focus:ring-1 focus:ring-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-white uppercase tracking-wider mb-1.5">Email Address</label>
                        <input
                          type="email"
                          required
                          value={cptEmail}
                          onChange={(e) => setCptEmail(e.target.value)}
                          placeholder="e.g. captain@example.com"
                          className="w-full bg-black border border-white/30 rounded-2xl py-2.5 px-4 text-xs sm:text-sm text-white placeholder-white/40 focus:outline-none focus:border-white focus:ring-1 focus:ring-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-white uppercase tracking-wider mb-1.5">Phone Number</label>
                        <input
                          type="tel"
                          required
                          value={cptPhone}
                          onChange={(e) => setCptPhone(e.target.value)}
                          placeholder="e.g. +91 98765 43210"
                          className="w-full bg-black border border-white/30 rounded-2xl py-2.5 px-4 text-xs sm:text-sm text-white placeholder-white/40 focus:outline-none focus:border-white focus:ring-1 focus:ring-white"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs font-bold text-white uppercase tracking-wider mb-1.5">Vehicle Model</label>
                          <input
                            type="text"
                            required
                            value={cptVehicleModel}
                            onChange={(e) => setCptVehicleModel(e.target.value)}
                            placeholder="Enter vehicle model"
                            className="w-full bg-black border border-white/30 rounded-2xl py-2.5 px-4 text-xs text-white placeholder-white/40 focus:outline-none focus:border-white focus:ring-1 focus:ring-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-white uppercase tracking-wider mb-1.5">Plate Number</label>
                          <input
                            type="text"
                            required
                            value={cptPlateNumber}
                            onChange={(e) => setCptPlateNumber(e.target.value)}
                            placeholder="e.g. DL01AB1234"
                            className="w-full bg-black border border-white/30 rounded-2xl py-2.5 px-4 text-xs text-white placeholder-white/40 uppercase focus:outline-none focus:border-white focus:ring-1 focus:ring-white"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-white uppercase tracking-wider mb-1.5">Vehicle Type</label>
                        <select
                          value={cptVehicleType}
                          onChange={(e) => setCptVehicleType(e.target.value as RideTypeCode)}
                          className="w-full bg-black border border-white/30 rounded-2xl py-2.5 px-4 text-xs text-white focus:outline-none focus:border-white focus:ring-1 focus:ring-white"
                        >
                          <option value="bike">Motobike (Bike / Scooter)</option>
                          <option value="auto">Auto Rickshaw (3-Wheeler)</option>
                          <option value="car">Car / Cab (AC Taxi)</option>
                          <option value="courier">Courier / Parcel Delivery</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-white uppercase tracking-wider mb-1.5">Password</label>
                        <input
                          type="password"
                          required
                          value={cptPassword}
                          onChange={(e) => setCptPassword(e.target.value)}
                          placeholder="Create password"
                          className="w-full bg-black border border-white/30 rounded-2xl py-2.5 px-4 text-xs sm:text-sm text-white placeholder-white/40 focus:outline-none focus:border-white focus:ring-1 focus:ring-white"
                        />
                      </div>
                    </>
                  )}

                  {selectedRole === 'admin' && (
                    <>
                      <div>
                        <label className="block text-xs font-bold text-white uppercase tracking-wider mb-1.5">Admin Manager Name</label>
                        <input
                          type="text"
                          required
                          value={admName}
                          onChange={(e) => setAdmName(e.target.value)}
                          placeholder="e.g. Operations Admin"
                          className="w-full bg-black border border-white/30 rounded-2xl py-2.5 px-4 text-xs sm:text-sm text-white placeholder-white/40 focus:outline-none focus:border-white focus:ring-1 focus:ring-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-white uppercase tracking-wider mb-1.5">Admin Email</label>
                        <input
                          type="email"
                          required
                          value={admEmail}
                          onChange={(e) => setAdmEmail(e.target.value)}
                          placeholder="e.g. admin@motoride.com"
                          className="w-full bg-black border border-white/30 rounded-2xl py-2.5 px-4 text-xs sm:text-sm text-white placeholder-white/40 focus:outline-none focus:border-white focus:ring-1 focus:ring-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-white uppercase tracking-wider mb-1.5">Phone Number</label>
                        <input
                          type="tel"
                          value={admPhone}
                          onChange={(e) => setAdmPhone(e.target.value)}
                          placeholder="e.g. +91 98765 00001"
                          className="w-full bg-black border border-white/30 rounded-2xl py-2.5 px-4 text-xs sm:text-sm text-white placeholder-white/40 focus:outline-none focus:border-white focus:ring-1 focus:ring-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-white uppercase tracking-wider mb-1.5">Password</label>
                        <input
                          type="password"
                          required
                          value={admPassword}
                          onChange={(e) => setAdmPassword(e.target.value)}
                          placeholder="Create password"
                          className="w-full bg-black border border-white/30 rounded-2xl py-2.5 px-4 text-xs sm:text-sm text-white placeholder-white/40 focus:outline-none focus:border-white focus:ring-1 focus:ring-white"
                        />
                      </div>
                    </>
                  )}

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3.5 px-4 rounded-2xl font-black text-xs sm:text-sm shadow-xl transition-all flex items-center justify-center gap-2 active:scale-[0.98] cursor-pointer disabled:opacity-50 bg-black hover:bg-neutral-900 text-white border-2 border-white shadow-black/80 ring-1 ring-white/20"
                  >
                    {isLoading ? (
                      <span className="flex items-center gap-2 text-white">
                        <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                        <span className="text-white">Registering...</span>
                      </span>
                    ) : (
                      <>
                        <span className="text-white">Create {selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1)} Account</span>
                        <ArrowRight className="w-4 h-4 text-white stroke-[2.5]" />
                      </>
                    )}
                  </button>
                </form>
              )}

            </div>
          </div>

        </div>
      </main>

      {/* Footer with hyperlink to Admin Dashboard */}
      <footer className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 text-center border-t border-white/20 text-xs text-white/70 bg-black">
        MotoRide Mobility Platform &copy; {new Date().getFullYear()} •{' '}
        <button
          type="button"
          onClick={() => {
            handleRoleSelect('admin');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className="text-white hover:text-slate-200 underline underline-offset-4 font-bold cursor-pointer transition-colors"
          title="Open Admin Dashboard Portal"
        >
          Real Time
        </button>{' '}
        Urban Transportation Engine
      </footer>
    </div>
  );
};

