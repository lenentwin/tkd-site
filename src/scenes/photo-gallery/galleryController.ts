import type { SiteContent } from "../../types/content";

export function createGalleryController(
  root: HTMLElement,
  cards: HTMLElement[],
  settings: SiteContent["motion"],
  reduced: boolean,
  mobile: boolean,
) {
  let phase = -0.3;
  let speed = 0;
  let previousTime = 0;
  let frame = 0;
  let visible = true;
  let paused = false;
  let hovering = false;
  let pointer: {
    id: number;
    x: number;
    y: number;
    time: number;
    startX: number;
    startY: number;
    dragged: boolean;
  } | null = null;
  let suppressClick = false;
  let width = root.clientWidth;
  let active = 0;
  const motionOK = !reduced && settings.enabled;
  const count = cards.length;
  const step = (2 * Math.PI) / Math.max(count, 1);

  function paint() {
    const radius = Math.min(
      settings.radius * 1.35,
      width * (mobile ? 0.6 : 0.4),
    );
    cards.forEach((card, index) => {
      if (!motionOK) {
        const offset = (index - active + count) % Math.max(count, 1);
        const signed = offset > count / 2 ? offset - count : offset;
        card.style.transform = `translate(-50%, -50%) translateX(${signed * Math.min(255, width * 0.62)}px)`;
        card.style.opacity =
          Math.abs(signed) > 1 ? "0" : signed === 0 ? "1" : ".45";
        card.style.zIndex = signed === 0 ? "20" : "1";
        card.style.pointerEvents = Math.abs(signed) > 1 ? "none" : "auto";
        card.tabIndex = signed === 0 ? 0 : -1;
        card.setAttribute(
          "aria-hidden",
          Math.abs(signed) > 1 ? "true" : "false",
        );
        return;
      }
      const angle = phase + index * step;
      const depth = Math.cos(angle);
      // An elliptical contact-sheet orbit differs from the Hero's upright cylindrical arc.
      const x = Math.sin(angle) * radius;
      const y = Math.sin(angle * 2) * 22 - depth * (mobile ? 15 : 35);
      card.style.transform = `translate(-50%, -50%) translate3d(${x}px,${y}px,${depth * 80}px) rotateZ(${Math.sin(angle) * settings.tilt * 1.3}deg) rotateY(${-Math.sin(angle) * settings.tilt * 1.3}deg) scale(${0.86 + (depth + 1) * 0.08})`;
      card.style.opacity = String(0.45 + (depth + 1) * 0.275);
      card.style.zIndex = String(Math.round((depth + 1) * 50));
      card.style.pointerEvents = "auto";
      card.tabIndex = 0;
      card.removeAttribute("aria-hidden");
    });
  }
  function schedule() {
    if (!frame && visible && !document.hidden)
      frame = requestAnimationFrame(tick);
  }
  function tick(time: number) {
    frame = 0;
    const dt = previousTime ? Math.min(32, time - previousTime) : 16.67;
    previousTime = time;
    if (motionOK && !pointer?.dragged) {
      phase += (speed * dt) / 1000;
      speed *= Math.pow(settings.inertia, dt / 16.67);
      if (!paused && !mobile && !hovering)
        phase += (settings.rotateSpeed * 3 * dt) / 1000;
    }
    paint();
    if (
      motionOK &&
      ((!paused && !mobile && !hovering) || Math.abs(speed) > 0.003)
    )
      schedule();
  }
  function down(event: PointerEvent) {
    if (!motionOK) return;
    pointer = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      time: event.timeStamp,
      startX: event.clientX,
      startY: event.clientY,
      dragged: false,
    };
    suppressClick = false;
    speed = 0;
  }
  function move(event: PointerEvent) {
    if (!pointer || pointer.id !== event.pointerId) return;
    const totalX = event.clientX - pointer.startX;
    const totalY = event.clientY - pointer.startY;
    if (
      !pointer.dragged &&
      Math.abs(totalX) > 7 &&
      Math.abs(totalX) > Math.abs(totalY)
    ) {
      pointer.dragged = true;
      root.setPointerCapture(event.pointerId);
      root.classList.add("is-dragging");
    }
    if (pointer.dragged) {
      const change = ((event.clientX - pointer.x) / Math.max(width, 1)) * 3;
      phase += change;
      speed = Math.max(
        -4.5,
        Math.min(
          4.5,
          change / Math.max((event.timeStamp - pointer.time) / 1000, 0.012),
        ),
      );
      suppressClick = true;
      schedule();
    }
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.time = event.timeStamp;
  }
  function up() {
    pointer = null;
    root.classList.remove("is-dragging");
    schedule();
  }
  function click(event: MouseEvent) {
    if (suppressClick) {
      event.preventDefault();
      event.stopPropagation();
      suppressClick = false;
    }
  }
  function enter() {
    hovering = true;
  }
  function leave() {
    hovering = false;
    schedule();
  }
  function visibility() {
    previousTime = 0;
    if (document.hidden) {
      cancelAnimationFrame(frame);
      frame = 0;
    } else schedule();
  }
  const observer = new IntersectionObserver(
    ([entry]) => {
      visible = entry.isIntersecting;
      previousTime = 0;
      if (visible) schedule();
      else {
        cancelAnimationFrame(frame);
        frame = 0;
      }
    },
    { threshold: 0.03 },
  );
  const resize = new ResizeObserver(() => {
    width = root.clientWidth;
    paint();
  });
  observer.observe(root);
  resize.observe(root);
  root.addEventListener("pointerdown", down);
  root.addEventListener("pointermove", move);
  root.addEventListener("pointerup", up);
  root.addEventListener("pointercancel", up);
  root.addEventListener("lostpointercapture", up);
  root.addEventListener("click", click, true);
  root.addEventListener("pointerenter", enter);
  root.addEventListener("pointerleave", leave);
  document.addEventListener("visibilitychange", visibility);
  paint();
  schedule();
  return {
    advance(direction: number) {
      if (motionOK) {
        speed += direction * 1.7;
        schedule();
      } else {
        active = (active + direction + count) % Math.max(count, 1);
        paint();
      }
    },
    pause(value: boolean) {
      paused = value;
      if (value) speed = 0;
      schedule();
    },
    destroy() {
      cancelAnimationFrame(frame);
      observer.disconnect();
      resize.disconnect();
      root.removeEventListener("pointerdown", down);
      root.removeEventListener("pointermove", move);
      root.removeEventListener("pointerup", up);
      root.removeEventListener("pointercancel", up);
      root.removeEventListener("lostpointercapture", up);
      root.removeEventListener("click", click, true);
      root.removeEventListener("pointerenter", enter);
      root.removeEventListener("pointerleave", leave);
      document.removeEventListener("visibilitychange", visibility);
    },
  };
}
