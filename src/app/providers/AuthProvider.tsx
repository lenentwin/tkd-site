import { createContext, useContext, useState, type ReactNode } from "react";
import type { UserSession } from "../../types/services";

const AuthContext = createContext<{
  session: UserSession | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
} | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<UserSession | null>(() => {
    if (!import.meta.env.DEV) return null;
    try {
      return sessionStorage.getItem("mft39.demo") === "on"
        ? { mode: "demo", displayName: "Демо-участник" }
        : null;
    } catch {
      return null;
    }
  });
  return (
    <AuthContext.Provider
      value={{
        session,
        signIn: async () => {
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
