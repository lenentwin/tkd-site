import { useLayoutEffect, type RefObject } from "react";
import gsap from "gsap";

export function useHeroIntro(
  root: RefObject<HTMLElement | null>,
  enabled: boolean,
  duration: number,
) {
  useLayoutEffect(() => {
    const element = root.current;
    if (!element || !enabled) return;
    try {
      sessionStorage.setItem("mft39:intro-seen", "1");
    } catch {
      /* Private browser storage may be unavailable; UI stays usable. */
    }
    const context = gsap.context(() => {
      const letters = element.querySelectorAll(".motto-letter");
      const timeline = gsap.timeline();
      const scale = duration / 3;
      timeline
        .fromTo(
          letters,
          { autoAlpha: 0, y: 12 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.35 * scale,
            stagger: { amount: 1.25 * scale },
            ease: "power3.out",
          },
          0.3 * scale,
        )
        .fromTo(
          ".motto-heavy",
          { opacity: 0 },
          { opacity: 1, duration: 0.5 * scale, ease: "power2.inOut" },
          1.9 * scale,
        )
        .fromTo(
          ".motto-light",
          { opacity: 1 },
          { opacity: 0, duration: 0.5 * scale },
          1.9 * scale,
        )
        .fromTo(
          ".hero-type-glow",
          { opacity: 0 },
          { opacity: 1, duration: 0.4 * scale },
          2.4 * scale,
        )
        .fromTo(
          ".hero-main-action",
          { autoAlpha: 0, y: 10 },
          { autoAlpha: 1, y: 0, duration: 0.2 * scale, ease: "power3.out" },
          2.8 * scale,
        );
      const seek = new URLSearchParams(window.location.search).get("introTime");
      if (seek !== null && Number.isFinite(Number(seek)))
        timeline.pause(Math.max(0, Math.min(duration, Number(seek))));
    }, element);
    return () => context.revert();
  }, [root, enabled, duration]);
}
