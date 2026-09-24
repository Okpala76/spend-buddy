'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { getBrowserSession } from './browser-session';
import { INITIAL_AUTH, type AuthSnapshot } from './types';
import type { AuthSession } from './session';

export type AuthContextValue = AuthSnapshot & {
  login: () => Promise<void>;
  register: () => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: (force?: boolean) => Promise<string | null>;
  hasRole: (role: string) => boolean;
  clearAuth: (error?: string) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const serverSnapshot = () => INITIAL_AUTH;
const emptySubscription = () => () => undefined;

export function AuthProvider({
  children,
  session: supplied,
}: {
  children: ReactNode;
  session?: AuthSession;
}) {
  const [session] = useState(
    () => supplied ?? (typeof window !== 'undefined' ? getBrowserSession() : null),
  );
  const snapshot = useSyncExternalStore(
    session?.subscribe ?? emptySubscription,
    session?.getSnapshot ?? serverSnapshot,
    serverSnapshot,
  );

  useEffect(() => {
    if (!session) return;
    void session.initialize();
    return session.startAutoRefresh();
  }, [session]);

  const value: AuthContextValue = {
    ...snapshot,
    login: async () => {
      await session?.login();
    },
    register: async () => {
      await session?.register();
    },
    logout: async () => {
      await session?.logout();
    },
    refreshToken: async (force) => (await session?.refreshToken(force)) ?? null,
    hasRole: (role) => snapshot.user?.roles.includes(role) ?? false,
    clearAuth: (error) => session?.clearAuth(error),
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be inside AuthProvider');
  return value;
}
