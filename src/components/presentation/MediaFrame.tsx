import { useState } from "react";
import { useMediaSource } from "../../hooks/useMediaSource";
import type { MediaItem } from "../../types/content";
import { DisplayText, formatDisplayText } from "./DisplayText";

type Props = {
  item?: MediaItem;
  variant?: number;
  className?: string;
  eager?: boolean;
  showLabel?: boolean;
};

export default function MediaFrame({
  item,
  variant = 0,
  className = "",
  eager = false,
  showLabel = true,
}: Props) {
  const src = useMediaSource(item?.src ?? "");
  const [failedSource, setFailedSource] = useState("");
  const hasImage = Boolean(src && failedSource !== src);
  const title = item?.title || "Фотография клуба";
  return (
    <div
      className={`media-frame media-tone-${variant % 5} ${item?.aspectRatio === "1:1" ? "ratio-square" : "ratio-portrait"} ${className}`}
    >
      {hasImage ? (
        <img
          src={src}
          alt={formatDisplayText(item?.alt || title)}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          draggable={false}
          style={{
            objectPosition: `${item?.focalPoint.x ?? 50}% ${item?.focalPoint.y ?? 50}%`,
          }}
          onError={() => setFailedSource(src)}
        />
      ) : (
        <div
          className="media-placeholder"
          role="img"
          aria-label={formatDisplayText(import.meta.env.DEV ? `Композиционная заглушка: ${title}. Реальная фотография пока не добавлена.` : `Фирменная иллюстрация тхэквондо: ${title}`)}
        >
          <svg
            className="placeholder-art"
            viewBox="0 0 320 500"
            preserveAspectRatio="xMidYMid slice"
            aria-hidden="true"
          >
            <path className="mat-plane" d="M-60 375 190 205 430 330 170 550Z" />
            <path
              className="mat-boundary"
              d="m-55 405 245-169 220 112M-50 453l244-169 218 113"
            />
            <path className="belt-back" d="M-55 47 376 299l-34 66L-88 112Z" />
            <path className="belt-face" d="M-55 38 376 290l-34 54L-88 94Z" />
            <path className="belt-seam" d="m-48 52 410 240m-420-218 410 240" />
            <path className="belt-end" d="m221 220 50 30-73 173-55-35Z" />
            <path className="belt-edge" d="m191 375 23 13m-30 3 24 13" />
          </svg>
          <span className="placeholder-category">
            <DisplayText text={item?.category || "Тхэквондо МФТ"} />
          </span>
          <span className="placeholder-caption">
            {import.meta.env.DEV ? <>Место для<br />фотографии</> : <>Тхэквондо<br />МФТ</>}
          </span>
        </div>
      )}
      {showLabel ? <span className="media-caption"><DisplayText text={title} /></span> : null}
    </div>
  );
}
