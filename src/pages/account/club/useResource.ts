import { useCallback, useEffect, useRef, useState } from "react";
export function useResource<T>(loader: () => Promise<T>, enabled = true, refreshKey: string | number = 0) {
  const [data, setData] = useState<T | null>(null); const [error, setError] = useState(""); const [busy, setBusy] = useState(enabled); const sequence = useRef(0);
  const reload = useCallback(async () => {
    if (!enabled) { ++sequence.current; setData(null); setBusy(false); return; }
    const id = ++sequence.current; setBusy(true);
    try { const value = await loader(); if (id === sequence.current) { setData(value); setError(""); } }
    catch (error) { if (id === sequence.current) { setData(null); setError(error instanceof Error ? error.message : "Не удалось загрузить данные."); } }
    finally { if (id === sequence.current) setBusy(false); }
  }, [enabled, loader]);
  const invalidate = useCallback(() => { sequence.current += 1; }, []);
  useEffect(() => { void reload(); return invalidate; }, [reload, invalidate, refreshKey]);
  return { data, error, busy, reload };
}
