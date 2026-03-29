"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ADMIN_TOKEN_STORAGE_KEY, type AdminUser } from "@/lib/auth-types";
import { apiLogin, apiLogout, apiMe } from "@/lib/auth-api";
import { ApiRequestError } from "@/lib/api-client";

type AdminAuthState = {
  token: string | null;
  user: AdminUser | null;
  loading: boolean;
  bootstrapped: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
};

const AdminAuthContext = createContext<AdminAuthState | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [bootstrapped, setBootstrapped] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshMe = useCallback(async () => {
    const t =
      typeof window !== "undefined"
        ? window.localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY)
        : null;
    if (!t) {
      setUser(null);
      setToken(null);
      return;
    }
    setToken(t);
    const res = await apiMe(t);
    setUser(res.data);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await refreshMe();
      } catch (e) {
        if (!cancelled) {
          if (e instanceof ApiRequestError && (e.status === 401 || e.status === 403)) {
            window.localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
            setToken(null);
            setUser(null);
          }
        }
      } finally {
        if (!cancelled) setBootstrapped(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshMe]);

  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    setLoading(true);
    try {
      const res = await apiLogin(email, password);
      window.localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, res.data.token);
      setToken(res.data.token);
      setUser(res.data.user);
    } catch (e) {
      const msg = e instanceof ApiRequestError ? e.message : "Login failed";
      setError(msg);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    const t = window.localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY);
    window.localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
    setToken(null);
    setUser(null);
    if (t) {
      try {
        await apiLogout(t);
      } catch {
        /* ignore */
      }
    }
  }, []);

  const value = useMemo(
    () => ({
      token,
      user,
      loading,
      bootstrapped,
      error,
      login,
      logout,
      refreshMe,
    }),
    [token, user, loading, bootstrapped, error, login, logout, refreshMe]
  );

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth(): AdminAuthState {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error("useAdminAuth must be used within AdminAuthProvider");
  return ctx;
}
