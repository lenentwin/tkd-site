import { useCallback, useEffect, useRef, useState } from "react";
import { useContent } from "../../app/providers/ContentProvider";
import { SectionHeading } from "../../components/presentation/SectionHeading";
import MediaFrame from "../../components/presentation/MediaFrame";
import Icon from "../../components/presentation/Icon";
import {
  useMediaQuery,
  useMotionPreference,
} from "../../animations/useMotionPreference";
import { createGalleryController } from "../../scenes/photo-gallery/galleryController";
import PhotoViewer from "../../scenes/photo-gallery/PhotoViewer";
import { formatDisplayText } from "../../components/presentation/DisplayText";

export default function GallerySection() {
  const { content } = useContent();
  const section = content.sections.find((item) => item.id === "gallery");
  const items = content.media
    .filter((item) => item.usage === "gallery" && item.visible && (import.meta.env.DEV || (item.src && !item.src.startsWith("idb:"))))
    .sort((a, b) => a.order - b.order);
  const root = useRef<HTMLDivElement>(null);
  const controller = useRef<ReturnType<typeof createGalleryController> | null>(
    null,
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [origin, setOrigin] = useState<DOMRect | null>(null);
  const [paused, setPaused] = useState(false);
  const reduced = useMotionPreference();
  const mobile = useMediaQuery("(max-width: 767px)");
  const ids = items.map((item) => item.id).join(",");
  const motion = content.motion;
  useEffect(() => {
    if (!root.current) return;
    controller.current = createGalleryController(
      root.current,
      Array.from(root.current.querySelectorAll<HTMLElement>(".gallery-photo")),
      motion,
      reduced,
      mobile,
    );
    return () => {
      controller.current?.destroy();
      controller.current = null;
    };
  }, [ids, motion, reduced, mobile]);
  useEffect(() => {
    controller.current?.pause(paused || selectedId !== null);
  }, [paused, selectedId, ids, motion, reduced, mobile]);
  const close = useCallback(() => setSelectedId(null), []);
  const selectedIndex = items.findIndex((item) => item.id === selectedId);
  const selected = items[selectedIndex];
  function change(direction: number) {
    const next = (selectedIndex + direction + items.length) % items.length;
    setSelectedId(items[next].id);
  }
  if (import.meta.env.PROD && !items.length) return null;
  return (
    <section id="gallery" className="gallery-section section-space">
      <div className="container">
        <SectionHeading
          title={section?.title || "Галерея"}
          intro={section?.intro}
          aside={
            <span className="section-note">
              {items.length} кадров в пространстве
            </span>
          }
        />
      </div>
      {items.length ? (
        <>
          <div
            className="gallery-orbit"
            ref={root}
            data-motion={reduced || !motion.enabled ? "reduced" : "full"}
            role="region"
            aria-label="Интерактивная фотогалерея"
          >
            <div className="gallery-orbit-track" aria-hidden="true" />
            {items.map((item, index) => (
              <button
                className="gallery-photo"
                type="button"
                key={item.id}
                aria-label={formatDisplayText(`Открыть фотографию: ${item.title}`)}
                onClick={(event) => {
                  setOrigin(event.currentTarget.getBoundingClientRect());
                  setSelectedId(item.id);
                }}
              >
                <MediaFrame item={item} variant={index + 2} />
                <span className="gallery-open" aria-hidden="true">
                  <Icon name="plus" />
                </span>
              </button>
            ))}
          </div>
          <div className="container gallery-bottom">
            <p>
              {mobile
                ? "Листайте в сторону или выберите кадр"
                : "Перетаскивайте. Выберите кадр, чтобы открыть."}
            </p>
            <div className="control-group">
              <button
                className="icon-button"
                type="button"
                aria-label="Повернуть галерею назад"
                onClick={() => controller.current?.advance(-1)}
              >
                <Icon name="left" />
              </button>
              {!mobile && !reduced && motion.enabled ? (
                <button
                  className="icon-button"
                  type="button"
                  aria-label={
                    paused
                      ? "Продолжить движение галереи"
                      : "Остановить движение галереи"
                  }
                  aria-pressed={paused}
                  onClick={() => setPaused(!paused)}
                >
                  <Icon name={paused ? "play" : "pause"} />
                </button>
              ) : null}
              <button
                className="icon-button"
                type="button"
                aria-label="Повернуть галерею вперёд"
                onClick={() => controller.current?.advance(1)}
              >
                <Icon name="right" />
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="container empty-state">
          <p>Фотографии пока не добавлены.</p>
        </div>
      )}
      {selected ? (
        <PhotoViewer
          item={selected}
          origin={origin}
          onClose={close}
          onChange={change}
          index={selectedIndex}
          count={items.length}
        />
      ) : null}
    </section>
  );
}
