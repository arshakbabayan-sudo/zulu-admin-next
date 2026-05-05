"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ADMIN_TOKEN_STORAGE_KEY,
  ADMIN_USER_STORAGE_KEY,
  type AdminUser,
} from "@/lib/auth-types";
import { apiLogin, apiLogout, apiMe } from "@/lib/auth-api";
import { ApiRequestError } from "@/lib/api-client";

const ADMIN_USER_FETCHED_AT_KEY = "admin_user_fetched_at";
/** Re-fetch /account/me at most once every 5 minutes (300 000 ms). */
const ME_REFRESH_INTERVAL_MS = 5 * 60 * 1000;

type AdminAuthState = {
  token: string | null;
  user: AdminUser | null;
  loading: boolean;
  bootstrapped: boolean;
  error: string | null;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<AdminUser>;
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

  /**
   * In-flight deduplication: if a /account/me request is already in progress,
   * subsequent callers await the same Promise instead of firing a second request.
   * This prevents React StrictMode double-invoke from sending 2 requests.
   */
  const meInFlightRef = useRef<Promise<void> | null>(null);

  const setCachedUser = useCallback((u: AdminUser | null) => {
    try {
      if (u) {
        window.localStorage.setItem(ADMIN_USER_STORAGE_KEY, JSON.stringify(u));
        window.localStorage.setItem(ADMIN_USER_FETCHED_AT_KEY, String(Date.now()));
      } else {
        window.localStorage.removeItem(ADMIN_USER_STORAGE_KEY);
        window.localStorage.removeItem(ADMIN_USER_FETCHED_AT_KEY);
      }
    } catch {
      // non-critical cache
    }
  }, []);

  /** Force-refresh /account/me regardless of cache age. Used after login. */
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
    setCachedUser(res.data);
  }, [setCachedUser]);

  /**
   * Refresh /account/me only if the cached copy is older than ME_REFRESH_INTERVAL_MS.
   * Deduplicates concurrent calls (React StrictMode, parallel mounts) via meInFlightRef.
   */
  const refreshMeIfStale = useCallback(async () => {
    // If a request is already in flight, wait for it — do NOT fire a second one.
    if (meInFlightRef.current) {
      await meInFlightRef.current;
      return;
    }

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

    try {
      const fetchedAt = window.localStorage.getItem(ADMIN_USER_FETCHED_AT_KEY);
      const age = fetchedAt ? Date.now() - Number(fetchedAt) : Infinity;
      if (age < ME_REFRESH_INTERVAL_MS) {
        // Cache is fresh — skip the network call entirely.
        return;
      }
    } catch {
      // ignore localStorage errors
    }

    // Fire the request and store the Promise so concurrent callers share it.
    const promise = (async () => {
      try {
        const res = await apiMe(t);
        setUser(res.data);
        setCachedUser(res.data);
      } finally {
        meInFlightRef.current = null;
      }
    })();

    meInFlightRef.current = promise;
    await promise;
  }, [setCachedUser]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Bootstrap: fast — only checks localStorage for token + cached user.
      // Always finish with setBootstrapped in `finally` so we never stay stuck on
      // bootstrapped=false if `cancelled` flipped before the inner `if (!cancelled)` ran.
      try {
        const t = window.localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY);
        if (!cancelled) {
          setToken(t);
          if (t) {
            try {
              const cached = window.localStorage.getItem(ADMIN_USER_STORAGE_KEY);
              if (cached) setUser(JSON.parse(cached) as AdminUser);
            } catch {
              // ignore bad cache
            }
          } else {
            setUser(null);
          }
        }
      } catch {
        // ignore localStorage / parse errors
      } finally {
        if (!cancelled) {
          setBootstrapped(true);
        }
      }

      // Background: refresh only if stale — no network hit on fresh cache or repeated mounts.
      try {
        await refreshMeIfStale();
      } catch (e) {
        if (!cancelled) {
          if (e instanceof ApiRequestError && (e.status === 401 || e.status === 403)) {
            window.localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
            window.localStorage.removeItem(ADMIN_USER_STORAGE_KEY);
            window.localStorage.removeItem(ADMIN_USER_FETCHED_AT_KEY);
            setToken(null);
            setUser(null);
          }
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshMeIfStale]);

  const login = useCallback(async (email: string, password: string, rememberMe: boolean = false) => {
    setError(null);
    setLoading(true);
    try {
      const res = await apiLogin(email, password, rememberMe);
      window.localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, res.data.token);
      setToken(res.data.token);
      setUser(res.data.user);
      setCachedUser(res.data.user);
      return res.data.user;
    } catch (e) {
      const msg = e instanceof ApiRequestError ? e.message : "Login failed";
      setError(msg);
      throw e;
    } finally {
      setLoading(false);
    }
  }, [setCachedUser]);

  const logout = useCallback(async () => {
    const t = window.localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY);
    window.localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
    window.localStorage.removeItem(ADMIN_USER_STORAGE_KEY);
    window.localStorage.removeItem(ADMIN_USER_FETCHED_AT_KEY);
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
