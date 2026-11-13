import {
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { Link, useLocation } from "react-router-dom";
import { useContent } from "../../app/providers/ContentProvider";
import { useTheme } from "../../app/providers/ThemeProvider";
import { useAuth } from "../../app/providers/AuthProvider";
import Icon from "./Icon";
import { DisplayText, formatDisplayText } from "./DisplayText";

const navigation = [
  { section: "coach", label: "Тренер" },
  { section: "locations", label: "Залы" },
  { section: "gallery", label: "Галерея" },
  { section: "rutube", label: "RuTube" },
  { section: "reviews", label: "VK и отзывы" },
  { section: "contacts", label: "Контакты" },
] as const;

export default function SiteLayout({ children }: { children: ReactNode }) {
  const { content } = useContent();
  const { theme, toggleTheme } = useTheme();
  const { session } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const closeMenu = () => setMenuOpen(false);
  const visibleNavigation = navigation.filter(({ section }) =>
    content.sections.some((item) => item.id === section && item.enabled) &&
      (import.meta.env.DEV || section !== "gallery" || content.media.some((item) => item.usage === "gallery" && item.visible && item.src && !item.src.startsWith("idb:"))),
  );
  function handleNavigation(
    event: MouseEvent<HTMLAnchorElement>,
    section: string,
  ) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return;
    closeMenu();
    // A repeated click on the current hash must still return to its section.
    if (location.pathname === "/" && location.hash === `#${section}`) {
      event.preventDefault();
      const target = document.getElementById(section);
      // Cancel an unfinished long smooth scroll instead of starting a competing one.
      target?.scrollIntoView({ behavior: "instant", block: "start" });
      if (target) {
        target.tabIndex = -1;
        target.focus({ preventScroll: true });
      }
    }
  }
  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        toggleRef.current?.focus();
      }
    };
    const focusTimer = window.setTimeout(
      () => menuRef.current?.querySelector<HTMLAnchorElement>("a")?.focus(),
      0,
    );
    document.addEventListener("keydown", close);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", close);
    };
  }, [menuOpen]);

  return (
    <>
      <a className="skip-link" href="#main">
        К содержимому
      </a>
      <header className="site-header">
        <div className="header-inner container">
          <Link
            to="/"
            className="brand"
            aria-label={formatDisplayText(`${content.brand.shortName} — на главную`)}
            onClick={closeMenu}
          >
            <span className="brand-word"><DisplayText text={content.brand.shortName} /></span>
            <span className="brand-descriptor"><DisplayText text={content.brand.fullName} /></span>
          </Link>
          <nav className="desktop-nav" aria-label="Основная навигация">
            {visibleNavigation.map(({ section, label }) => {
              const active =
                location.pathname === "/" && location.hash === `#${section}`;
              return (
                <Link
                  key={section}
                  to={`/#${section}`}
                  className={active ? "is-active" : ""}
                  aria-current={active ? "location" : undefined}
                  onClick={(event) => handleNavigation(event, section)}
                >
                  <DisplayText text={label} />
                </Link>
              );
            })}
          </nav>
          <div className="header-actions">
            <button
              className="icon-button theme-toggle"
              type="button"
              onClick={toggleTheme}
              aria-label={
                theme === "dark"
                  ? "Включить светлую тему"
                  : "Включить тёмную тему"
              }
              title={theme === "dark" ? "Светлая тема" : "Тёмная тема"}
            >
              <Icon name={theme === "dark" ? "sun" : "moon"} />
            </button>
            <Link
              className="header-booking"
              to={session ? "/booking" : "/login"}
            >
              Записаться <Icon name="arrow" />
            </Link>
            <button
              ref={toggleRef}
              className="icon-button mobile-menu-toggle"
              type="button"
              aria-label={menuOpen ? "Закрыть меню" : "Открыть меню"}
              aria-controls="mobile-navigation"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <Icon name={menuOpen ? "close" : "menu"} />
            </button>
          </div>
        </div>
        {menuOpen ? (
          <div ref={menuRef} className="mobile-menu" id="mobile-navigation">
            <nav className="container" aria-label="Мобильная навигация">
              <Link to="/" onClick={closeMenu}>
                Главная
              </Link>
              {visibleNavigation.map(({ section, label }) => (
                <Link
                  key={section}
                  to={`/#${section}`}
                  onClick={(event) => handleNavigation(event, section)}
                  aria-current={
                    location.pathname === "/" && location.hash === `#${section}`
                      ? "location"
                      : undefined
                  }
                >
                  <DisplayText text={label} />
                </Link>
              ))}
              <Link
                className="button"
                to={session ? "/booking" : "/login"}
                onClick={closeMenu}
              >
                <DisplayText text={content.brand.bookingLabel} />
              </Link>
            </nav>
          </div>
        ) : null}
      </header>
      <div key={location.pathname} className="site-route">
        {children}
      </div>
      <footer className="site-footer">
        <div className="container footer-inner">
          <Link className="brand-word" to="/">
            <DisplayText text={content.brand.shortName} />
          </Link>
          <p><DisplayText text={content.brand.fullName} /></p>
          <div className="footer-links">
            <Link
              to="/#rutube"
              onClick={(event) => handleNavigation(event, "rutube")}
            >
              RuTube
            </Link>
            <Link
              to="/#reviews"
              onClick={(event) => handleNavigation(event, "reviews")}
            >
              ВКонтакте и отзывы
            </Link>
            {import.meta.env.DEV ? <Link to="/editor">Локальный редактор</Link> : null}
          </div>
          <span className="footer-note">{import.meta.env.DEV ? "Локальный прототип" : "Тхэквондо МФТ · Калининград"}</span>
        </div>
      </footer>
    </>
  );
}
