import type { SiteContent } from "../../types/content";
import {
  closestPhaseForIndex,
  easeInOutCubic,
  frontWeight,
  FULL_TURN,
} from "./heroMotion";

type Options = {
  root: HTMLElement;
  cards: HTMLElement[];
  settings: SiteContent["motion"];
  mobile: boolean;
  reduced: boolean;
};
type Pointer = {
  id: number;
  startX: number;
  startY: number;
  x: number;
  time: number;
  dragging: boolean;
  card: number;
};
type Transition = {
  from: number;
  to: number;
  elapsed: number;
  duration: number;
  focusAfter: boolean;
};

export function createHeroController({
  root,
  cards,
  settings,
  mobile,
  reduced,
}: Options) {
  const count = cards.length;
  const step = FULL_TURN / Math.max(1, count);
  const motionOK = !reduced && settings.enabled;
  const dwellDuration = Math.max(2800, 5200 - settings.rotateSpeed * 40000);
  let phase = 0,
    velocity = 0,
    active = 0,
    width = root.clientWidth;
  let publishedActive = -1;
  let frame = 0,
    previousTime = 0,
    floatTime = 0,
    dwellTime = 0;
  let visible = true,
    paused = false,
    focused = false,
    destroyed = false;
  let cursor = 0,
    cursorTarget = 0,
    scrollY = window.scrollY;
  let pointer: Pointer | null = null;
  let transition: Transition | null = null;
  let suppressPointerClickUntil = 0;

  function cardIndex(target: EventTarget | null) {
    const card =
      target instanceof Element
        ? target.closest<HTMLElement>(".hero-card")
        : null;
    return card ? cards.indexOf(card) : -1;
  }
  function paint() {
    const radius = Math.min(
      settings.radius * 1.08,
      width * (mobile ? 0.57 : 0.46),
    );
    let nearest = 0,
      nearestWeight = -1;
    cards.forEach((card, index) => {
      const angle = phase + index * step;
      const weight = motionOK ? frontWeight(angle) : Number(index === active);
      if (weight > nearestWeight) {
        nearestWeight = weight;
        nearest = index;
      }
      if (!motionOK) {
        const offset = (index - active + count) % Math.max(1, count);
        const signed = offset > count / 2 ? offset - count : offset;
        card.style.transform = `translate(-50%,-50%) translateX(${signed * Math.min(245, width * 0.56)}px) scale(${signed ? 0.78 : 1})`;
        card.style.opacity = Math.abs(signed) > 1 ? "0" : signed ? "0.6" : "1";
        card.style.zIndex = signed ? "1" : "100";
        card.style.pointerEvents = Math.abs(signed) > 1 ? "none" : "auto";
      } else {
        const depth = Math.cos(angle);
        const scale = 0.74 + weight * 0.38 + (depth + 1) * 0.025;
        const drift = Math.sin(floatTime * 0.00065 + index * 1.9);
        const floatY = drift * (mobile ? 5 : 10) * (1 - weight * 0.55);
        const floatX =
          Math.cos(floatTime * 0.00043 + index * 1.6) *
          (mobile ? 2 : 5) *
          (1 - weight);
        const x = Math.sin(angle) * radius + floatX;
        const y = -weight * 14 + floatY;
        const z = depth * (mobile ? 40 : 72) + weight * (mobile ? 18 : 42);
        const lean = Math.sin(angle) * 8 + drift * 1.2 * (1 - weight);
        card.style.transform = `translate(-50%,-50%) translate3d(${x}px,${y}px,${z}px) rotateY(${-Math.sin(angle) * 18 + cursor * settings.tilt * 0.65}deg) rotateZ(${lean}deg) scale(${scale})`;
        card.style.opacity = String(0.6 + (depth + 1) * 0.2);
        card.style.zIndex = String(Math.round((depth + 1) * 40 + weight * 40));
        card.style.pointerEvents = "auto";
      }
    });
    if (motionOK) active = nearest;
    if (publishedActive !== active) {
      cards.forEach((card, index) => {
        const selected = index === active;
        card.dataset.active = String(selected);
        card.setAttribute("aria-pressed", String(selected));
        card.tabIndex = selected ? 0 : -1;
      });
      root.dataset.activeIndex = String(active);
      publishedActive = active;
    }
  }
  function schedule() {
    if (!frame && !destroyed && visible && !document.hidden)
      frame = requestAnimationFrame(tick);
  }
  function select(index: number, focusAfter = false) {
    if (!count || index < 0 || index >= count) return;
    dwellTime = 0;
    velocity = 0;
    if (!motionOK) {
      active = index;
      paint();
      if (focusAfter) cards[index].focus({ preventScroll: true });
      return;
    }
    // Interrupted moves start at the last rendered phase, never a stale target.
    transition = {
      from: phase,
      to: closestPhaseForIndex(phase, index, count),
      elapsed: 0,
      duration: Math.max(620, settings.transitionDuration * 2000),
      focusAfter,
    };
    schedule();
  }
  function advance(direction: number, focusAfter = false) {
    select((active + direction + count) % Math.max(1, count), focusAfter);
  }
  function settle() {
    velocity = 0;
    if (count) select(((-Math.round(phase / step) % count) + count) % count);
  }
  function tick(time: number) {
    frame = 0;
    const dt = previousTime ? Math.min(40, time - previousTime) : 16.67;
    previousTime = time;
    if (motionOK) {
      if (!paused && !focused && !pointer?.dragging) floatTime += dt;
      if (transition && !pointer?.dragging) {
        transition.elapsed += dt;
        const progress = Math.min(1, transition.elapsed / transition.duration);
        phase =
          transition.from +
          (transition.to - transition.from) * easeInOutCubic(progress);
        if (progress === 1) {
          const focusAfter = transition.focusAfter;
          transition = null;
          dwellTime = 0;
          paint();
          if (focusAfter) cards[active]?.focus({ preventScroll: true });
        }
      } else if (!pointer?.dragging && Math.abs(velocity) > 0.003) {
        phase += (velocity * dt) / 1000;
        velocity *= Math.pow(settings.inertia, dt / 16.67);
        if (!mobile && Math.abs(velocity) < 0.07) settle();
      } else if (
        !mobile &&
        !paused &&
        !focused &&
        !pointer &&
        settings.rotateSpeed > 0 &&
        count > 1
      ) {
        dwellTime += dt;
        if (dwellTime >= dwellDuration) advance(1);
      }
      const difference = cursorTarget - cursor;
      cursor =
        Math.abs(difference) < 0.001
          ? cursorTarget
          : cursor + difference * (1 - Math.exp(-dt / 140));
    }
    paint();
    if (
      motionOK &&
      ((!mobile && !paused && !focused) ||
        transition ||
        Math.abs(velocity) > 0.003 ||
        Math.abs(cursorTarget - cursor) > 0.001)
    )
      schedule();
  }
  function down(event: PointerEvent) {
    if (
      !motionOK ||
      !event.isPrimary ||
      event.button !== 0 ||
      (mobile && event.pointerType === "touch")
    )
      return;
    const index = cardIndex(event.target);
    if (
      event.target instanceof Element &&
      event.target.closest("a,input,select,textarea,button:not(.hero-card)")
    )
      return;
    pointer = {
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      x: event.clientX,
      time: event.timeStamp,
      dragging: false,
      card: index,
    };
    transition = null;
    velocity = 0;
    dwellTime = 0;
    // Do not let pointer focus scroll a transformed peripheral card into view.
    if (event.pointerType === "mouse") event.preventDefault();
  }
  function move(event: PointerEvent) {
    if (!motionOK || mobile) return;
    if (pointer && event.pointerId === pointer.id) {
      const total = event.clientX - pointer.startX;
      if (
        !pointer.dragging &&
        Math.abs(total) >= 7 &&
        Math.abs(total) > Math.abs(event.clientY - pointer.startY)
      ) {
        pointer.dragging = true;
        root.setPointerCapture(event.pointerId);
        root.classList.add("is-dragging");
      }
      if (pointer.dragging) {
        const delta = ((event.clientX - pointer.x) / Math.max(1, width)) * 2.4;
        phase += delta;
        velocity = Math.max(
          -2.6,
          Math.min(
            2.6,
            delta / Math.max((event.timeStamp - pointer.time) / 1000, 0.016),
          ),
        );
        suppressPointerClickUntil = performance.now() + 400;
        event.preventDefault();
      }
      pointer.x = event.clientX;
      pointer.time = event.timeStamp;
    } else {
      const bounds = root.getBoundingClientRect();
      cursorTarget = Math.max(
        -1,
        Math.min(
          1,
          ((event.clientX - bounds.left) / Math.max(1, bounds.width) - 0.5) * 2,
        ),
      );
    }
    schedule();
  }
  function up(event: PointerEvent) {
    if (!pointer || pointer.id !== event.pointerId) return;
    const released = pointer;
    pointer = null;
    root.classList.remove("is-dragging");
    if (root.hasPointerCapture(event.pointerId))
      root.releasePointerCapture(event.pointerId);
    if (released.dragging) {
      suppressPointerClickUntil = performance.now() + 400;
      schedule();
    } else if (released.card >= 0) {
      suppressPointerClickUntil = performance.now() + 400;
      select(released.card);
    } else schedule();
  }
  function cancel() {
    if (!pointer) return;
    pointer = null;
    root.classList.remove("is-dragging");
    velocity = 0;
    dwellTime = 0;
    schedule();
  }
  function click(event: MouseEvent) {
    if (event.detail > 0 && performance.now() < suppressPointerClickUntil) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    const index = cardIndex(event.target);
    if (index >= 0) {
      event.preventDefault();
      select(index);
    }
  }
  function key(event: KeyboardEvent) {
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      advance(event.key === "ArrowRight" ? 1 : -1, true);
    }
  }
  function drag(event: DragEvent) {
    event.preventDefault();
  }
  function leave() {
    cursorTarget = 0;
    schedule();
  }
  function focusIn() {
    focused = true;
    dwellTime = 0;
    schedule();
  }
  function focusOut(event: FocusEvent) {
    if (
      !(event.relatedTarget instanceof Node) ||
      !root.contains(event.relatedTarget)
    ) {
      focused = false;
      dwellTime = 0;
      schedule();
    }
  }
  function scroll() {
    const next = window.scrollY;
    if (mobile && motionOK && visible) {
      transition = null;
      velocity = Math.max(-2, Math.min(2, (next - scrollY) * 0.012));
      schedule();
    }
    scrollY = next;
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
    schedule();
  });
  observer.observe(root);
  resize.observe(root);
  root.addEventListener("pointerdown", down);
  root.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
  root.addEventListener("pointercancel", cancel);
  root.addEventListener("lostpointercapture", cancel);
  root.addEventListener("click", click, true);
  root.addEventListener("keydown", key);
  root.addEventListener("dragstart", drag);
  root.addEventListener("pointerleave", leave);
  root.addEventListener("focusin", focusIn);
  root.addEventListener("focusout", focusOut);
  window.addEventListener("scroll", scroll, { passive: true });
  document.addEventListener("visibilitychange", visibility);
  paint();
  if (motionOK) schedule();
  return {
    advance,
    select,
    setPaused(value: boolean) {
      paused = value;
      if (value) {
        transition = null;
        velocity = 0;
      }
      dwellTime = 0;
      schedule();
    },
    destroy() {
      destroyed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      resize.disconnect();
      root.removeEventListener("pointerdown", down);
      root.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      root.removeEventListener("pointercancel", cancel);
      root.removeEventListener("lostpointercapture", cancel);
      root.removeEventListener("click", click, true);
      root.removeEventListener("keydown", key);
      root.removeEventListener("dragstart", drag);
      root.removeEventListener("pointerleave", leave);
      root.removeEventListener("focusin", focusIn);
      root.removeEventListener("focusout", focusOut);
      window.removeEventListener("scroll", scroll);
      document.removeEventListener("visibilitychange", visibility);
      root.classList.remove("is-dragging");
    },
  };
}
