import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { UserSession } from "../../types/services";
import { yandexAuthEnabled } from "../../services/backend";
import { fetchYandexSession, logoutYandexSession, yandexStartUrl } from "../../services/yandexAuth";

const AuthContext = createContext<{
  session: UserSession | null;
  loading: boolean;
  unavailable: boolean;
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
  useEffect(() => {
    if (!yandexAuthEnabled) return;
    let cancelled = false;
    void fetchYandexSession().then(({ session }) => {
      if (!cancelled) { setSession(session); setUnavailable(false); }
    }).catch(() => { if (!cancelled) setUnavailable(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);
  return (
    <AuthContext.Provider
      value={{
        session,
        loading,
        unavailable,
        signIn: async () => {
          if (yandexAuthEnabled) { window.location.assign(yandexStartUrl); return; }
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
          if (yandexAuthEnabled) { await logoutYandexSession(); setSession(null); return; }
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
