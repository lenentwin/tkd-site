import { useEffect, useRef } from "react";
import { useContent } from "../../app/providers/ContentProvider";
import {
  useMediaQuery,
  useMotionPreference,
} from "../../animations/useMotionPreference";

export default function BackgroundGrid() {
  const grid = useRef<HTMLDivElement>(null);
  const { content } = useContent();
  const reduced = useMotionPreference();
  const fine = useMediaQuery("(pointer: fine)");
  useEffect(() => {
    const element = grid.current;
    const parent = element?.parentElement;
    if (!element || !parent || reduced || !fine || !content.motion.enabled)
      return;
    let frame = 0;
    let clientX = 0;
    let clientY = 0;
    const update = (event: PointerEvent) => {
      clientX = event.clientX;
      clientY = event.clientY;
      if (!frame)
        frame = requestAnimationFrame(() => {
          const bounds = parent.getBoundingClientRect();
          element.style.setProperty(
            "--pointer-x",
            `${clientX - bounds.left}px`,
          );
          element.style.setProperty("--pointer-y", `${clientY - bounds.top}px`);
          element.style.opacity = String(
            Math.min(0.95, content.theme.gridOpacity * 10),
          );
          frame = 0;
        });
    };
    const leave = () => {
      element.style.opacity = "0";
    };
    parent.addEventListener("pointermove", update);
    parent.addEventListener("pointerenter", update);
    parent.addEventListener("pointerleave", leave);
    return () => {
      cancelAnimationFrame(frame);
      parent.removeEventListener("pointermove", update);
      parent.removeEventListener("pointerenter", update);
      parent.removeEventListener("pointerleave", leave);
    };
  }, [content.motion.enabled, content.theme.gridOpacity, reduced, fine]);
  return <div className="interactive-grid" ref={grid} aria-hidden="true" />;
}
