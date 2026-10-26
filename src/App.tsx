import React, { useState, useEffect } from 'react';
import { UserRole, MotorideRide } from './types/motoride';
import { WorkspaceHeader } from './components/common/WorkspaceHeader';
import { PassengerWorkspace } from './passenger/PassengerWorkspace';
import { CaptainWorkspace } from './captain/CaptainWorkspace';
import { AdminWorkspace } from './admin/AdminWorkspace';
import { WalletModal } from './components/common/WalletModal';
import { NotificationsModal } from './components/common/NotificationsModal';
import { AuthPage } from './components/AuthPage';
import { supabaseAuth, AuthUser } from './lib/supabaseAuth';
import { safeStorage } from './lib/safeStorage';
import { motorideApi } from './services/motorideApi';
import { initAnalytics, trackPageView, enforceAdminNoIndex } from './utils/analytics';
import { ArrowLeftRight, User, Bike } from 'lucide-react';
import { realtimeSync } from './services/realtimeSync';

export default function App() {
  // Supabase Authenticated User Session
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => {
    return supabaseAuth.getCurrentUser();
  });

  // Helper to extract explicit role from URL (e.g. ?role=captain or ?role=passenger)
  const getExplicitUrlRole = (): UserRole | null => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    const r = (params.get('role') || params.get('tab') || params.get('view') || '').toLowerCase();
    if (r === 'captain' || r === 'passenger' || r === 'admin') return r as UserRole;
    if (window.location.pathname === '/captain') return 'captain';
    if (window.location.pathname === '/passenger') return 'passenger';
    if (window.location.pathname === '/admin') return 'admin';
    return null;
  };

  // Active Workspace Role: prioritize URL search param for effortless multi-tab testing, then saved user
  const [currentRole, setCurrentRole] = useState<UserRole>(() => {
    const urlRole = getExplicitUrlRole();
    if (urlRole) return urlRole;
    const savedUser = supabaseAuth.getCurrentUser();
    return savedUser?.role || 'passenger';
  });

  const [themeMode, setThemeMode] = useState<string>(() => {
    return safeStorage.getItem('motoride_theme_mode') || 'dark';
  });

  useEffect(() => {
    const handleTheme = () => {
      const mode = safeStorage.getItem('motoride_theme_mode') || 'dark';
      setThemeMode(mode);
      document.documentElement.classList.toggle('dark', mode === 'dark');
      document.documentElement.classList.toggle('light', mode === 'light');
    };
    handleTheme();
    window.addEventListener('motoride_theme_changed', handleTheme);
    return () => window.removeEventListener('motoride_theme_changed', handleTheme);
  }, []);

  const [isCaptainOnline, setIsCaptainOnline] = useState<boolean>(true);
  const [isCaptainOnActiveTrip, setIsCaptainOnActiveTrip] = useState<boolean>(false);
  const [isWalletOpen, setIsWalletOpen] = useState<boolean>(false);
  const [walletBalance, setWalletBalance] = useState<number>(() => {
    const savedUser = supabaseAuth.getCurrentUser();
    return savedUser?.walletBalance ?? 500;
  });
  const [isNotificationsOpen, setIsNotificationsOpen] = useState<boolean>(false);
  const [unreadNotifications, setUnreadNotifications] = useState<number>(0);
  const [isQuotaExceeded, setIsQuotaExceeded] = useState<boolean>(false);

  useEffect(() => {
    const handleQuotaExceeded = () => {
      setIsQuotaExceeded(true);
    };
    window.addEventListener('gmp-quota-exceeded', handleQuotaExceeded);
    return () => window.removeEventListener('gmp-quota-exceeded', handleQuotaExceeded);
  }, []);

  // Initialize GA4 and enforce admin noindex on route/role change
  useEffect(() => {
    initAnalytics();
  }, []);

  useEffect(() => {
    const isAdmin = currentRole === 'admin';
    enforceAdminNoIndex(isAdmin);
    trackPageView(
      isAdmin ? '/admin' : currentRole === 'captain' ? '/captain' : '/passenger',
      isAdmin ? 'Motoride Admin Panel' : currentRole === 'captain' ? 'Motoride Captain Portal' : 'Motoride Passenger App'
    );
  }, [currentRole, currentUser]);

  // Check Supabase session on startup and enforce role-based workspace locking
  useEffect(() => {
    let isMounted = true;
    const verifySession = async () => {
      try {
        const sessionUser = await supabaseAuth.getSessionUser();
        if (isMounted) {
          if (sessionUser) {
            setCurrentUser(sessionUser);
            if (!getExplicitUrlRole()) {
              setCurrentRole(sessionUser.role);
            }
          } else {
            // Keep user logged in from local storage cache; NEVER sign out on page refresh
            const localUser = supabaseAuth.getCurrentUser();
            if (localUser) {
              setCurrentUser(localUser);
              if (!getExplicitUrlRole()) {
                setCurrentRole(localUser.role);
              }
            }
          }
        }
      } catch (err) {
        console.warn('Session verification fallback to stored user:', err);
        const localUser = supabaseAuth.getCurrentUser();
        if (localUser && isMounted) {
          setCurrentUser(localUser);
          if (!getExplicitUrlRole()) {
            setCurrentRole(localUser.role);
          }
        }
      }
    };
    verifySession();
  }, []);

  useEffect(() => {
    if (currentUser?.role && !getExplicitUrlRole()) {
      setCurrentRole(currentUser.role);
    }
  }, [currentUser]);

  // Sync profile changes immediately when captain edits their information
  useEffect(() => {
    const handleProfileUpdate = () => {
      const updatedUser = supabaseAuth.getCurrentUser();
      if (updatedUser) {
        setCurrentUser(updatedUser);
      }
    };
    window.addEventListener('motoride_captain_profile_updated', handleProfileUpdate);
    return () => window.removeEventListener('motoride_captain_profile_updated', handleProfileUpdate);
  }, []);

  // Synchronize the header's global walletBalance state in real-time when the captain's balance is updated on the server
  useEffect(() => {
    if (!currentUser?.id) return;
    
    // Initial fetch to make sure global balance is perfectly accurate on load
    motorideApi.getWallet(currentUser.id, currentUser.phone || '').then((w) => {
      if (w && w.wallet) {
        setWalletBalance(w.wallet.balance);
      }
    }).catch(() => {});

    const unsubscribe = realtimeSync.on('WALLET_UPDATED', (payload: any) => {
      if (payload && (payload.user_id === currentUser.id || !payload.user_id || currentUser.role === 'captain')) {
        if (typeof payload.balance === 'number') {
          setWalletBalance(payload.balance);
        }
        
        // Also update local storage session cache
        const curr = supabaseAuth.getCurrentUser();
        if (curr) {
          curr.walletBalance = payload.balance;
          supabaseAuth.setCurrentUser(curr);
        }
      }
    });
    
    return unsubscribe;
  }, [currentUser?.id]);

  // Handle Authentication Completion
  const handleAuthenticated = (user: AuthUser) => {
    setCurrentUser(user);
    setCurrentRole(user.role);
    if (user.walletBalance !== undefined) {
      setWalletBalance(user.walletBalance);
    }
  };

  // Handle Sign Out
  const handleSignOut = async () => {
    await supabaseAuth.signOut();
    setCurrentUser(null);
  };

  const handleRoleChange = (role: UserRole) => {
    setCurrentRole(role);
    try {
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.searchParams.set('role', role);
        window.history.replaceState({}, '', url.toString());
      }
    } catch {}
  };

  const handleToggleCaptainOnline = async () => {
    const nextState = !isCaptainOnline;
    setIsCaptainOnline(nextState);
    try {
      if (currentUser?.id) {
        await motorideApi.toggleCaptainOnline(currentUser.id, nextState);
      }
    } catch (err) {
      console.warn('Failed to toggle captain online:', err);
    }
  };

  // =========================================================================
  // GATING: If not signed in, show the Supabase Auth Portal
  // =========================================================================
  if (!currentUser) {
    return (
      <div className="min-h-screen flex flex-col">
        {isQuotaExceeded && (
          <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
            <span>
              Google Maps Platform quota reached. If you are the app owner, visit{' '}
              <a
                href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-semibold text-amber-950 hover:text-amber-800"
              >
                maps developer site
              </a>{' '}
              for instructions to update your account.
            </span>
          </div>
        )}
        <AuthPage
          onAuthenticated={handleAuthenticated}
          defaultRole={currentRole}
        />
      </div>
    );
  }

  // =========================================================================
  // AUTHENTICATED: Show Full Application Features
  // =========================================================================
  return (
    <div className={`min-h-screen flex flex-col selection:bg-emerald-500 selection:text-slate-950 transition-colors duration-300 ${
      themeMode === 'light' ? 'bg-slate-50 text-slate-900 light' : 'bg-slate-950 text-slate-100 dark'
    }`}>
      {isQuotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}
      {/* Workspace Top Header & Navigation with User Profile & Sign Out - Hidden during Captain Active Trip */}
      {!(currentRole === 'captain' && isCaptainOnActiveTrip) && (
        <WorkspaceHeader
          currentRole={currentRole}
          onRoleChange={handleRoleChange}
          currentUser={currentUser}
          onSignOut={handleSignOut}
          isCaptainOnline={isCaptainOnline}
          onToggleCaptainOnline={handleToggleCaptainOnline}
          walletBalance={walletBalance}
          onOpenWallet={() => setIsWalletOpen(true)}
        />
      )}

      {/* Main Workspace Render (Gated - Accessible only after authentication) */}
      <main className="flex-1 w-full relative">
        {currentRole === 'passenger' && (
          <PassengerWorkspace
            currentPassengerId={currentUser.role === 'passenger' ? currentUser.id : 'usr_passenger_tab'}
            passengerName={currentUser.role === 'passenger' ? currentUser.name : 'Passenger'}
            currentUser={currentUser.role === 'passenger' ? currentUser : {
              id: 'usr_passenger_tab',
              email: 'passenger@motoride.app',
              name: 'Passenger',
              phone: '+91 9811223344',
              role: 'passenger',
              walletBalance: 250,
            }}
            onOpenWallet={() => setIsWalletOpen(true)}
            onSignOut={handleSignOut}
          />
        )}

        {currentRole === 'captain' && (
          <CaptainWorkspace
            captainId={
              currentUser.role === 'captain' && currentUser.email?.toLowerCase().trim() !== 'mojobiketaxi@gmail.com'
                ? currentUser.id
                : 'cpt_mojobiketaxi'
            }
            captainName={
              safeStorage.getItem('motoride_captain_name') ||
              (currentUser.role === 'captain' ? currentUser.name : null) ||
              'Hemant kashyap'
            }
            currentUser={
              currentUser.role === 'captain'
                ? {
                    ...currentUser,
                    name: safeStorage.getItem('motoride_captain_name') || currentUser.name || 'Hemant kashyap',
                    phone: safeStorage.getItem('motoride_captain_phone') || currentUser.phone || '+91 9876543210',
                    vehicleModel: safeStorage.getItem('motoride_captain_vehicle_model') || currentUser.vehicleModel || 'Honda Activa 6G',
                    plateNumber: safeStorage.getItem('motoride_captain_plate') || currentUser.plateNumber || 'PB65AX9922',
                    vehicleType: currentUser.vehicleType || 'bike',
                  }
                : {
                    id: 'cpt_mojobiketaxi',
                    email: 'mojobiketaxi@gmail.com',
                    name: safeStorage.getItem('motoride_captain_name') || 'Hemant kashyap',
                    phone: safeStorage.getItem('motoride_captain_phone') || '+91 9876543210',
                    role: 'captain',
                    vehicleModel: safeStorage.getItem('motoride_captain_vehicle_model') || 'Honda Activa 6G',
                    plateNumber: safeStorage.getItem('motoride_captain_plate') || 'PB65AX9922',
                    vehicleType: 'bike',
                    walletBalance: walletBalance,
                  }
            }
            walletBalance={walletBalance}
            onWalletBalanceUpdated={(newBal) => {
              setWalletBalance(newBal);
              const curr = supabaseAuth.getCurrentUser();
              if (curr) {
                curr.walletBalance = newBal;
                supabaseAuth.setCurrentUser(curr);
              }
            }}
            onOpenWallet={() => setIsWalletOpen(true)}
            onSignOut={handleSignOut}
            isOnline={isCaptainOnline}
            onToggleOnline={handleToggleCaptainOnline}
            onActiveTripChange={setIsCaptainOnActiveTrip}
          />
        )}

        {currentRole === 'admin' && (
          <AdminWorkspace
            currentUser={currentUser}
            onSignOut={handleSignOut}
          />
        )}
      </main>

      {/* Floating One-Switch Button for Instant App Switch - Hidden in Passenger mode per user request */}
      {currentRole === 'captain' && !isCaptainOnActiveTrip && (
        <aside aria-label="Quick App Switcher" className="fixed bottom-4 right-4 z-40">
          <button
            type="button"
            onClick={() => handleRoleChange('passenger')}
            className="flex items-center gap-2.5 px-4 py-2.5 rounded-full shadow-2xl backdrop-blur-md border transition-all duration-300 cursor-pointer active:scale-95 group bg-slate-900/95 border-emerald-500/50 text-emerald-300 hover:bg-slate-800 hover:border-emerald-400 shadow-emerald-950/40"
            title="Click to switch to Passenger App"
          >
            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-black/50 border border-white/20">
              <ArrowLeftRight className="w-3.5 h-3.5 group-hover:rotate-180 transition-transform duration-300" />
            </div>
            <div className="text-left leading-tight">
              <div className="text-[10px] text-slate-400 font-medium">Switch to</div>
              <div className="text-xs font-bold text-white flex items-center gap-1">
                <span className="text-emerald-400">Passenger App</span>
                <span className="text-[10px]">👤</span>
              </div>
            </div>
          </button>
        </aside>
      )}

      {/* Bottom Footer with Realtime Network Status & Admin Dashboard Link */}
      <footer className="relative z-20 w-full max-w-7xl mx-auto px-4 sm:px-6 py-3.5 text-center border-t border-slate-800/80 text-xs text-slate-400 bg-slate-950/90 backdrop-blur-sm flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[11px] text-slate-400">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>Real-time Sync Active: <strong className="text-slate-300 font-mono">motoride.appwrite.network</strong></span>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <span>MotoRide Mobility Platform &copy; {new Date().getFullYear()}</span>
          <span>•</span>
          <button
            type="button"
            onClick={() => handleRoleChange('admin')}
            className="text-white hover:text-slate-200 underline underline-offset-4 font-bold cursor-pointer transition-colors"
            title="Open Admin Dashboard"
          >
            Real Time
          </button>
        </div>
      </footer>

      {/* Wallet Modal */}
      <WalletModal
        isOpen={isWalletOpen}
        onClose={() => setIsWalletOpen(false)}
        userId={currentUser.id}
        userPhone={currentUser.phone}
        userRole={currentRole}
        currentBalance={walletBalance}
        onBalanceUpdated={(newBal) => setWalletBalance(newBal)}
      />

      {/* Notifications Modal */}
      <NotificationsModal
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        onReadCountChange={(count) => setUnreadNotifications(count)}
      />
    </div>
  );
}
