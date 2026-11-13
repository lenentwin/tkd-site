import { useEffect, useRef, useState } from "react";
import { useContent } from "../../app/providers/ContentProvider";
import {
  useMediaQuery,
  useMotionPreference,
} from "../../animations/useMotionPreference";
import MediaFrame from "../../components/presentation/MediaFrame";
import Icon from "../../components/presentation/Icon";
import { createHeroController } from "./heroController";

export default function HeroCarousel() {
  const { content } = useContent();
  const items = content.media
    .filter((item) => item.usage === "hero" && item.visible)
    .sort((a, b) => a.order - b.order);
  const root = useRef<HTMLDivElement>(null);
  const controller = useRef<ReturnType<typeof createHeroController> | null>(
    null,
  );
  const [paused, setPaused] = useState(false);
  const mobile = useMediaQuery("(max-width: 767px)");
  const reduced = useMotionPreference();
  const motion = content.motion;
  const ids = items.map((item) => item.id).join(",");
  useEffect(() => {
    if (!root.current) return;
    controller.current = createHeroController({
      root: root.current,
      cards: Array.from(
        root.current.querySelectorAll<HTMLElement>(".hero-card"),
      ),
      settings: motion,
      mobile,
      reduced,
    });
    return () => {
      controller.current?.destroy();
      controller.current = null;
    };
  }, [ids, motion, mobile, reduced]);
  useEffect(() => {
    controller.current?.setPaused(paused);
  }, [paused, ids, motion, mobile, reduced]);

  if (!items.length)
    return (
      <div className="hero-media-empty">
        <p>Фотографии клуба появятся здесь</p>
      </div>
    );
  return (
    <div
      className="hero-carousel-wrap"
      role="region"
      aria-label="Пространственная фотокарусель клуба"
    >
      <div
        className="hero-carousel"
        ref={root}
        data-motion={reduced || !motion.enabled ? "reduced" : "full"}
      >
        <div className="hero-mat-line" aria-hidden="true" />
        {items.map((item, index) => (
          <button
            type="button"
            className="hero-card"
            key={item.id}
            aria-label={`Выбрать кадр: ${item.title}`}
            aria-pressed={index === 0}
            tabIndex={index === 0 ? 0 : -1}
          >
            <MediaFrame item={item} variant={index} eager showLabel={false} />
          </button>
        ))}
      </div>
      <div className="hero-carousel-controls">
        <div className="control-group">
          <button
            className="icon-button"
            type="button"
            aria-label="Повернуть карусель назад"
            onClick={() => controller.current?.advance(-1)}
          >
            <Icon name="left" />
          </button>
          {!reduced && motion.enabled && !mobile ? (
            <button
              className="icon-button"
              type="button"
              aria-label={
                paused
                  ? "Продолжить автоматическое вращение"
                  : "Приостановить автоматическое вращение"
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
            aria-label="Повернуть карусель вперёд"
            onClick={() => controller.current?.advance(1)}
          >
            <Icon name="right" />
          </button>
        </div>
      </div>
    </div>
  );
}
