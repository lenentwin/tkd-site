import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { clubApi, type ClubBootstrap } from "../../../services/club";
import { useAuth } from "../../../app/providers/AuthProvider";

export function kaliningradMonth(now: number): string {
  const parts = new Intl.DateTimeFormat("en", { timeZone: "Europe/Kaliningrad", year: "numeric", month: "2-digit" }).formatToParts(now);
  return `${parts.find(part => part.type === "year")!.value}-${parts.find(part => part.type === "month")!.value}`;
}
export function currentPayment(payment: { month: string; status: "paid" | "unpaid" }, month: string): "paid" | "unpaid" | "unknown" {
  return payment.month === month ? payment.status : "unknown";
}
const ClubContext = createContext<{ data: ClubBootstrap | null; loading: boolean; error: string; month: string; reload: () => Promise<void> } | null>(null);
export function ClubProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const identity = session?.mode === "server" ? `${session.id}:${session.role}` : "demo";
  const [data, setData] = useState<ClubBootstrap | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const [month, setMonth] = useState(() => kaliningradMonth(Date.now()));
  const clock = useRef({ server: Date.now(), received: performance.now(), wall: Date.now() }); const request = useRef(0); const requestedMonth = useRef("");
  const reload = useCallback(async () => {
    const id = ++request.current;
    try { const value = await clubApi.bootstrap(); if (id !== request.current) return; clock.current = { server: Date.parse(value.serverTime), received: performance.now(), wall: Date.now() }; setData(value); setMonth(value.currentMonth); setError(""); }
    catch (error) { if (id === request.current) setError(error instanceof Error ? error.message : "Сервис учёта недоступен."); }
    finally { if (id === request.current) setLoading(false); }
  }, []);
  const invalidate = useCallback(() => { ++request.current; }, []);
  useEffect(() => { setData(null); void reload(); return invalidate; }, [reload, invalidate, identity]);
  useEffect(() => {
    const refresh = () => { if (!document.hidden) void reload(); };
    const timer = window.setInterval(refresh, 60000); window.addEventListener("focus", refresh); document.addEventListener("visibilitychange", refresh);
    return () => { clearInterval(timer); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, [reload]);
  useEffect(() => {
    const update = () => {
      // Some platforms suspend performance.now() during system sleep. A wall
      // clock advancing farther can invalidate old paid, never preserve it.
      const elapsed = Math.max(performance.now() - clock.current.received, Date.now() - clock.current.wall, 0);
      const current = kaliningradMonth(clock.current.server + elapsed); setMonth(current);
      if (data && current !== data.currentMonth && requestedMonth.current !== current) { requestedMonth.current = current; void reload(); }
    };
    const timer = window.setInterval(update, 1000); window.addEventListener("focus", update);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", update); };
  }, [data, reload]);
  return <ClubContext.Provider value={{ data, loading, error, month, reload }}>{children}</ClubContext.Provider>;
}
export function useClub() { const value = useContext(ClubContext); if (!value) throw new Error("ClubProvider required"); return value; }
export function ClubConnection() {
  const { loading, error, reload } = useClub();
  if (loading) return <p role="status">Подключаемся к системе секции…</p>;
  if (!error) return null;
  return <div className="cabinet-notice" role="status"><h2>Сервис учёта недоступен</h2><p>{error}</p><button className="text-link" onClick={() => void reload()}>Повторить подключение</button></div>;
}
