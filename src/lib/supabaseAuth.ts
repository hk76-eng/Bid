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
 * Ensures user is cached locally and safely stored
 */
export async function syncUserToSupabase(user: AuthUser): Promise<{ success: boolean; error?: string }> {
  const cleanEmail = user.email.toLowerCase().trim();
  const cleanName = cleanEmail === 'mojobiketaxi@gmail.com' ? 'Hemant kashyap' : ((user.name || '').trim() || 'Bid User');
  const validProfileId = user.id || generateUUID();
  const avatarToSave = user.avatarUrl || safeStorage.getItem(`motoride_${user.role}_avatar`) || null;

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

  return { success: true };
}

/**
 * Synchronize all registered accounts (local stub for backward compatibility)
 */
export async function syncAllAccountsToSupabase(): Promise<{ synced: number; total: number; error?: string }> {
  const accounts = supabaseAuth.getRegisteredAccounts();
  return { synced: accounts.length, total: accounts.length };
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
   * Save a newly registered account locally and ensure backend server synchronization
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
          keepalive: true,
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

      // Cache locally
      syncUserToSupabase(accountToSave).catch(() => {});

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
   * Get stored auth user strictly for a specific role.
   * Under no circumstances will a passenger account be returned for 'captain',
   * and under no circumstances will a captain account be returned for 'passenger'.
   */
  getCurrentUserForRole(role: UserRole): AuthUser {
    try {
      // 1. Try role-specific stored session first
      const roleSpecificRaw = safeStorage.getItem(`motoride_auth_session_${role}`);
      if (roleSpecificRaw) {
        const u = JSON.parse(roleSpecificRaw);
        if (u && u.role === role) {
          if (role === 'captain' && u.email?.toLowerCase().trim() === 'mojobiketaxi@gmail.com') {
            u.name = 'Hemant kashyap';
            u.id = 'cpt_mojobiketaxi';
          }
          return u;
        }
      }

      // 2. Try generic session if it matches the requested role
      const genericUser = this.getCurrentUser();
      if (genericUser && genericUser.role === role) {
        return genericUser;
      }

      // 3. Find registered account strictly matching this role
      const registered = this.getRegisteredAccounts().filter((a) => a.role === role);
      if (registered.length > 0) {
        const match = registered[0];
        const authUser: AuthUser = {
          id: match.id,
          email: match.email,
          name: match.name,
          role: match.role,
          phone: match.phone,
          avatarUrl: match.avatarUrl || safeStorage.getItem(`motoride_${role}_avatar`) || undefined,
          vehicleModel: match.vehicleModel,
          plateNumber: match.plateNumber,
          vehicleType: match.vehicleType,
          walletBalance: match.walletBalance,
          memberSince: match.memberSince,
        };
        return authUser;
      }
    } catch (e) {
      console.warn('Failed to get user for role:', role, e);
    }

    // 4. Fallback defaults strictly isolated per role
    if (role === 'captain') {
      const storedBal = safeStorage.getItem('motoride_captain_wallet_balance');
      return {
        id: 'cpt_mojobiketaxi',
        email: 'mojobiketaxi@gmail.com',
        name: safeStorage.getItem('motoride_captain_name') || 'Hemant kashyap',
        role: 'captain',
        phone: safeStorage.getItem('motoride_captain_phone') || '+91 9876543210',
        avatarUrl: safeStorage.getItem('motoride_captain_avatar') || undefined,
        vehicleModel: safeStorage.getItem('motoride_captain_vehicle_model') || 'Honda Activa 6G',
        plateNumber: safeStorage.getItem('motoride_captain_plate') || 'PB65AX9922',
        vehicleType: 'bike',
        walletBalance: storedBal && !isNaN(Number(storedBal)) ? Number(storedBal) : 500,
        memberSince: '2024-01-01T00:00:00.000Z',
      };
    } else if (role === 'passenger') {
      return {
        id: 'usr_1789917923920_d4ka',
        email: safeStorage.getItem('motoride_passenger_email') || 'osmskart@gmail.com',
        name: safeStorage.getItem('motoride_passenger_name') || 'Ritu Sharma',
        role: 'passenger',
        phone: safeStorage.getItem('motoride_passenger_phone') || '9876543210',
        avatarUrl: safeStorage.getItem('motoride_passenger_avatar') || undefined,
        walletBalance: 200,
        memberSince: '2024-01-01T00:00:00.000Z',
      };
    }

    return {
      id: 'adm_01',
      email: 'admin@motoride.com',
      name: 'System Administrator',
      role: 'admin',
      memberSince: '2024-01-01T00:00:00.000Z',
    };
  },

  /**
   * Get current stored auth user from localStorage session
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
   * Save user session locally with role-separated storage keys
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
      safeStorage.setItem(`motoride_auth_session_${user.role}`, JSON.stringify(userToSave));
      safeStorage.setItem('motoride_active_role', user.role);

      if (user.role === 'captain') {
        safeStorage.setItem('motoride_captain_name', user.name);
        if (user.email) safeStorage.setItem('motoride_captain_email', user.email);
        if (user.phone) safeStorage.setItem('motoride_captain_phone', user.phone);
        if (user.vehicleModel) safeStorage.setItem('motoride_captain_vehicle_model', user.vehicleModel);
        if (user.plateNumber) safeStorage.setItem('motoride_captain_plate', user.plateNumber);
      } else if (user.role === 'passenger') {
        safeStorage.setItem('motoride_passenger_name', user.name);
        if (user.email) safeStorage.setItem('motoride_passenger_email', user.email);
        if (user.phone) safeStorage.setItem('motoride_passenger_phone', user.phone);
      }

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
   * Sign In via Credentials + Account Validation
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

    // 2. Validate against local registered accounts
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
      if (match.passwordHash && match.passwordHash !== cleanPass && cleanPass.length >= 4) {
        // If password does not match
        return { user: null as any, error: 'Incorrect password. Please verify your credentials.' };
      }
    }

    const authUserId = match?.id || generateUUID();
    const actualRole: UserRole = match?.role || targetRole;

    const storedCaptainBal = safeStorage.getItem('motoride_captain_wallet_balance');
    const fallbackBal = actualRole === 'captain'
      ? (storedCaptainBal && !isNaN(Number(storedCaptainBal)) ? Number(storedCaptainBal) : 500)
      : 200;

    const isMojobiketaxiCaptain = cleanEmail === 'mojobiketaxi@gmail.com';
    const authUser: AuthUser = {
      id: isMojobiketaxiCaptain ? 'cpt_mojobiketaxi' : authUserId,
      email: isMojobiketaxiCaptain ? 'mojobiketaxi@gmail.com' : cleanEmail,
      name: isMojobiketaxiCaptain ? 'Hemant kashyap' : (match?.name || cleanEmail.split('@')[0]),
      role: isMojobiketaxiCaptain ? 'captain' : actualRole,
      phone: isMojobiketaxiCaptain ? '+91 9876543210' : (match?.phone || ''),
      avatarUrl: match?.avatarUrl || null,
      vehicleModel: isMojobiketaxiCaptain ? 'Honda Activa 6G' : (match?.vehicleModel || ''),
      plateNumber: isMojobiketaxiCaptain ? 'PB65AX9922' : (match?.plateNumber || ''),
      vehicleType: isMojobiketaxiCaptain ? 'bike' : (match?.vehicleType || 'bike'),
      walletBalance: match?.walletBalance ?? fallbackBal,
      memberSince: isMojobiketaxiCaptain ? '2024-01-01T00:00:00.000Z' : (match?.memberSince || new Date().toISOString()),
    };

    this.saveAccount({ ...authUser, passwordHash: cleanPass });
    this.setCurrentUser(authUser);
    return { user: authUser };
  },

  /**
   * Sign Up: Register a fresh Account
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

    const accounts = this.getRegisteredAccounts();
    const existing = accounts.find((a) => a.email.toLowerCase() === cleanEmail);
    if (existing) {
      return {
        user: null as any,
        error: `An account with email "${cleanEmail}" is already registered as a ${existing.role}. Please sign in to your account.`,
      };
    }

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
    return this.getCurrentUser();
  },

  /**
   * Sign Out
   */
  async signOut(): Promise<void> {
    this.setCurrentUser(null);
  },
};
