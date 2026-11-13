import { useState } from "react";
import type { MediaItem } from "../../types/content";
import { useMediaSource } from "../../hooks/useMediaSource";
import { storeMediaFile } from "../persistence/mediaStorage";

export function MediaControls({
  item,
  onSource,
}: {
  item: MediaItem;
  onSource: (src: string) => void;
}) {
  const src = useMediaSource(item.src);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="editor-media-controls">
      <div
        className="editor-media-preview"
        style={{ aspectRatio: item.aspectRatio === "1:1" ? "1" : "1/2" }}
      >
        {src ? (
          <img
            src={src}
            alt={item.alt}
            style={{
              objectPosition: `${item.focalPoint.x}% ${item.focalPoint.y}%`,
            }}
          />
        ) : (
          <span>
            {item.title}
            <small>Изображение ещё не добавлено</small>
          </span>
        )}
        <span
          className="editor-focus-dot"
          aria-hidden="true"
          style={{
            left: `${item.focalPoint.x}%`,
            top: `${item.focalPoint.y}%`,
          }}
        />
      </div>
      <label className="editor-file-button">
        {busy ? "Сохраняем…" : "Выбрать изображение"}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            setBusy(true);
            setError("");
            void storeMediaFile(file)
              .then(onSource)
              .catch((error: unknown) =>
                setError(
                  error instanceof Error ? error.message : "Ошибка загрузки",
                ),
              )
              .finally(() => setBusy(false));
            event.target.value = "";
          }}
        />
      </label>
      <p className="editor-help">
        JPG, PNG, WebP, AVIF до 8 МБ. Файл хранится только в этом браузере. Для
        переноса используйте экспорт с изображениями.
      </p>
      {item.src && (
        <button
          type="button"
          className="editor-small-button"
          onClick={() => onSource("")}
        >
          Убрать изображение
        </button>
      )}
      {error && (
        <p role="alert" className="editor-error">
          {error}
        </p>
      )}
    </div>
  );
}
