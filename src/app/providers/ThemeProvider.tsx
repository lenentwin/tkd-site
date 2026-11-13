import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useContent } from "./ContentProvider";
import type { ThemeMode } from "../../types/content";

const ThemeContext = createContext<{
  theme: ThemeMode;
  setTheme: (mode: ThemeMode) => void;
  toggleTheme: () => void;
} | null>(null);
export function ThemeProvider({ children }: { children: ReactNode }) {
  const { content } = useContent();
  const [choice, setChoice] = useState<ThemeMode | null>(() => {
    try {
      const value = localStorage.getItem("mft39.theme");
      return value === "light" || value === "dark" ? value : null;
    } catch {
      return null;
    }
  });
  const isPreview = new URLSearchParams(window.location.search).has(
    "editorPreview",
  );
  const theme = isPreview
    ? content.theme.defaultMode
    : (choice ?? content.theme.defaultMode);
  const appliedTheme = useRef<ThemeMode | null>(null);
  const activeTransition = useRef<ViewTransition | null>(null);
  const fallbackTimer = useRef<number | undefined>(undefined);
  const themeRevision = useRef(0);
  useEffect(() => {
    const root = document.documentElement;
    const revision = ++themeRevision.current;
    const changed = appliedTheme.current !== null && appliedTheme.current !== theme;
    appliedTheme.current = theme;
    activeTransition.current?.skipTransition();
    activeTransition.current = null;
    window.clearTimeout(fallbackTimer.current);
    const applyTheme = () => {
      // A rapid second toggle supersedes any queued snapshot callback.
      if (revision !== themeRevision.current) return;
      root.dataset.theme = theme;
      root.style.setProperty("--accent", content.theme.accent);
      root.style.setProperty("--accent-secondary", content.theme.secondaryAccent);
      root.style.setProperty("--grid-opacity", String(content.theme.gridOpacity));
      root.style.setProperty(
        "--transition-duration",
        `${content.motion.transitionDuration}s`,
      );
      root.dataset.motion = content.motion.enabled ? "on" : "off";
    };
    if (!changed || document.hidden) {
      delete root.dataset.themeTransition;
      applyTheme();
      return;
    }
    const soft = window.matchMedia("(prefers-reduced-motion: reduce)").matches || !content.motion.enabled;
    if (typeof document.startViewTransition === "function") {
      root.dataset.themeTransition = soft ? "soft" : "fade";
      const transition = document.startViewTransition(applyTheme);
      activeTransition.current = transition;
      const finish = () => {
        if (activeTransition.current !== transition) return;
        activeTransition.current = null;
        delete root.dataset.themeTransition;
      };
      // Skipped snapshots can reject ready while the requested theme still applies.
      void transition.ready.catch(() => undefined);
      void transition.finished.then(finish, finish);
    } else {
      root.dataset.themeTransition = soft ? "fallback-soft" : "fallback";
      applyTheme();
      fallbackTimer.current = window.setTimeout(() => {
        if (revision === themeRevision.current) delete root.dataset.themeTransition;
      }, soft ? 200 : 360);
    }
  }, [theme, content.theme, content.motion]);
  useEffect(() => () => {
    themeRevision.current += 1;
    activeTransition.current?.skipTransition();
    window.clearTimeout(fallbackTimer.current);
    delete document.documentElement.dataset.themeTransition;
  }, []);
  const value = useMemo(
    () => ({
      theme,
      setTheme: (mode: ThemeMode) => {
        setChoice(mode);
        try {
          localStorage.setItem("mft39.theme", mode);
        } catch {
          /* Session choice still works without storage. */
        }
      },
      toggleTheme: () => {
        const mode = theme === "dark" ? "light" : "dark";
        setChoice(mode);
        try {
          localStorage.setItem("mft39.theme", mode);
        } catch {
          /* Session choice still works. */
        }
      },
    }),
    [theme],
  );
  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}
export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("ThemeProvider обязателен");
  return value;
}
