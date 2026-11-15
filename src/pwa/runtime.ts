import { useSyncExternalStore } from "react";

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}
export type InstallPlatform = "ios" | "android" | "desktop";
export function installPlatform(userAgent: string, touchPoints = 0): InstallPlatform {
  if (/iPhone|iPad|iPod/i.test(userAgent) || (/Macintosh/i.test(userAgent) && touchPoints > 1)) return "ios";
  return /Android/i.test(userAgent) ? "android" : "desktop";
}
type PwaState = {
  online: boolean; supported: boolean; standalone: boolean; installed: boolean;
  updateReady: boolean; updateVisible: boolean; applying: boolean;
  installHelp: boolean; installing: boolean; error: string;
};
const browser = typeof window !== "undefined";
const standalone = () => browser && (window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);
let state: PwaState = {
  online: browser ? navigator.onLine : true, supported: false, standalone: standalone(), installed: standalone(),
  updateReady: false, updateVisible: false, applying: false, installHelp: false, installing: false, error: "",
};
const listeners = new Set<() => void>();
function setState(next: Partial<PwaState>) {
  if (Object.entries(next).every(([key, value]) => state[key as keyof PwaState] === value)) return;
  state = { ...state, ...next }; for (const listener of listeners) listener();
}
const snapshot = () => state;
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export function usePwa() { return useSyncExternalStore(subscribe, snapshot, snapshot); }

let started = false; let registration: ServiceWorkerRegistration | undefined;
let installPrompt: InstallPromptEvent | undefined; let waiting: ServiceWorker | null = null;
let reloadRequested = false;

export function initializePwa() {
  if (!browser || started) return;
  started = true;
  window.addEventListener("online", () => { setState({ online: true }); void checkForPwaUpdate(); });
  window.addEventListener("offline", () => setState({ online: false }));
  const media = window.matchMedia("(display-mode: standalone)");
  media.addEventListener("change", () => setState({ standalone: standalone(), installed: state.installed || standalone() }));
  if (!import.meta.env.PROD || !window.isSecureContext || !("serviceWorker" in navigator)) return;
  setState({ supported: true });
  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault(); installPrompt = event as InstallPromptEvent;
  });
  window.addEventListener("appinstalled", () => {
    installPrompt = undefined; setState({ installed: true, installHelp: false, installing: false });
  });
  let controller = navigator.serviceWorker.controller;
  const controlledAtStart = !!controller;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    const next = navigator.serviceWorker.controller;
    if (next === controller) return;
    if (reloadRequested) { window.location.reload(); return; }
    if (controller) setState({ updateReady: true, updateVisible: true });
    controller = next;
  });
  const announce = (worker: ServiceWorker | null) => {
    if (!worker || worker === waiting) return;
    waiting = worker; setState({ updateReady: true, updateVisible: true, error: "" });
  };
  const observe = (worker: ServiceWorker | null) => {
    if (!worker) return;
    // WebKit can deliver the installed event after the first claim. Capture
    // the previous active worker now, rather than testing controller later.
    const replacesActive = !!registration?.active && registration.active !== worker;
    worker.addEventListener("statechange", () => {
      if (worker.state === "installed" && replacesActive) announce(registration?.waiting ?? worker);
    });
  };
  void navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).then(value => {
    registration = value;
    if (controlledAtStart) announce(value.waiting);
    observe(value.installing);
    value.addEventListener("updatefound", () => observe(value.installing));
  }).catch(() => {
    // Registration failure never blocks the regular site or changes its auth.
  });
  window.addEventListener("focus", () => { if (!document.hidden) void checkForPwaUpdate(); });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) void checkForPwaUpdate(); });
  window.setInterval(() => { if (!document.hidden) void checkForPwaUpdate(); }, 60 * 60 * 1000);
}
export async function checkForPwaUpdate() {
  if (!registration || !navigator.onLine) return;
  try { await registration.update(); } catch { /* Offline/current release remains usable. */ }
}
export async function installPwa() {
  if (state.installing) return;
  setState({ error: "" });
  if (!installPrompt) { setState({ installHelp: true }); return; }
  const prompt = installPrompt; installPrompt = undefined; setState({ installing: true });
  try {
    await prompt.prompt(); const choice = await prompt.userChoice;
    if (choice.outcome === "accepted") setState({ installed: true, installHelp: false });
  } catch { setState({ installHelp: true, error: "Браузер не открыл установку. Используйте инструкцию ниже." }); }
  finally { setState({ installing: false }); }
}
export function closeInstallHelp() { setState({ installHelp: false, error: "" }); }
export function showPwaUpdate() { setState({ updateVisible: true, error: "" }); }
export function dismissPwaUpdate() { setState({ updateVisible: false, error: "" }); }
export function applyPwaUpdate() {
  if (!state.online || state.applying) return;
  setState({ applying: true, error: "" }); reloadRequested = true;
  if (registration?.waiting) {
    registration.waiting.postMessage({ type: "SKIP_WAITING" });
    window.setTimeout(() => {
      if (reloadRequested) { reloadRequested = false; setState({ applying: false, error: "Не удалось обновить приложение. Проверьте подключение и повторите попытку." }); }
    }, 15000);
  } else window.location.reload();
}
