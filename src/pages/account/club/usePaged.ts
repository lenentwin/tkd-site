import { useCallback, useEffect, useRef, useState } from "react";

type Page<T> = { items: T[]; nextCursor: string | null };
/** A failed reload discards the snapshot. Late replies cannot cross a scope change. */
export function usePaged<T>(loader: (cursor: string) => Promise<Page<T>>, enabled: boolean, refreshKey: string) {
  const [data, setData] = useState<Page<T> | null>(null); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const generation = useRef(0); const pending = useRef(false);
  const reload = useCallback(async () => {
    const id = ++generation.current; pending.current = false; setData(null); setError("");
    if (!enabled) { setBusy(false); return; }
    setBusy(true);
    try { const value = await loader(""); if (id === generation.current) setData(value); }
    catch (error) { if (id === generation.current) setError(error instanceof Error ? error.message : "Не удалось загрузить данные."); }
    finally { if (id === generation.current) setBusy(false); }
  }, [loader, enabled]);
  const invalidate = useCallback(() => { ++generation.current; }, []);
  useEffect(() => { void reload(); return invalidate; }, [reload, invalidate, refreshKey]);
  async function more() {
    if (!enabled || !data?.nextCursor || busy || pending.current) return;
    const id = generation.current; const cursor = data.nextCursor; pending.current = true; setBusy(true); setError("");
    try { const value = await loader(cursor); if (id === generation.current) setData(current => current ? { items: [...current.items, ...value.items], nextCursor: value.nextCursor } : null); }
    catch (error) { if (id === generation.current) setError(error instanceof Error ? error.message : "Не удалось загрузить данные."); }
    finally { if (id === generation.current) { pending.current = false; setBusy(false); } }
  }
  return { data, busy, error, reload, more };
}
