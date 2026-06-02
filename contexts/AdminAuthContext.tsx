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

/**
 * Shared session cookie — readable from both zulu.am and admin.zulu.am
 * (Domain=.zulu.am). The web/admin SPAs each keep their own localStorage
 * copy of the bearer; this cookie is the bridge so that opening a fresh
 * tab on a sibling subdomain inherits the active session without re-login.
 *
 * Set at every login / token-adoption point, cleared at logout. The server
 * is the source of truth for token validity, so the existing /me probe
 * still kicks expired sessions out.
 */
const SHARED_SESSION_COOKIE = "zulu_session_token";
const SHARED_SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

function sharedCookieDomainAttr(): string {
  if (typeof location === "undefined") return "";
  const h = location.hostname;
  if (h === "zulu.am" || h.endsWith(".zulu.am")) return "; Domain=.zulu.am";
  return "";
}

function readSharedSessionCookie(): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(/(?:^|;\s*)zulu_session_token=([^;]+)/);
  return m ? decodeURIComponent(m[1]!) : null;
}

function writeSharedSessionCookie(token: string): void {
  if (typeof document === "undefined") return;
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie =
    `${SHARED_SESSION_COOKIE}=${encodeURIComponent(token)}` +
    `; Path=/${sharedCookieDomainAttr()}; Max-Age=${SHARED_SESSION_MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
}

function clearSharedSessionCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie =
    `${SHARED_SESSION_COOKIE}=` +
    `; Path=/${sharedCookieDomainAttr()}; Max-Age=0; SameSite=Lax`;
}

/**
 * Idle-logout threshold. After 1 hour with no mouse / keyboard / scroll /
 * touch activity, end the session everywhere (revokes server-side, sibling
 * tabs catch the 401 via the existing /me poll).
 */
const IDLE_LOGOUT_MS = 60 * 60 * 1000;

/**
 * `login()` resolves two ways: a normal authenticated session, or a 2FA gate
 * where the backend withheld the session and handed back a short-lived
 * challenge token to be exchanged on the /2fa page.
 */
export type AdminLoginOutcome =
  | { kind: "authenticated"; user: AdminUser }
  | { kind: "two_factor"; challengeToken: string };

type AdminAuthState = {
  token: string | null;
  user: AdminUser | null;
  loading: boolean;
  bootstrapped: boolean;
  error: string | null;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<AdminLoginOutcome>;
  /**
   * Adopt a session whose token was issued out-of-band (2FA verify, SSO
   * handoff). Stores the token + fetches /account/me to populate the user.
   */
  loginWithToken: (token: string) => Promise<AdminUser>;
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

  // Always-current snapshot of `user` for use inside long-lived effect
  // callbacks (the session-sync poll) without re-subscribing the effect.
  const userRef = useRef<AdminUser | null>(null);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

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

  const clearSessionLocally = useCallback(() => {
    try {
      window.localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
      window.localStorage.removeItem(ADMIN_USER_STORAGE_KEY);
      window.localStorage.removeItem(ADMIN_USER_FETCHED_AT_KEY);
    } catch {
      /* ignore */
    }
    clearSharedSessionCookie();
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Bootstrap: fast — only checks localStorage for token + cached user.
      // Always finish with setBootstrapped in `finally` so we never stay stuck on
      // bootstrapped=false if `cancelled` flipped before the inner `if (!cancelled)` ran.
      try {
        let t = window.localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY);
        // Cross-subdomain fallback: opening admin.zulu.am in a fresh tab while
        // already signed in on zulu.am — the shared cookie carries the bearer
        // across origins. Adopt it so admin UI hydrates as logged-in without
        // a second login.
        if (!t) {
          const cookieTok = readSharedSessionCookie();
          if (cookieTok) {
            t = cookieTok;
            try {
              window.localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, t);
            } catch {
              /* ignore */
            }
          }
        }
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
            clearSessionLocally();
          }
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshMeIfStale, clearSessionLocally]);

  /**
   * Server-driven session sync — picks up logouts that happened in another
   * tab or on the customer subdomain (zulu.am ↔ admin.zulu.am share the same
   * Sanctum bearer via the /sso handoff, so revoking it on one side has to
   * propagate visually on the other).
   *
   *  - storage event: instant for SAME-origin admin tabs (one admin tab logs
   *    out → another admin tab sees ADMIN_TOKEN_STORAGE_KEY removed).
   *  - visibilitychange: instant when the user flips back to this tab after
   *    logging out elsewhere — no stale "still logged in" chrome.
   *  - 30 s interval: backstop for tabs that stay visible-but-idle.
   */
  useEffect(() => {
    if (!token) return;
    let alive = true;

    async function check() {
      if (!alive) return;
      const t = window.localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY);
      if (!t) {
        clearSessionLocally();
        return;
      }
      // Cheap synchronous signal: shared cookie was wiped by a sibling tab's
      // logout (Domain=.zulu.am). We still have localStorage from before
      // → clear immediately, no /me round-trip. Caught within one tick
      // regardless of subdomain.
      const cookieToken = readSharedSessionCookie();
      if (!cookieToken) {
        clearSessionLocally();
        return;
      }
      try {
        const res = await apiMe(t);
        if (!alive) return;
        // Live permission/role sync: the token-validity poll already fetched
        // /me, so reuse the response to refresh the cached user when ANYTHING
        // changed (e.g. a super-admin just edited this role's permissions).
        // The operator/agent then sees the new access within ~5 s or on tab
        // focus — no log-out/in needed. Guarded so identical payloads don't
        // churn re-renders.
        if (res?.data && JSON.stringify(res.data) !== JSON.stringify(userRef.current)) {
          setUser(res.data);
          setCachedUser(res.data);
        }
      } catch (e) {
        if (!alive) return;
        if (e instanceof ApiRequestError && (e.status === 401 || e.status === 403)) {
          clearSessionLocally();
        }
        /* other errors (network, 5xx) — leave state alone, next tick retries */
      }
    }

    // 5 s tick — covers the side-by-side-windows case where visibilitychange
    // doesn't fire because both tabs stay visible.
    const id = window.setInterval(check, 5_000);
    const onVis = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onVis);
    // `focus` fires on cross-window focus changes — visibilitychange misses
    // these (only fires when a tab becomes hidden/visible, not when focus
    // moves between two visible windows).
    const onFocus = () => void check();
    window.addEventListener("focus", onFocus);
    const onStorage = (e: StorageEvent) => {
      if (e.key === ADMIN_TOKEN_STORAGE_KEY && e.newValue === null) {
        clearSessionLocally();
      }
    };
    window.addEventListener("storage", onStorage);

    return () => {
      alive = false;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("storage", onStorage);
    };
  }, [token, clearSessionLocally]);

  /**
   * Idle-logout — after IDLE_LOGOUT_MS of no user activity, revoke the
   * server-side token and clear local state. Sibling tabs (any subdomain)
   * pick up the 401 via the session-sync effect and sign out within ~30 s.
   */
  useEffect(() => {
    if (!token) return;
    let alive = true;
    let lastActivity = Date.now();
    const bump = () => {
      lastActivity = Date.now();
    };

    const events: Array<keyof DocumentEventMap> = [
      "mousedown",
      "mousemove",
      "keydown",
      "scroll",
      "touchstart",
      "click",
    ];
    for (const ev of events) {
      document.addEventListener(ev, bump, { passive: true });
    }

    const check = async () => {
      if (!alive) return;
      if (Date.now() - lastActivity < IDLE_LOGOUT_MS) return;
      const t = window.localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY);
      if (t) {
        try {
          await apiLogout(t);
        } catch {
          /* even if revocation fails, still clear locally */
        }
      }
      if (alive) clearSessionLocally();
    };

    const id = window.setInterval(check, 60_000);
    return () => {
      alive = false;
      window.clearInterval(id);
      for (const ev of events) {
        document.removeEventListener(ev, bump);
      }
    };
  }, [token, clearSessionLocally]);

  const login = useCallback(async (email: string, password: string, rememberMe: boolean = false): Promise<AdminLoginOutcome> => {
    setError(null);
    setLoading(true);
    try {
      const res = await apiLogin(email, password, rememberMe);
      // 2FA gate — backend withheld the session and returned a challenge token.
      // Hand it back so the caller can route to /2fa to collect the code.
      if ("requires_2fa" in res.data && res.data.requires_2fa) {
        return { kind: "two_factor", challengeToken: res.data.challenge_token };
      }
      if (!("token" in res.data) || !res.data.token || !res.data.user) {
        throw new ApiRequestError("Invalid login response", 500);
      }
      window.localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, res.data.token);
      writeSharedSessionCookie(res.data.token);
      setToken(res.data.token);
      setUser(res.data.user);
      setCachedUser(res.data.user);
      return { kind: "authenticated", user: res.data.user };
    } catch (e) {
      const msg = e instanceof ApiRequestError ? e.message : "Login failed";
      setError(msg);
      throw e;
    } finally {
      setLoading(false);
    }
  }, [setCachedUser]);

  /**
   * Adopt a session whose token was minted out-of-band — used by the /2fa page
   * after a successful challenge exchange, and by the /sso handoff page.
   * Stores the token, fetches /account/me, hydrates the user state.
   */
  const loginWithToken = useCallback(async (newToken: string): Promise<AdminUser> => {
    if (typeof newToken !== "string" || newToken === "") {
      throw new ApiRequestError("Empty token", 400);
    }
    setError(null);
    setLoading(true);
    try {
      window.localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, newToken);
      writeSharedSessionCookie(newToken);
      setToken(newToken);
      const res = await apiMe(newToken);
      setUser(res.data);
      setCachedUser(res.data);
      return res.data;
    } catch (e) {
      // Clean up the half-applied session so the user can retry.
      window.localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
      clearSharedSessionCookie();
      setToken(null);
      const msg = e instanceof ApiRequestError ? e.message : "Token adoption failed";
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
    clearSharedSessionCookie();
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
      loginWithToken,
      logout,
      refreshMe,
    }),
    [token, user, loading, bootstrapped, error, login, loginWithToken, logout, refreshMe]
  );

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth(): AdminAuthState {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error("useAdminAuth must be used within AdminAuthProvider");
  return ctx;
}
