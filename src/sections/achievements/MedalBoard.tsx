import { useEffect, useRef } from "react";
import gsap from "gsap";
import { useContent } from "../../app/providers/ContentProvider";
import { useMotionPreference } from "../../animations/useMotionPreference";
import { DisplayText } from "../../components/presentation/DisplayText";

export default function MedalBoard() {
  const { content } = useContent();
  const root = useRef<HTMLDivElement>(null);
  const reduced = useMotionPreference();
  const { gold, silver, bronze, note } = content.medals;
  const total = gold + silver + bronze;
  const medals = [
    { id: "gold", label: "Золотых", count: gold },
    { id: "silver", label: "Серебряных", count: silver },
    { id: "bronze", label: "Бронзовых", count: bronze },
  ];
  useEffect(() => {
    const element = root.current;
    if (!element || reduced || !content.motion.enabled) return;
    let played = false;
    const context = gsap.context(() => {}, element);
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || played) return;
        played = true;
        context.add(() => {
          element
            .querySelectorAll<HTMLElement>("[data-medal-count]")
            .forEach((number, index) => {
              const value = { number: 0 };
              gsap.to(value, {
                number: Number(number.dataset.medalCount),
                duration: 1.2,
                delay: index * 0.1,
                ease: "power2.out",
                onUpdate: () => {
                  number.textContent = String(Math.round(value.number));
                },
              });
            });
        });
        observer.disconnect();
      },
      { threshold: 0.25 },
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
      context.revert();
    };
  }, [gold, silver, bronze, reduced, content.motion.enabled]);
  return (
    <div className="medal-board" ref={root}>
      <div className="medal-numbers">
        {medals.map((medal) => (
          <div key={medal.id} className={`medal-stat medal-${medal.id}`}>
            <span
              className="medal-count"
              aria-label={`${medal.count} ${medal.label.toLowerCase()} медалей`}
            >
              <span aria-hidden="true" data-medal-count={medal.count}>
                {medal.count}
              </span>
            </span>
            <div className="medal-label">
              <span className="medal-disc" aria-hidden="true" />
              <span>{medal.label}</span>
              <span>
                {total ? Math.round((medal.count / total) * 100) : 0}%
              </span>
            </div>
          </div>
        ))}
      </div>
      <div
        className="medal-distribution"
        role="img"
        aria-label={`Распределение ${total} медалей: ${gold} золотых, ${silver} серебряных, ${bronze} бронзовых`}
      >
        {medals.map((medal) => (
          <span
            key={medal.id}
            className={`medal-bar medal-${medal.id}`}
            style={{ flexGrow: medal.count || 0.0001 }}
          />
        ))}
      </div>
      <div className="medal-footnote">
        <p><DisplayText text={note} /></p>
        <p>
          <strong>{total}</strong> медали
        </p>
      </div>
    </div>
  );
}
