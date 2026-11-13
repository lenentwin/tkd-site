import { useEffect, useRef } from "react";
import type { MediaItem } from "../../types/content";
import { useMotionPreference } from "../../animations/useMotionPreference";
import { useContent } from "../../app/providers/ContentProvider";
import MediaFrame from "../../components/presentation/MediaFrame";
import Icon from "../../components/presentation/Icon";
import { DisplayText } from "../../components/presentation/DisplayText";

type Props = {
  item: MediaItem;
  origin: DOMRect | null;
  onClose: () => void;
  onChange: (direction: number) => void;
  index: number;
  count: number;
};

export default function PhotoViewer({
  item,
  origin,
  onClose,
  onChange,
  index,
  count,
}: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const picture = useRef<HTMLDivElement>(null);
  const closing = useRef(false);
  const preference = useMotionPreference();
  const { content } = useContent();
  const reduced = preference || !content.motion.enabled;
  const transition = content.motion.transitionDuration;
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    element.showModal();
    document.body.style.overflow = "hidden";
    const media = picture.current;
    if (media && origin && !reduced) {
      const destination = media.getBoundingClientRect();
      media.animate(
        [
          {
            transform: `translate(${origin.left - destination.left}px, ${origin.top - destination.top}px) scale(${origin.width / destination.width}, ${origin.height / destination.height})`,
            opacity: 0.45,
          },
          { transform: "none", opacity: 1 },
        ],
        { duration: transition * 1000, easing: "cubic-bezier(.16,1,.3,1)" },
      );
    }
    return () => {
      element.close();
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus({ preventScroll: true });
    };
    // The opening origin belongs to the first selected photo, not next/previous navigation.
  }, [onClose, origin, reduced, transition]);

  function close() {
    if (closing.current) return;
    closing.current = true;
    const element = picture.current;
    if (element && origin && !reduced) {
      const bounds = element.getBoundingClientRect();
      const animation = element.animate(
        [
          { transform: "none", opacity: 1 },
          {
            transform: `translate(${origin.left - bounds.left}px, ${origin.top - bounds.top}px) scale(${origin.width / bounds.width}, ${origin.height / bounds.height})`,
            opacity: 0,
          },
        ],
        {
          duration: transition * 600,
          easing: "cubic-bezier(.7,0,.84,0)",
          fill: "forwards",
        },
      );
      animation.finished.then(onClose).catch(onClose);
    } else onClose();
  }

  return (
    <dialog
      className="photo-viewer"
      ref={dialog}
      aria-labelledby="photo-title"
      aria-describedby="photo-description"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
      onKeyDown={(event) => {
        if (event.key === "ArrowRight") {
          event.preventDefault();
          onChange(1);
        }
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          onChange(-1);
        }
      }}
    >
      <div className="photo-viewer-inner">
        <div className="photo-viewer-top">
          <span>Галерея клуба</span>
          <button
            type="button"
            className="icon-button"
            onClick={close}
            aria-label="Закрыть фотографию"
            autoFocus
          >
            <Icon name="close" />
          </button>
        </div>
        <div className="photo-viewer-media" ref={picture}>
          <MediaFrame item={item} variant={index} showLabel={false} eager />
        </div>
        <div className="photo-viewer-bottom">
          <div>
            <p id="photo-description"><DisplayText text={item.category} /></p>
            <h2 id="photo-title"><DisplayText text={item.title} /></h2>
          </div>
          <div className="control-group">
            <span className="photo-counter">
              {index + 1} / {count}
            </span>
            <button
              type="button"
              className="icon-button"
              aria-label="Предыдущая фотография"
              onClick={() => onChange(-1)}
            >
              <Icon name="left" />
            </button>
            <button
              type="button"
              className="icon-button"
              aria-label="Следующая фотография"
              onClick={() => onChange(1)}
            >
              <Icon name="right" />
            </button>
          </div>
        </div>
      </div>
    </dialog>
  );
}
