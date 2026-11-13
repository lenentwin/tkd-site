import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
  type ReactNode,
} from "react";
import { defaultContent } from "../../content/site.content";
import {
  CONTENT_KEY,
  loadContent,
  persistContent,
} from "../../editor/persistence/contentStorage";
import { parseContent, type SiteContent } from "../../types/content";

type History = {
  past: SiteContent[];
  present: SiteContent;
  future: SiteContent[];
};
type Action =
  | { type: "replace"; content: SiteContent }
  | { type: "load"; content: SiteContent }
  | { type: "undo" | "redo" };
function reducer(state: History, action: Action): History {
  if (action.type === "load")
    return { past: [], present: action.content, future: [] };
  if (action.type === "replace") {
    // Input blur can commit the same value as its change event. It must not
    // consume an undo step or discard an existing redo branch.
    if (JSON.stringify(action.content) === JSON.stringify(state.present))
      return state;
    return {
      past: [...state.past.slice(-39), state.present],
      present: action.content,
      future: [],
    };
  }
  if (action.type === "undo" && state.past.length)
    return {
      past: state.past.slice(0, -1),
      present: state.past[state.past.length - 1],
      future: [state.present, ...state.future],
    };
  if (action.type === "redo" && state.future.length)
    return {
      past: [...state.past, state.present],
      present: state.future[0],
      future: state.future.slice(1),
    };
  return state;
}
type ContentContextValue = {
  content: SiteContent;
  replaceContent: (content: SiteContent) => void;
  save: () => boolean;
  reset: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  dirty: boolean;
  error: string;
  clearError: () => void;
};
const ContentContext = createContext<ContentContextValue | null>(null);

export function ContentProvider({ children }: { children: ReactNode }) {
  const [loaded] = useState(loadContent);
  const [history, dispatch] = useReducer(reducer, {
    past: [],
    present: loaded.content,
    future: [],
  });
  const [saved, setSaved] = useState(() => JSON.stringify(loaded.content));
  const [error, setError] = useState(loaded.error);
  const dirty = JSON.stringify(history.present) !== saved;
  const replaceContent = useCallback(
    (content: SiteContent) =>
      dispatch({ type: "replace", content: parseContent(content) }),
    [],
  );
  const save = useCallback(() => {
    try {
      persistContent(history.present);
      setSaved(JSON.stringify(history.present));
      setError("");
      return true;
    } catch {
      setError(
        "Сохранение недоступно: разрешите локальное хранилище или экспортируйте JSON, чтобы не потерять изменения.",
      );
      return false;
    }
  }, [history.present]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  useEffect(() => {
    const preview = (event: MessageEvent) => {
      if (!import.meta.env.DEV) return;
      if (
        window.parent === window ||
        event.source !== window.parent ||
        event.origin !== window.location.origin ||
        event.data?.type !== "mft39-preview"
      )
        return;
      try {
        const next = parseContent(event.data.content);
        dispatch({ type: "load", content: next });
        setSaved(JSON.stringify(next));
      } catch {
        setError("Предпросмотр получил конфигурацию с ошибкой.");
      }
    };
    const storage = (event: StorageEvent) => {
      if (!import.meta.env.DEV) return;
      if (event.key !== CONTENT_KEY || dirty || !event.newValue) return;
      try {
        const next = parseContent(JSON.parse(event.newValue));
        dispatch({ type: "load", content: next });
        setSaved(JSON.stringify(next));
      } catch {
        setError("Изменения в другой вкладке имеют неверный формат.");
      }
    };
    window.addEventListener("message", preview);
    window.addEventListener("storage", storage);
    return () => {
      window.removeEventListener("message", preview);
      window.removeEventListener("storage", storage);
    };
  }, [dirty]);

  const value = useMemo<ContentContextValue>(
    () => ({
      content: history.present,
      replaceContent,
      save,
      reset: () => replaceContent(structuredClone(defaultContent)),
      undo: () => dispatch({ type: "undo" }),
      redo: () => dispatch({ type: "redo" }),
      canUndo: history.past.length > 0,
      canRedo: history.future.length > 0,
      dirty,
      error,
      clearError: () => setError(""),
    }),
    [history, replaceContent, save, dirty, error],
  );
  return (
    <ContentContext.Provider value={value}>{children}</ContentContext.Provider>
  );
}
export function useContent() {
  const context = useContext(ContentContext);
  if (!context) throw new Error("ContentProvider обязателен");
  return context;
}
export const useSiteContent = useContent;
