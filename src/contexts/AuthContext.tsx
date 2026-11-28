import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Language, Product } from '../types';

export type StaffRole = 'admin' | 'manager' | 'operations' | 'viewer';

export interface StaffProfile {
  id: number;
  username: string;
  displayName: string | null;
  role: StaffRole;
  canViewOrders: boolean;
  canUpdateOrderStatus: boolean;
  canViewSales: boolean;
  canManageStaff: boolean;
  canManageProducts: boolean;
  isActive: boolean;
  isPrimaryAdmin: boolean;
  hasPassword?: boolean;
}

export interface SavedProfile {
  fullName: string;
  phone: string;
  savedAddress: string;
  preferredLang: Language;
}

export interface SavedOrderToken {
  orderRef: string;
  token: string;
}

interface AuthContextValue {
  authReady: boolean;
  staffToken: string | null;
  staffUser: StaffProfile | null;
  needsInitialSetup: boolean;
  defaultAdminUsername: string;
  authError: string | null;
  wishlistIds: string[];
  savedProfile: SavedProfile | null;
  savedOrderTokens: SavedOrderToken[];
  refreshAuthStatus: () => Promise<void>;
  loginStaff: (username: string, password: string) => Promise<boolean>;
  setupInitialAdmin: (username: string, password: string, displayName?: string) => Promise<boolean>;
  logoutStaff: () => void;
  getStaffToken: () => string | null;
  setStaffUser: (profile: StaffProfile | null) => void;
  toggleWishlist: (product: Product) => Promise<void>;
  saveCheckoutContact: (
    fullName: string,
    phone: string,
    savedAddress: string,
    preferredLang: Language
  ) => void;
  recordOrderToken: (orderRef: string, token: string) => void;
}

const WISHLIST_STORAGE_KEY = 'maraya-wishlist';
const PROFILE_STORAGE_KEY = 'maraya-customer-profile';
const ORDER_TOKENS_STORAGE_KEY = 'maraya-order-tokens';

function readJsonStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJsonStorage(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore browser storage quota or private-mode errors
  }
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authReady, setAuthReady] = useState(false);
  const [staffToken, setStaffTokenState] = useState<string | null>(null);
  const staffTokenRef = useRef<string | null>(null);
  const [staffUser, setStaffUser] = useState<StaffProfile | null>(null);
  const [needsInitialSetup, setNeedsInitialSetup] = useState(false);
  const [defaultAdminUsername, setDefaultAdminUsername] = useState('admin');
  const [authError, setAuthError] = useState<string | null>(null);

  const [wishlistIds, setWishlistIds] = useState<string[]>(() => {
    const parsed = readJsonStorage<unknown>(WISHLIST_STORAGE_KEY, []);
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === 'string')
      : [];
  });

  const [savedProfile, setSavedProfile] = useState<SavedProfile | null>(() => {
    const parsed = readJsonStorage<Partial<SavedProfile> | null>(PROFILE_STORAGE_KEY, null);
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      fullName: typeof parsed.fullName === 'string' ? parsed.fullName : '',
      phone: typeof parsed.phone === 'string' ? parsed.phone : '',
      savedAddress: typeof parsed.savedAddress === 'string' ? parsed.savedAddress : '',
      preferredLang: parsed.preferredLang === 'en' ? 'en' : 'ar',
    };
  });

  const [savedOrderTokens, setSavedOrderTokens] = useState<SavedOrderToken[]>(() => {
    const parsed = readJsonStorage<unknown>(ORDER_TOKENS_STORAGE_KEY, []);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (entry): entry is SavedOrderToken =>
          Boolean(entry) &&
          typeof entry === 'object' &&
          typeof (entry as SavedOrderToken).orderRef === 'string' &&
          typeof (entry as SavedOrderToken).token === 'string'
      )
      .slice(0, 30);
  });

  const setStaffToken = useCallback((token: string | null) => {
    staffTokenRef.current = token;
    setStaffTokenState(token);
  }, []);

  const getStaffToken = useCallback(() => {
    return staffTokenRef.current;
  }, []);

  const refreshAuthStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/staff/auth-status', { cache: 'no-store' });
      if (res.ok) {
        const data = (await res.json()) as {
          needsInitialSetup?: boolean;
          defaultUsername?: string;
        };
        setNeedsInitialSetup(Boolean(data.needsInitialSetup));
        if (typeof data.defaultUsername === 'string' && data.defaultUsername.trim()) {
          setDefaultAdminUsername(data.defaultUsername.trim());
        }
      }
    } catch {
      // Non-fatal; user can still retry from staff login page
    } finally {
      setAuthReady(true);
    }
  }, []);

  useEffect(() => {
    void refreshAuthStatus();
  }, [refreshAuthStatus]);

  const loginStaff = useCallback(
    async (username: string, password: string): Promise<boolean> => {
      setAuthError(null);
      try {
        const res = await fetch('/api/staff/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: username.trim(), password }),
        });

        const raw = await res.text();
        let data: {
          token?: string;
          staff?: StaffProfile;
          error?: string;
          needsInitialSetup?: boolean;
          defaultUsername?: string;
        } = {};
        try {
          data = raw ? (JSON.parse(raw) as typeof data) : {};
        } catch {
          setAuthError(`Unexpected response from staff server (HTTP ${res.status}).`);
          return false;
        }

        if (data.needsInitialSetup || res.status === 409) {
          setNeedsInitialSetup(true);
          if (typeof data.defaultUsername === 'string' && data.defaultUsername.trim()) {
            setDefaultAdminUsername(data.defaultUsername.trim());
          }
          setAuthError(
            data.error || 'No administrator account is configured on this server instance yet.'
          );
          return false;
        }

        if (!res.ok || !data.token || !data.staff) {
          setAuthError(data.error || 'Invalid username or password.');
          return false;
        }

        setStaffToken(data.token);
        setStaffUser(data.staff);
        setNeedsInitialSetup(false);
        return true;
      } catch (err) {
        setAuthError(
          err instanceof Error ? err.message : 'Unable to reach staff authentication server.'
        );
        return false;
      }
    },
    [setStaffToken]
  );

  const setupInitialAdmin = useCallback(
    async (username: string, password: string, displayName?: string): Promise<boolean> => {
      setAuthError(null);
      try {
        const res = await fetch('/api/staff/setup-admin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: username.trim(),
            password,
            displayName: displayName?.trim() || undefined,
          }),
        });

        const raw = await res.text();
        let data: { token?: string; staff?: StaffProfile; error?: string } = {};
        try {
          data = raw ? (JSON.parse(raw) as typeof data) : {};
        } catch {
          setAuthError(`Unexpected response from staff server (HTTP ${res.status}).`);
          return false;
        }

        if (!res.ok || !data.token || !data.staff) {
          setAuthError(data.error || 'Unable to configure initial administrator.');
          void refreshAuthStatus();
          return false;
        }

        setStaffToken(data.token);
        setStaffUser(data.staff);
        setNeedsInitialSetup(false);
        return true;
      } catch (err) {
        setAuthError(
          err instanceof Error ? err.message : 'Unable to reach staff authentication server.'
        );
        return false;
      }
    },
    [refreshAuthStatus, setStaffToken]
  );

  const logoutStaff = useCallback(() => {
    setStaffToken(null);
    setStaffUser(null);
    setAuthError(null);
    void refreshAuthStatus();
  }, [refreshAuthStatus, setStaffToken]);

  const toggleWishlist = useCallback(async (product: Product) => {
    setWishlistIds((prev) => {
      const exists = prev.includes(product.id);
      const next = exists ? prev.filter((id) => id !== product.id) : [...prev, product.id];
      writeJsonStorage(WISHLIST_STORAGE_KEY, next);
      return next;
    });
  }, []);

  const saveCheckoutContact = useCallback(
    (fullName: string, phone: string, savedAddress: string, preferredLang: Language) => {
      const next: SavedProfile = {
        fullName: fullName.trim().slice(0, 120),
        phone: phone.trim().slice(0, 32),
        savedAddress: savedAddress.trim().slice(0, 300),
        preferredLang,
      };
      setSavedProfile(next);
      writeJsonStorage(PROFILE_STORAGE_KEY, next);
    },
    []
  );

  const recordOrderToken = useCallback((orderRef: string, token: string) => {
    if (!orderRef || !token) return;
    setSavedOrderTokens((prev) => {
      const filtered = prev.filter((entry) => entry.orderRef !== orderRef);
      const next = [{ orderRef, token }, ...filtered].slice(0, 30);
      writeJsonStorage(ORDER_TOKENS_STORAGE_KEY, next);
      return next;
    });
  }, []);

  return (
    <AuthContext.Provider
      value={{
        authReady,
        staffToken,
        staffUser,
        needsInitialSetup,
        defaultAdminUsername,
        authError,
        wishlistIds,
        savedProfile,
        savedOrderTokens,
        refreshAuthStatus,
        loginStaff,
        setupInitialAdmin,
        logoutStaff,
        getStaffToken,
        setStaffUser,
        toggleWishlist,
        saveCheckoutContact,
        recordOrderToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
