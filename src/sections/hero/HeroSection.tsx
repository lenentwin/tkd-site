import { Fragment, useRef, useState } from "react";
import { useContent } from "../../app/providers/ContentProvider";
import AccountLink from "../../components/presentation/AccountLink";
import {
  useMediaQuery,
  useMotionPreference,
} from "../../animations/useMotionPreference";
import { useHeroIntro } from "../../animations/useHeroIntro";
import HeroCarousel from "../../scenes/hero-carousel/HeroCarousel";
import Icon from "../../components/presentation/Icon";
import BackgroundGrid from "../../scenes/background-grid/BackgroundGrid";
import { formatDisplayText } from "../../components/presentation/DisplayText";

function seenIntro() {
  if (new URLSearchParams(window.location.search).has("introTime"))
    return false;
  try {
    return sessionStorage.getItem("mft39:intro-seen") === "1";
  } catch {
    return false;
  }
}

export default function HeroSection() {
  const { content } = useContent();
  const root = useRef<HTMLElement>(null);
  const reduced = useMotionPreference();
  const mobile = useMediaQuery("(max-width: 767px)");
  const [alreadySeen] = useState(seenIntro);
  const animate = !mobile && !reduced && content.motion.enabled && !alreadySeen;
  useHeroIntro(root, animate, content.motion.introDuration);
  const section = content.sections.find((item) => item.id === "hero");
  const motto = formatDisplayText(content.brand.motto);
  return (
    <section
      className={`hero-section ${animate ? "has-intro" : ""}`}
      id="hero"
      ref={root}
    >
      <BackgroundGrid />
      <div className="container hero-content">
        <div className="hero-heading">
          <p className="hero-location">
            <span className="status-dot" />
            {section?.intro || "Калининград"}
          </p>
          <h1>{section?.title || content.brand.fullName}</h1>
        </div>
        <div className="hero-stage">
          <div className="hero-copy">
            <p className="hero-motto" aria-label={motto}>
              {motto.split("\n").map((line, row) => (
                <Fragment key={row}>
                  {row > 0 ? <br /> : null}
                  {line.split(" ").map((word, wi) => (
                    <span
                      className="motto-word"
                      aria-hidden="true"
                      key={`${wi}-${word}`}
                    >
                      {Array.from(word).map((letter, li) => (
                        <span className="motto-letter" key={`${li}-${letter}`}>
                          <span className="motto-gold" aria-hidden="true">
                            {letter}
                          </span>
                          <span className="motto-light">{letter}</span>
                          <span className="motto-heavy">{letter}</span>
                        </span>
                      ))}
                      <span className="motto-space"> </span>
                    </span>
                  ))}
                </Fragment>
              ))}
              <span className="hero-type-glow" aria-hidden="true" />
            </p>
            <div className="hero-main-action">
              <AccountLink />
              <p>Группу и расписание обсудим с тренером</p>
            </div>
          </div>
          <HeroCarousel />
        </div>
        <div className="hero-bottom">
          <a href="#locations">
            Залы и условия
            <Icon name="arrow" />
          </a>
          <span>{content.brand.fullName}</span>
          <a href="#achievements">
            Наши победы
            <Icon name="arrow" />
          </a>
        </div>
      </div>
    </section>
  );
}
