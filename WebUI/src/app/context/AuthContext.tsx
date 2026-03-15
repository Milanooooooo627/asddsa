import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { PropsWithChildren } from 'react';
import {
  authenticate,
  clearStoredSession,
  getStoredApiBase,
  getStoredSecret,
  getStoredTheme,
  getStoredUser,
  healthCheck,
  redeemUserKey,
  registerUser,
  setStoredApiBase,
  setStoredSecret,
  setStoredTheme,
  setStoredUser,
  type AuthUser,
} from '../lib/api';

interface AuthContextValue {
  user: AuthUser | null;
  apiBase: string;
  theme: string;
  secret: string;
  isAuthenticated: boolean;
  isOwner: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (email: string, password: string, licenseKey?: string) => Promise<AuthUser>;
  redeemKey: (licenseKey: string) => Promise<AuthUser>;
  logout: () => void;
  syncUser: (user: AuthUser | null) => void;
  setApiBase: (base: string) => void;
  setTheme: (theme: string) => void;
  checkHealth: (baseOverride?: string) => Promise<string>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AuthUser | null>(() => getStoredUser());
  const [secret, setSecret] = useState(() => getStoredSecret());
  const [apiBase, setApiBaseState] = useState(() => getStoredApiBase());
  const [theme, setThemeState] = useState(() => getStoredTheme());

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const login = async (email: string, password: string) => {
    const result = await authenticate(apiBase, email, password);
    setUser(result.user);
    setSecret(password);
    setStoredUser(result.user);
    setStoredSecret(password);
    return result.user;
  };

  const register = async (email: string, password: string, licenseKey?: string) => {
    const result = await registerUser(apiBase, email, password, licenseKey);
    setUser(result.user);
    setSecret(password);
    setStoredUser(result.user);
    setStoredSecret(password);
    return result.user;
  };

  const redeemKey = async (licenseKey: string) => {
    if (!user || !secret) {
      throw new Error('You must be logged in to redeem a key.');
    }
    const result = await redeemUserKey(apiBase, user.email, secret, licenseKey);
    setUser(result.user);
    setStoredUser(result.user);
    return result.user;
  };

  const logout = () => {
    setUser(null);
    setSecret('');
    clearStoredSession();
  };

  const syncUser = (nextUser: AuthUser | null) => {
    setUser(nextUser);
    setStoredUser(nextUser);
  };

  const setApiBase = (base: string) => {
    setApiBaseState(base);
    setStoredApiBase(base);
  };

  const setTheme = (nextTheme: string) => {
    setThemeState(nextTheme);
    setStoredTheme(nextTheme);
  };

  const checkHealth = async (baseOverride?: string) => {
    const result = await healthCheck(baseOverride || apiBase);
    return result.message;
  };

  const value = useMemo<AuthContextValue>(() => ({
    user,
    apiBase,
    theme,
    secret,
    isAuthenticated: Boolean(user),
    isOwner: Boolean(user && (user.role === 'owner' || user.role === 'admin')),
    login,
    register,
    redeemKey,
    logout,
    syncUser,
    setApiBase,
    setTheme,
    checkHealth,
  }), [user, apiBase, theme, secret]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}