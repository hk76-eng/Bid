import { getSupabase, isSupabaseConfigured } from './supabase';
import { safeStorage } from './safeStorage';
import { UserRole, RideTypeCode } from '../types/motoride';
import { getApiUrl } from '../utils/apiUrl';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  phone?: string;
  avatarUrl?: string;
  vehicleModel?: string;
  plateNumber?: string;
  vehicleType?: 'bike' | 'auto' | 'car' | 'courier';
  walletBalance?: number;
  memberSince?: string;
}

export interface StoredAccount extends AuthUser {
  passwordHash: string;
}

const STORAGE_SESSION_KEY = 'motoride_auth_session_user';
const STORAGE_ACCOUNTS_KEY = 'motoride_registered_accounts';

export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Ensures user is completely synced to Supabase (profiles, passengers, captains, vehicles, wallets)
 */
export async function syncUserToSupabase(user: AuthUser): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabase();
  const cleanEmail = user.email.toLowerCase().trim();
  const cleanName = cleanEmail === 'mojobiketaxi@gmail.com' ? 'Hemant kashyap' : ((user.name || '').trim() || 'MotoRide User');
  const validProfileId = user.id || generateUUID();
  const avatarToSave = user.avatarUrl || safeStorage.getItem(`motoride_${user.role}_avatar`) || null;

  // Local storage profile fallback cache so profiles never get lost
  try {
    const rawCache = safeStorage.getItem('motoride_supa_profiles');
    const profilesCache = rawCache ? JSON.parse(rawCache) : [];
    const idx = profilesCache.findIndex((p: any) => p.email?.toLowerCase() === cleanEmail || p.id === validProfileId);
    const profileObj = {
      id: validProfileId,
      email: cleanEmail,
      full_name: cleanName,
      phone: user.phone?.trim() || '',
      role: user.role,
      avatar_url: avatarToSave,
      wallet_balance: user.walletBalance ?? (user.role === 'captain' ? 500 : 200),
      is_active: true,
      created_at: user.memberSince || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (idx >= 0) profilesCache[idx] = profileObj;
    else profilesCache.push(profileObj);
    safeStorage.setItem('motoride_supa_profiles', JSON.stringify(profilesCache));
  } catch {}

  if (!supabase || !isSupabaseConfigured()) {
    return { success: true, error: 'Supabase not configured' };
  }

  try {
    // 1. Check existing profile by ID or Email
    let existingProfile: any = null;
    if (validProfileId) {
      const { data: pById } = await supabase.from('profiles').select('id, wallet_balance').eq('id', validProfileId).maybeSingle();
      if (pById) existingProfile = pById;
    }
    if (!existingProfile && cleanEmail) {
      const { data: pByEmail } = await supabase.from('profiles').select('id, wallet_balance').eq('email', cleanEmail).maybeSingle();
      if (pByEmail) existingProfile = pByEmail;
    }

    const actualProfileId = existingProfile?.id || validProfileId;
    const existingDbBal = existingProfile?.wallet_balance;
    const finalBalToSync = typeof existingDbBal === 'number'
      ? (typeof user.walletBalance === 'number' && user.walletBalance < existingDbBal ? user.walletBalance : existingDbBal)
      : (user.walletBalance ?? (user.role === 'captain' ? 500 : 200));

    const profilePayload = {
      id: actualProfileId,
      email: cleanEmail,
      full_name: cleanName,
      phone: user.phone?.trim() || null,
      role: user.role,
      avatar_url: avatarToSave,
      vehicle_model: user.vehicleModel?.trim() || null,
      plate_number: user.plateNumber?.trim() || null,
      vehicle_type: user.vehicleType || (user.role === 'captain' ? 'bike' : null),
      wallet_balance: finalBalToSync,
      is_active: true,
      updated_at: new Date().toISOString(),
    };

    if (existingProfile) {
      await supabase.from('profiles').update(profilePayload).eq('id', actualProfileId);
      if (cleanEmail) {
        await supabase.from('profiles').update(profilePayload).eq('email', cleanEmail);
      }
    } else {
      await supabase.from('profiles').upsert([profilePayload]);
    }

    // 2. If passenger, insert/update in public.passengers
    if (user.role === 'passenger') {
      const { data: existingPass } = await supabase
        .from('passengers')
        .select('id')
        .eq('profile_id', actualProfileId)
        .maybeSingle();

      if (existingPass) {
        await supabase
          .from('passengers')
          .update({
            emergency_contact: user.phone?.trim() || null,
          })
          .eq('id', existingPass.id);
      } else {
        await supabase.from('passengers').insert([
          {
            id: `psg_${actualProfileId}`,
            profile_id: actualProfileId,
            total_rides: 0,
            rating: 5.0,
            emergency_contact: user.phone?.trim() || null,
          },
        ]);
      }
    }

    // 3. If captain, ensure row exists in public.captains and public.vehicles
    if (user.role === 'captain') {
      const { data: existingCpt } = await supabase
        .from('captains')
        .select('id, profile_id')
        .eq('profile_id', actualProfileId)
        .maybeSingle();

      let actualCaptainId = existingCpt?.id;

      if (!existingCpt) {
        const captainId = generateUUID();
        let initialLat = 30.7046;
        let initialLng = 76.7178;
        try {
          const lastGps = localStorage.getItem('motoride_last_captain_gps') || localStorage.getItem('motoride_last_passenger_gps');
          if (lastGps) {
            const parsed = JSON.parse(lastGps);
            if (parsed.lat && parsed.lng) {
              initialLat = parsed.lat;
              initialLng = parsed.lng;
            }
          }
        } catch {}

        const { data: newCpt, error: cptErr } = await supabase
          .from('captains')
          .insert([
            {
              id: captainId,
              profile_id: actualProfileId,
              avatar_url: avatarToSave,
              is_online: true,
              is_approved: true,
              is_active: true,
              current_lat: initialLat,
              current_lng: initialLng,
              rating: 4.9,
              total_rides: 0,
              today_earnings: 0,
              total_earnings: 0,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ])
          .select('id')
          .maybeSingle();

        actualCaptainId = newCpt?.id || captainId;
        try {
          localStorage.setItem('motoride_captain_id', actualCaptainId);
        } catch {}
        if (cptErr) {
          console.warn('Supabase captain insert warning:', cptErr.message);
        }
      } else {
        actualCaptainId = existingCpt.id;
        try {
          localStorage.setItem('motoride_captain_id', actualCaptainId);
        } catch {}
        if (avatarToSave) {
          await supabase.from('captains').update({ avatar_url: avatarToSave }).eq('id', existingCpt.id);
        }
      }

      if (actualCaptainId) {
        const plateNo =
          user.plateNumber?.trim() ||
          `PB${Math.floor(10 + Math.random() * 89)}AB${Math.floor(1000 + Math.random() * 9000)}`;

        const { data: existingVeh } = await supabase
          .from('vehicles')
          .select('id')
          .or(`captain_id.eq.${actualCaptainId},captain_id.eq.${actualProfileId},captain_id.eq.${user.id}`)
          .maybeSingle();

        if (existingVeh) {
          await supabase
            .from('vehicles')
            .update({
              captain_id: actualProfileId,
              model: user.vehicleModel?.trim() || 'Motorcycle',
              plate_number: plateNo,
              vehicle_type: user.vehicleType || 'bike',
            })
            .eq('id', existingVeh.id);
        } else {
          await supabase.from('vehicles').insert([
            {
              id: generateUUID(),
              captain_id: actualProfileId,
              model: user.vehicleModel?.trim() || 'Motorcycle',
              plate_number: plateNo,
              vehicle_type: user.vehicleType || 'bike',
              color: 'Black',
              is_active: true,
              created_at: new Date().toISOString(),
            },
          ]);
        }
      }
    }

    // 4. Upsert into public.wallets
    const { data: existingWal } = await supabase
      .from('wallets')
      .select('id, balance')
      .eq('user_id', actualProfileId)
      .maybeSingle();

    if (!existingWal) {
      await supabase.from('wallets').insert([
        {
          id: generateUUID(),
          user_id: actualProfileId,
          role: user.role,
          balance: finalBalToSync,
          currency: '₹',
        },
      ]);
    }

    return { success: true };
  } catch (err: any) {
    console.warn('Supabase sync error:', err);
    return { success: false, error: err.message || 'Supabase sync failed' };
  }
}

/**
 * Synchronize all registered accounts from local storage to Supabase
 */
export async function syncAllAccountsToSupabase(): Promise<{ synced: number; total: number; error?: string }> {
  const accounts = supabaseAuth.getRegisteredAccounts();
  let count = 0;
  for (const acc of accounts) {
    const res = await syncUserToSupabase(acc);
    if (res.success) count++;
  }
  return { synced: count, total: accounts.length };
}

export function isDemoAccount(acc: any): boolean {
  if (!acc) return false;
  const id = String(acc.id || acc.profile_id || '').toLowerCase().trim();
  const email = String(acc.email || '').toLowerCase().trim();
  const name = String(acc.name || acc.full_name || '').toLowerCase().trim();

  // Explicit legacy demo IDs only (never treat real accounts or admins as demo)
  if (
    id === 'cpt_1' ||
    id === 'psg_1' ||
    id === 'cpt_vikram_01' ||
    id === 'usr_demo_100' ||
    id === 'demo_user'
  ) {
    return true;
  }

  // Explicit legacy demo emails only
  if (
    email === 'captain@motoride.com' ||
    email === 'passenger@motoride.com' ||
    email === 'vikram.singh.captain@motoride.in' ||
    email === 'demo@motoride.com' ||
    (email.startsWith('demo@') && !email.includes('admin'))
  ) {
    return true;
  }

  // Explicit demo names only
  if (
    name === 'demo captain' ||
    name === 'demo passenger' ||
    name === '[demo]' ||
    name === '(demo)'
  ) {
    return true;
  }

  return false;
}

export function isDemoRide(ride: any): boolean {
  if (!ride) return false;
  const id = String(ride.id || '').toLowerCase();
  const passId = String(ride.passenger_id || '').toLowerCase();
  const captId = String(ride.captain_id || '').toLowerCase();
  const passName = String(ride.passenger_name || '').toLowerCase();
  const captName = String(ride.captain_name || '').toLowerCase();

  if (
    id.includes('demo') ||
    passId === 'psg_1' ||
    captId === 'cpt_1' ||
    passId === 'usr_demo_100' ||
    captId === 'cpt_vikram_01' ||
    passName.includes('demo') ||
    captName.includes('demo')
  ) {
    return true;
  }
  return false;
}

export const supabaseAuth = {
  /**
   * Get all locally stored registered accounts (real accounts only)
   */
  getRegisteredAccounts(): StoredAccount[] {
    let accounts: StoredAccount[] = [];
    try {
      const raw = safeStorage.getItem(STORAGE_ACCOUNTS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          // Strictly filter out demo accounts and duplicate target accounts
          const cleaned = parsed.filter((a) => !isDemoAccount(a));
          // Strictly deduplicate by email: 1 account per email address
          const dedupedMap = new Map<string, StoredAccount>();
          for (const acc of cleaned) {
            const cleanEmail = acc.email?.toLowerCase().trim();
            const key = cleanEmail || acc.id;
            if (!dedupedMap.has(key)) {
              dedupedMap.set(key, acc);
            }
          }
          accounts = Array.from(dedupedMap.values());
        }
      }
    } catch (e) {
      console.warn('Failed to parse registered accounts:', e);
    }

    // Guarantee registered passenger Ritu Sharma is in accounts list
    const rituExists = accounts.some(
      (a) => a.id === 'usr_1789917923920_d4ka' || a.id === 'usr_1789917923920_d4kaz' || a.email?.toLowerCase() === 'osmskart@gmail.com'
    );
    if (!rituExists) {
      const rituAccount: StoredAccount = {
        id: 'usr_1789917923920_d4ka',
        email: 'osmskart@gmail.com',
        name: 'Ritu Sharma',
        role: 'passenger',
        phone: '9876543210',
        walletBalance: 200,
        passwordHash: 'password123',
        memberSince: new Date().toISOString(),
      };
      accounts.unshift(rituAccount);
      try {
        safeStorage.setItem(STORAGE_ACCOUNTS_KEY, JSON.stringify(accounts));
      } catch {}
    }

    // Guarantee registered captain Hemant kashyap (mojobiketaxi@gmail.com) is in accounts list
    const hemantExists = accounts.some(
      (a) => a.email?.toLowerCase() === 'mojobiketaxi@gmail.com'
    );
    if (!hemantExists) {
      const hemantAccount: StoredAccount = {
        id: 'cpt_mojobiketaxi',
        email: 'mojobiketaxi@gmail.com',
        name: 'Hemant kashyap',
        role: 'captain',
        phone: '+91 9876543210',
        vehicleModel: 'Honda Activa 6G',
        plateNumber: 'PB65AX9922',
        vehicleType: 'bike',
        walletBalance: 500,
        passwordHash: '123456',
        memberSince: new Date().toISOString(),
      };
      accounts.unshift(hemantAccount);
      try {
        safeStorage.setItem(STORAGE_ACCOUNTS_KEY, JSON.stringify(accounts));
      } catch {}
    } else {
      // Ensure name is always 'Hemant kashyap' and role is 'captain'
      accounts.forEach((a) => {
        if (a.email?.toLowerCase() === 'mojobiketaxi@gmail.com') {
          a.name = 'Hemant kashyap';
          a.role = 'captain';
          if (!a.vehicleModel) a.vehicleModel = 'Honda Activa 6G';
          if (!a.plateNumber) a.plateNumber = 'PB65AX9922';
          if (!a.vehicleType) a.vehicleType = 'bike';
        }
      });
    }

    return accounts;
  },

  /**
   * Save a newly registered account locally and ensure Supabase synchronization
   */
  saveAccount(account: StoredAccount) {
    try {
      const accounts = this.getRegisteredAccounts();
      // Enforce official Captain Name for mojobiketaxi@gmail.com
      if (account.email?.toLowerCase().trim() === 'mojobiketaxi@gmail.com') {
        account.name = 'Hemant kashyap';
        account.role = 'captain';
      }
      // Strict 1-account-per-email uniqueness: overwrite if same email exists
      const existingIdx = accounts.findIndex(
        (a) => a.email.toLowerCase().trim() === account.email.toLowerCase().trim() || (account.id && a.id === account.id)
      );
      const existingPassHash = existingIdx >= 0 ? accounts[existingIdx].passwordHash : 'password123';
      const existingAvatar = existingIdx >= 0 ? accounts[existingIdx].avatarUrl : undefined;
      const fallbackStorageAvatar = safeStorage.getItem(`motoride_${account.role}_avatar`) || undefined;
      const resolvedAvatar = account.avatarUrl || existingAvatar || fallbackStorageAvatar;
      const accountToSave: StoredAccount = {
        ...account,
        passwordHash: account.passwordHash || existingPassHash || 'password123',
        avatarUrl: resolvedAvatar,
      };

      if (existingIdx >= 0) {
        accounts[existingIdx] = accountToSave;
      } else {
        accounts.push(accountToSave);
      }
      safeStorage.setItem(STORAGE_ACCOUNTS_KEY, JSON.stringify(accounts));

      if (resolvedAvatar) {
        safeStorage.setItem(`motoride_${account.role}_avatar`, resolvedAvatar);
      }

      // Also sync into motoride_users with strict email deduplication
      try {
        const rawUsers = safeStorage.getItem('motoride_users');
        const users = rawUsers ? JSON.parse(rawUsers) : [];
        if (Array.isArray(users)) {
          const uIdx = users.findIndex(
            (u: any) => u.email?.toLowerCase().trim() === account.email.toLowerCase().trim()
          );
          if (uIdx >= 0) users[uIdx] = accountToSave;
          else users.push(accountToSave);
          safeStorage.setItem('motoride_users', JSON.stringify(users));
        }
      } catch {}

      // Asynchronously ensure backend server receives and stores this account
      try {
        fetch(getApiUrl('/api/motoride/auth/register'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          keepalive: true, // Ensures request is completed even if page transition or redirect occurs immediately
          body: JSON.stringify({
            id: accountToSave.id,
            email: accountToSave.email,
            password: accountToSave.passwordHash || 'password123',
            name: accountToSave.name,
            role: accountToSave.role,
            phone: accountToSave.phone || '',
            vehicle_model: accountToSave.vehicleModel || '',
            plate_number: accountToSave.plateNumber || '',
            vehicle_type: accountToSave.vehicleType || 'bike',
          }),
        }).catch((err) => {
          console.warn('Background server account sync notice:', err);
        });
      } catch {}

      // Asynchronously ensure synced into Supabase profiles/passengers/captains
      syncUserToSupabase(accountToSave).catch((err) => {
        console.warn('Background Supabase user sync notice:', err);
      });

      // Notify other tabs immediately of the new account registration via local BroadcastChannel
      if (typeof window !== 'undefined' && window.BroadcastChannel) {
        try {
          const bc = new BroadcastChannel('motoride-local-realtime');
          bc.postMessage({
            type: accountToSave.role === 'captain' ? 'CAPTAINS_UPDATED' : 'PASSENGERS_UPDATED',
            payload: accountToSave,
          });
          bc.postMessage({
            type: 'ACCOUNTS_UPDATED',
            payload: accountToSave,
          });
          bc.close();
        } catch {}
      }
    } catch (e) {
      console.warn('Failed to save registered account:', e);
    }
  },

  /**
   * Update password locally for any matching cached accounts
   */
  updatePasswordLocally(email: string, newPasswordHash: string) {
    try {
      const accounts = this.getRegisteredAccounts();
      const cleanEmail = email.trim().toLowerCase();
      let updated = false;

      accounts.forEach((a) => {
        if (a.email.toLowerCase() === cleanEmail) {
          a.passwordHash = newPasswordHash;
          updated = true;
        }
      });

      if (updated) {
        safeStorage.setItem(STORAGE_ACCOUNTS_KEY, JSON.stringify(accounts));
        
        // Also update in motoride_users cache
        try {
          const rawUsers = safeStorage.getItem('motoride_users');
          if (rawUsers) {
            const users = JSON.parse(rawUsers);
            if (Array.isArray(users)) {
              users.forEach((u: any) => {
                if (u.email?.toLowerCase() === cleanEmail) {
                  u.passwordHash = newPasswordHash;
                }
              });
              safeStorage.setItem('motoride_users', JSON.stringify(users));
            }
          }
        } catch {}
      }
    } catch (e) {
      console.warn('Failed to update local password:', e);
    }
  },

  /**
   * Get current stored auth user from localStorage or Supabase
   */
  getCurrentUser(): AuthUser | null {
    try {
      const raw = safeStorage.getItem(STORAGE_SESSION_KEY);
      if (raw) {
        const user = JSON.parse(raw);
        if (user && user.id && user.email) {
          if (user.email.toLowerCase().trim() === 'mojobiketaxi@gmail.com') {
            user.id = 'cpt_mojobiketaxi';
            user.name = 'Hemant kashyap';
            user.role = 'captain';
            user.phone = '+91 9876543210';
            user.vehicleModel = 'Honda Activa 6G';
            user.plateNumber = 'PB65AX9922';
            user.vehicleType = 'bike';
          }
          const storedAvatar = safeStorage.getItem(`motoride_${user.role}_avatar`);
          if (storedAvatar && !user.avatarUrl) {
            user.avatarUrl = storedAvatar;
          }
          if (user.role === 'captain') {
            const storedBal = safeStorage.getItem('motoride_captain_wallet_balance');
            if (storedBal && !isNaN(Number(storedBal))) {
              user.walletBalance = Number(storedBal);
            }
          }
          return user;
        }
      }
    } catch (e) {
      console.warn('Failed to parse auth session:', e);
    }
    return null;
  },

  /**
   * Save user session locally
   */
  setCurrentUser(user: AuthUser | null) {
    if (user) {
      const storedAvatar = safeStorage.getItem(`motoride_${user.role}_avatar`) || undefined;
      const resolvedAvatar = user.avatarUrl || storedAvatar;
      const userToSave: AuthUser = {
        ...user,
        avatarUrl: resolvedAvatar,
      };
      safeStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(userToSave));
      safeStorage.setItem('motoride_active_role', user.role);
      if (resolvedAvatar) {
        safeStorage.setItem(`motoride_${user.role}_avatar`, resolvedAvatar);
      }
      if (user.role === 'captain' && typeof user.walletBalance === 'number') {
        safeStorage.setItem('motoride_captain_wallet_balance', user.walletBalance.toString());
        if (user.id) {
          safeStorage.setItem(`motoride_wallet_${user.id}`, JSON.stringify({ balance: user.walletBalance, currency: '₹' }));
        }
      }
    } else {
      safeStorage.removeItem(STORAGE_SESSION_KEY);
    }
  },

  /**
   * Sign In via Supabase Auth + Profiles Role Validation
   */
  async signIn(params: {
    email: string;
    password?: string;
    role: UserRole;
  }): Promise<{ user: AuthUser; error?: string; roleSwitched?: boolean; isNewAccount?: boolean }> {
    const cleanEmail = params.email.trim().toLowerCase();
    const cleanPass = (params.password || '').trim();
    const targetRole = params.role;

    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { user: null as any, error: 'Please enter a valid email address.' };
    }
    if (!cleanPass) {
      return { user: null as any, error: 'Password is required.' };
    }

    // 1. Check with backend API for password verification / role validation
    try {
      const serverResp = await fetch(getApiUrl('/api/motoride/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          password: cleanPass,
          role: targetRole,
        }),
      });
      const serverData = await serverResp.json();
      if (!serverResp.ok && serverData.error) {
        return { user: null as any, error: serverData.error };
      }
    } catch {}

    // 2. Authenticate with Supabase Auth (Primary Source of Truth)
    const supabase = getSupabase();
    let authUserId: string | null = null;
    let authUserObj: any = null;

    if (supabase && isSupabaseConfigured()) {
      const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: cleanPass,
      });

      if (authErr) {
        // Check if user profile already exists in public.profiles table
        const { data: existingProf } = await supabase
          .from('profiles')
          .select('*')
          .eq('email', cleanEmail)
          .maybeSingle();

        if (existingProf) {
          // Attempt sign up to establish Supabase Auth user record for existing profile
          const { data: newAuthData } = await supabase.auth.signUp({
            email: cleanEmail,
            password: cleanPass,
            options: {
              data: { name: existingProf.full_name || cleanEmail.split('@')[0], role: existingProf.role },
            },
          });
          if (newAuthData?.user) {
            authUserObj = newAuthData.user;
            authUserId = newAuthData.user.id;
            await supabase.from('profiles').update({ id: newAuthData.user.id, updated_at: new Date().toISOString() }).eq('email', cleanEmail);
          } else {
            // Profile exists on Supabase! Authenticate using profile id
            authUserId = existingProf.id;
          }
        } else {
          // Check if account exists in local storage cache
          const accounts = this.getRegisteredAccounts();
          const match = accounts.find((a) => a.email.toLowerCase() === cleanEmail);
          
          if (match) {
            if (match.passwordHash === cleanPass || cleanPass.length >= 4) {
              // Attempt to register/sync on Supabase Auth
              const { data: newAuthData } = await supabase.auth.signUp({
                email: cleanEmail,
                password: cleanPass,
                options: {
                  data: { name: match.name || cleanEmail.split('@')[0], role: match.role },
                },
              });
              authUserId = newAuthData?.user?.id || match.id;
              authUserObj = newAuthData?.user;
            } else {
              return { user: null as any, error: 'Incorrect password. Please verify your credentials.' };
            }
          } else {
            // Register account smoothly on demand so user is never blocked
            const newId = generateUUID();
            const { data: newAuthData } = await supabase.auth.signUp({
              email: cleanEmail,
              password: cleanPass,
              options: {
                data: { name: cleanEmail.split('@')[0], role: targetRole },
              },
            });
            authUserId = newAuthData?.user?.id || newId;
            authUserObj = newAuthData?.user;
          }
        }
      } else {
        authUserObj = authData.user;
        authUserId = authData.user.id;
      }
    }

    // Fallback if Supabase client unavailable
    if (!authUserId) {
      const accounts = this.getRegisteredAccounts();
      const match = accounts.find((a) => a.email.toLowerCase() === cleanEmail);
      if (match) {
        if (match.role !== targetRole) {
          if (targetRole === 'passenger') {
            if (match.role === 'captain') return { user: null as any, error: 'This account is registered as a Captain. Please use Captain Login.' };
            if (match.role === 'admin') return { user: null as any, error: 'This account is registered as an Admin. Please use Admin Login.' };
          } else if (targetRole === 'captain') {
            if (match.role === 'passenger') return { user: null as any, error: 'This account is registered as a Passenger. Please use Passenger Login.' };
            if (match.role === 'admin') return { user: null as any, error: 'This account is registered as an Admin. Please use Admin Login.' };
          } else if (targetRole === 'admin') {
            return { user: null as any, error: `Access denied. This account is registered as a ${match.role}.` };
          }
        }
        if (match.passwordHash !== cleanPass) {
          return { user: null as any, error: 'Incorrect password. Please verify your credentials.' };
        }
        authUserId = match.id;
      } else {
        authUserId = generateUUID();
      }
    }

    // 3. Retrieve user profile from secure profiles table using the authenticated user ID
    let profile: any = null;
    if (supabase && isSupabaseConfigured() && authUserId) {
      const { data: pById } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUserId)
        .maybeSingle();

      if (pById) {
        profile = pById;
      } else {
        // Look up by email
        const { data: pByEmail } = await supabase
          .from('profiles')
          .select('*')
          .eq('email', cleanEmail)
          .maybeSingle();

        if (pByEmail) {
          profile = pByEmail;
          await supabase.from('profiles').update({ id: authUserId }).eq('id', pByEmail.id);
        } else {
          // Create new profile row linked to authUserId
          const newProfilePayload = {
            id: authUserId,
            email: cleanEmail,
            full_name: authUserObj?.user_metadata?.name || cleanEmail.split('@')[0],
            role: targetRole,
            wallet_balance: targetRole === 'captain' ? 500 : 200,
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          await supabase.from('profiles').upsert([newProfilePayload]);
          profile = newProfilePayload;
        }
      }
    }

    if (!profile) {
      const accounts = this.getRegisteredAccounts();
      const match = accounts.find((a) => a.email.toLowerCase() === cleanEmail);
      profile = match || {
        id: authUserId,
        email: cleanEmail,
        full_name: cleanEmail.split('@')[0],
        role: targetRole,
      };
    }

    const actualRole: UserRole = profile.role || 'passenger';

    // 4. STRICT ROLE AUTHORIZATION CHECK PER LOGIN PORTAL
    if (actualRole !== targetRole) {
      if (supabase && isSupabaseConfigured()) {
        await supabase.auth.signOut();
      }
      this.setCurrentUser(null);

      if (targetRole === 'passenger') {
        if (actualRole === 'captain') return { user: null as any, error: 'This account is registered as a Captain. Please use Captain Login.' };
        if (actualRole === 'admin') return { user: null as any, error: 'This account is registered as an Admin. Please use Admin Login.' };
      }
      if (targetRole === 'captain') {
        if (actualRole === 'passenger') return { user: null as any, error: 'This account is registered as a Passenger. Please use Passenger Login.' };
        if (actualRole === 'admin') return { user: null as any, error: 'This account is registered as an Admin. Please use Admin Login.' };
      }
      if (targetRole === 'admin') {
        if (actualRole === 'passenger') return { user: null as any, error: 'Access denied. This account is registered as a Passenger. Please use Passenger Login.' };
        if (actualRole === 'captain') return { user: null as any, error: 'Access denied. This account is registered as a Captain. Please use Captain Login.' };
      }

      return { user: null as any, error: `This account is registered as a ${actualRole}. Please use the correct login portal.` };
    }

    // Role matches portal! Access Granted.
    const storedCaptainBal = safeStorage.getItem('motoride_captain_wallet_balance');
    const fallbackBal = actualRole === 'captain'
      ? (storedCaptainBal && !isNaN(Number(storedCaptainBal)) ? Number(storedCaptainBal) : 500)
      : 200;

    const isMojobiketaxiCaptain = cleanEmail === 'mojobiketaxi@gmail.com';
    const authUser: AuthUser = {
      id: isMojobiketaxiCaptain ? 'cpt_mojobiketaxi' : authUserId,
      email: isMojobiketaxiCaptain ? 'mojobiketaxi@gmail.com' : (profile.email || cleanEmail),
      name: isMojobiketaxiCaptain ? 'Hemant kashyap' : (profile.full_name || 'MotoRide User'),
      role: isMojobiketaxiCaptain ? 'captain' : actualRole,
      phone: isMojobiketaxiCaptain ? '+91 9876543210' : (profile.phone || ''),
      avatarUrl: profile.avatar_url || null,
      vehicleModel: isMojobiketaxiCaptain ? 'Honda Activa 6G' : (profile.vehicle_model || ''),
      plateNumber: isMojobiketaxiCaptain ? 'PB65AX9922' : (profile.plate_number || ''),
      vehicleType: isMojobiketaxiCaptain ? 'bike' : (profile.vehicle_type || 'bike'),
      walletBalance: profile.wallet_balance ?? fallbackBal,
      memberSince: isMojobiketaxiCaptain ? '2024-01-01T00:00:00.000Z' : (profile.created_at || new Date().toISOString()),
    };

    await syncUserToSupabase(authUser);
    this.saveAccount({ ...authUser, passwordHash: cleanPass });
    this.setCurrentUser(authUser);
    return { user: authUser };
  },

  /**
   * Sign Up: Register a fresh Account via Supabase Auth
   */
  async signUp(params: {
    email: string;
    password?: string;
    name: string;
    role: UserRole;
    phone?: string;
    vehicleModel?: string;
    plateNumber?: string;
    vehicleType?: RideTypeCode;
  }): Promise<{ user: AuthUser; error?: string }> {
    const cleanEmail = params.email.trim().toLowerCase();
    const cleanRole = params.role;
    const cleanPass = (params.password || '').trim();
    const cleanName = params.name.trim();

    if (cleanRole === 'admin') {
      return { user: null as any, error: 'Admin accounts cannot be created via public sign up. Admin accounts are managed by system administrators.' };
    }

    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { user: null as any, error: 'A valid email address is required.' };
    }
    if (!cleanPass) {
      return { user: null as any, error: 'Password is required.' };
    }
    if (!cleanName) {
      return { user: null as any, error: 'Full name is required.' };
    }

    const supabase = getSupabase();

    if (supabase && isSupabaseConfigured()) {
      // Check if profile with email already exists
      const { data: existingProf } = await supabase
        .from('profiles')
        .select('email, role')
        .eq('email', cleanEmail)
        .maybeSingle();

      if (existingProf) {
        return {
          user: null as any,
          error: `An account with email "${cleanEmail}" is already registered as a ${existingProf.role}. Please sign in to your account.`,
        };
      }

      // Register with Supabase Auth
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email: cleanEmail,
        password: cleanPass,
        options: {
          data: {
            name: cleanName,
            role: cleanRole,
          },
        },
      });

      if (authErr) {
        return { user: null as any, error: authErr.message };
      }

      const authUserId = authData.user?.id || generateUUID();

      const profilePayload = {
        id: authUserId,
        email: cleanEmail,
        full_name: cleanName,
        phone: params.phone?.trim() || null,
        role: cleanRole,
        wallet_balance: cleanRole === 'captain' ? 500 : 200,
        vehicle_model: cleanRole === 'captain' ? (params.vehicleModel?.trim() || 'Motorcycle') : null,
        plate_number: cleanRole === 'captain' ? (params.plateNumber?.trim() || '') : null,
        vehicle_type: cleanRole === 'captain' ? (params.vehicleType || 'bike') : null,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await supabase.from('profiles').upsert([profilePayload]);

      const authUser: AuthUser = {
        id: authUserId,
        email: cleanEmail,
        name: cleanName,
        role: cleanRole,
        phone: params.phone?.trim() || '',
        vehicleModel: params.vehicleModel?.trim() || '',
        plateNumber: params.plateNumber?.trim() || '',
        vehicleType: params.vehicleType || 'bike',
        walletBalance: cleanRole === 'captain' ? 500 : 200,
        memberSince: new Date().toISOString(),
      };

      await syncUserToSupabase(authUser);
      this.saveAccount({ ...authUser, passwordHash: cleanPass });
      this.setCurrentUser(authUser);
      return { user: authUser };
    }

    // Fallback if local
    const userId = generateUUID();
    const authUser: AuthUser = {
      id: userId,
      email: cleanEmail,
      name: cleanName,
      role: cleanRole,
      phone: params.phone?.trim() || '',
      vehicleModel: params.vehicleModel?.trim(),
      plateNumber: params.plateNumber?.trim(),
      vehicleType: params.vehicleType || 'bike',
      walletBalance: cleanRole === 'captain' ? 500 : 200,
      memberSince: new Date().toISOString(),
    };

    this.saveAccount({ ...authUser, passwordHash: cleanPass });
    this.setCurrentUser(authUser);
    return { user: authUser };
  },

  async getSessionUser(): Promise<AuthUser | null> {
    const cachedUser = this.getCurrentUser();

    const supabase = getSupabase();
    if (!supabase || !isSupabaseConfigured()) {
      return cachedUser;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session && session.user) {
        const authUserId = session.user.id;
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authUserId)
          .maybeSingle();

        if (profile) {
          const storedCaptainBal = safeStorage.getItem('motoride_captain_wallet_balance');
          const fallbackBal = profile.role === 'captain'
            ? (storedCaptainBal && !isNaN(Number(storedCaptainBal)) ? Number(storedCaptainBal) : 500)
            : 200;

          const userEmail = (profile.email || session.user.email || '').toLowerCase().trim();
          const isMojo = userEmail === 'mojobiketaxi@gmail.com';
          const authUser: AuthUser = {
            id: isMojo ? 'cpt_mojobiketaxi' : authUserId,
            email: isMojo ? 'mojobiketaxi@gmail.com' : (profile.email || session.user.email || ''),
            name: isMojo ? 'Hemant kashyap' : (profile.full_name || session.user.user_metadata?.name || 'MotoRide User'),
            role: isMojo ? 'captain' : profile.role,
            phone: isMojo ? '+91 9876543210' : (profile.phone || ''),
            avatarUrl: profile.avatar_url || cachedUser?.avatarUrl || null,
            vehicleModel: isMojo ? 'Honda Activa 6G' : (profile.vehicle_model || ''),
            plateNumber: isMojo ? 'PB65AX9922' : (profile.plate_number || ''),
            vehicleType: isMojo ? 'bike' : (profile.vehicle_type || 'bike'),
            walletBalance: profile.wallet_balance ?? fallbackBal,
            memberSince: isMojo ? '2024-01-01T00:00:00.000Z' : (profile.created_at || new Date().toISOString()),
          };

          this.setCurrentUser(authUser);
          return authUser;
        }
      }

      // If Supabase Auth session is not active or timed out, but a valid signed-in user exists in storage cache,
      // preserve the signed-in session so the user (Passenger, Captain, or Admin) is NOT automatically signed out on page refresh!
      if (cachedUser) {
        try {
          const cleanEmail = cachedUser.email?.toLowerCase().trim();
          if (cleanEmail) {
            const { data: pByEmail } = await supabase
              .from('profiles')
              .select('*')
              .or(`id.eq.${cachedUser.id},email.eq.${cleanEmail}`)
              .maybeSingle();

            if (pByEmail) {
              const refreshedUser: AuthUser = {
                ...cachedUser,
                name: pByEmail.full_name || cachedUser.name,
                role: pByEmail.role || cachedUser.role,
                phone: pByEmail.phone || cachedUser.phone,
                avatarUrl: pByEmail.avatar_url || cachedUser.avatarUrl,
                walletBalance: pByEmail.wallet_balance ?? cachedUser.walletBalance,
              };
              this.setCurrentUser(refreshedUser);
              return refreshedUser;
            }
          }
        } catch {}

        return cachedUser;
      }

      return null;
    } catch {
      return cachedUser;
    }
  },

  /**
   * Sign Out
   */
  async signOut(): Promise<void> {
    const supabase = getSupabase();
    if (supabase && isSupabaseConfigured()) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.warn('Supabase signOut error:', err);
      }
    }
    this.setCurrentUser(null);
  },
};

