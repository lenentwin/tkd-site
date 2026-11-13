import { useEffect, useRef, useState } from "react";
import type { SiteContent } from "../../types/content";

const widths = { Desktop: 1280, Tablet: 768, Mobile: 390 };
export function Preview({ content }: { content: SiteContent }) {
  const [mode, setMode] = useState<keyof typeof widths>("Desktop");
  const [available, setAvailable] = useState(600);
  const [ready, setReady] = useState(0);
  const host = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    const node = host.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) =>
      setAvailable(entry.contentRect.width),
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    frame.current?.contentWindow?.postMessage(
      { type: "mft39-preview", content },
      window.location.origin,
    );
  }, [content, ready]);
  const width = widths[mode];
  const scale = Math.min(1, available / width);
  return (
    <section className="editor-preview">
      <div className="editor-panel-heading">
        <h2>Предпросмотр</h2>
        <a href="/" target="_blank" rel="noreferrer">
          Открыть сайт
        </a>
      </div>
      <div className="editor-preview-modes" aria-label="Размер предпросмотра">
        {Object.keys(widths).map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={mode === key}
            onClick={() => setMode(key as keyof typeof widths)}
          >
            {key}
          </button>
        ))}
      </div>
      <div
        className="editor-preview-host"
        ref={host}
        style={{ height: 780 * scale, background: "#101113" }}
      >
        <iframe
          key={mode}
          ref={frame}
          title={`Предпросмотр ${mode}`}
          src="/?editorPreview=1"
          onLoad={() => setReady((value) => value + 1)}
          style={{
            position: "absolute",
            left: Math.max(0, (available - width * scale) / 2),
            width,
            height: 780,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        />
      </div>
      <p className="editor-help">
        {width} px. Предпросмотр отражает несохранённые изменения. Карты и видео
        открываются только по действию посетителя.
      </p>
    </section>
  );
}
