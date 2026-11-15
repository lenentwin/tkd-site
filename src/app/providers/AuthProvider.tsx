import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { UserSession } from "../../types/services";
import { yandexAuthEnabled } from "../../services/backend";
import { AccountBlockedError, fetchYandexSession, logoutYandexSession, yandexStartUrl } from "../../services/yandexAuth";

const AuthContext = createContext<{
  session: UserSession | null;
  loading: boolean;
  unavailable: boolean;
  blocked: boolean;
  refresh: () => Promise<void>;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
} | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<UserSession | null>(() => {
    if (yandexAuthEnabled || !import.meta.env.DEV) return null;
    try {
      return sessionStorage.getItem("mft39.demo") === "on"
        ? { mode: "demo", displayName: "Демо-участник" }
        : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(yandexAuthEnabled);
  const [unavailable, setUnavailable] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const current = useRef(session);
  const sequence = useRef(0);
  const alive = useRef(true);
  const invalidatePending = useCallback(() => { ++sequence.current; }, []);
  const refresh = useCallback(async () => {
    if (!yandexAuthEnabled) return;
    const request = ++sequence.current;
    if (!navigator.onLine) { setUnavailable(true); setLoading(false); return; }
    if (!current.current) setLoading(true);
    try {
      const result = await fetchYandexSession();
      if (!alive.current || request !== sequence.current) return;
      current.current = result.session;
      setSession(result.session);
      setUnavailable(false);
      setBlocked(false);
    } catch (error) {
      if (alive.current && request === sequence.current) {
        setUnavailable(!(error instanceof AccountBlockedError)); setBlocked(error instanceof AccountBlockedError);
        if (error instanceof AccountBlockedError) { current.current = null; setSession(null); }
      }
    } finally {
      if (alive.current && request === sequence.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    if (!yandexAuthEnabled) return;
    alive.current = true;
    void refresh();
    const checkVisible = () => { if (document.visibilityState === "visible") void refresh(); };
    const expired = () => { invalidatePending(); current.current = null; setSession(null); setLoading(false); setUnavailable(false); };
    const denied = () => { invalidatePending(); current.current = null; setSession(null); setLoading(false); setUnavailable(false); setBlocked(true); };
    const timer = window.setInterval(() => { if (current.current) checkVisible(); }, 60000);
    window.addEventListener("focus", checkVisible);
    window.addEventListener("pageshow", checkVisible);
    window.addEventListener("online", checkVisible);
    window.addEventListener("offline", checkVisible);
    document.addEventListener("visibilitychange", checkVisible);
    window.addEventListener("mft39:session-expired", expired);
    window.addEventListener("mft39:account-blocked", denied);
    window.addEventListener("mft39:access-changed", checkVisible);
    return () => {
      alive.current = false;
      invalidatePending();
      window.clearInterval(timer);
      window.removeEventListener("focus", checkVisible);
      window.removeEventListener("pageshow", checkVisible);
      window.removeEventListener("online", checkVisible);
      window.removeEventListener("offline", checkVisible);
      document.removeEventListener("visibilitychange", checkVisible);
      window.removeEventListener("mft39:session-expired", expired);
      window.removeEventListener("mft39:account-blocked", denied);
      window.removeEventListener("mft39:access-changed", checkVisible);
    };
  }, [refresh, invalidatePending]);
  return (
    <AuthContext.Provider
      value={{
        session,
        loading,
        unavailable,
        blocked,
        refresh,
        signIn: async () => {
          if (yandexAuthEnabled) {
            // A bounded availability/session check gives this page an actionable
            // error before navigation and avoids reauthorizing a valid session.
            const value = await fetchYandexSession();
            invalidatePending(); current.current = value.session;
            setSession(value.session); setUnavailable(false); setLoading(false);
            if (!value.session) window.location.assign(yandexStartUrl);
            return;
          }
          if (!import.meta.env.DEV) throw new Error("Вход не подключён");
          const { demoAuthService } = await import("../../services/demo");
          const value = await demoAuthService.signIn();
          setSession(value);
          try {
            sessionStorage.setItem("mft39.demo", "on");
          } catch {
            /* In-memory demo is sufficient. */
          }
        },
        signOut: async () => {
          if (yandexAuthEnabled) {
            await logoutYandexSession();
            invalidatePending(); // A late profile response cannot resurrect logout.
            current.current = null;
            setSession(null); setUnavailable(false); setLoading(false); return;
          }
          if (!import.meta.env.DEV) return;
          const { demoAuthService } = await import("../../services/demo");
          await demoAuthService.signOut();
          setSession(null);
          try {
            sessionStorage.removeItem("mft39.demo");
          } catch {
            /* In-memory demo is cleared. */
          }
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("AuthProvider обязателен");
  return value;
}
