import {
  Component,
  Suspense,
  lazy,
  useEffect,
  type ErrorInfo,
  type ReactNode,
} from "react";
import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import SiteLayout from "../components/presentation/SiteLayout";
import HomePage from "../pages/HomePage";
import CoachPage from "../pages/CoachPage";
import AchievementsPage from "../pages/AchievementsPage";
import ContactsPage from "../pages/ContactsPage";
import RutubePage from "../pages/RutubePage";
import VkPage from "../pages/VkPage";
import ServiceUnavailablePage from "../pages/ServiceUnavailablePage";
import { useContent } from "./providers/ContentProvider";

const EditorPage = import.meta.env.DEV ? lazy(() => import("../editor/EditorPage")) : null;
const LoginPage = import.meta.env.DEV ? lazy(() => import("../pages/LoginPage")) : ServiceUnavailablePage;
const AccountPage = import.meta.env.DEV ? lazy(() => import("../pages/AccountPage")) : ServiceUnavailablePage;
const BookingPage = import.meta.env.DEV ? lazy(() => import("../pages/BookingPage")) : ServiceUnavailablePage;

class AppBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) console.error("MFT39 interface error", error.message, info.componentStack);
  }
  render() {
    return this.state.failed ? (
      <main className="container page-shell">
        <h1>Не удалось открыть интерфейс</h1>
        <p>
          Обновите страницу. Если ошибка повторится после импорта, проверьте
          конфигурацию в редакторе.
        </p>
        <a href="/">Обновить главную</a>
      </main>
    ) : (
      this.props.children
    );
  }
}
function RouteEffects() {
  const { pathname, hash } = useLocation();
  const { content } = useContent();
  useEffect(() => {
    const meta = content.pages[pathname];
    const robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (robots) robots.content = import.meta.env.DEV || ["/editor", "/login", "/account", "/booking"].includes(pathname) ? "noindex,nofollow" : "index,follow";
    document.title =
      meta?.title ?? `Страница не найдена — ${content.brand.shortName}`;
    const description = document.querySelector<HTMLMetaElement>(
      'meta[name="description"]',
    );
    if (description)
      description.content = meta?.description ?? content.brand.description;
    const ogTitle = document.querySelector<HTMLMetaElement>(
      'meta[property="og:title"]',
    );
    const ogDescription = document.querySelector<HTMLMetaElement>(
      'meta[property="og:description"]',
    );
    if (ogTitle) ogTitle.content = document.title;
    if (ogDescription)
      ogDescription.content = meta?.description ?? content.brand.description;
  }, [content.pages, content.brand, pathname]);
  useEffect(() => {
    if (hash) {
      const timer = setTimeout(() => {
        const target = document.getElementById(hash.slice(1));
        if (target) {
          target.scrollIntoView({ behavior: "auto" });
          target.tabIndex = -1;
          target.focus({ preventScroll: true });
        }
      }, 80);
      return () => clearTimeout(timer);
    }
    window.scrollTo({ top: 0, behavior: "instant" });
    const main = document.getElementById("main");
    if (main) {
      main.tabIndex = -1;
      main.focus({ preventScroll: true });
    }
  }, [pathname, hash]);
  return null;
}
export default function App() {
  const { pathname } = useLocation();
  return (
    <AppBoundary>
      <RouteEffects />
      {pathname === "/editor" && EditorPage ? (
        <Suspense
          fallback={
            <main className="page-shell container">
              <p role="status">Открываем редактор…</p>
            </main>
          }
        >
          <EditorPage />
        </Suspense>
      ) : (
        <SiteLayout>
          <Suspense fallback={<main className="page-shell container"><p role="status">Загрузка…</p></main>}><Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/coach" element={<CoachPage />} />
            <Route path="/achievements" element={<AchievementsPage />} />
            <Route path="/contacts" element={<ContactsPage />} />
            <Route path="/rutube" element={<RutubePage />} />
            <Route path="/vk" element={<VkPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/account" element={<AccountPage />} />
            <Route path="/booking" element={<BookingPage />} />
            <Route
              path="/gallery"
              element={<Navigate to="/#gallery" replace />}
            />
            <Route
              path="*"
              element={
                <main id="main" className="container page-shell">
                  <h1>Страница не найдена</h1>
                  <p>Вернитесь к информации о клубе.</p>
                  <Link to="/" className="button">
                    На главную
                  </Link>
                </main>
              }
            />
          </Routes></Suspense>
        </SiteLayout>
      )}
    </AppBoundary>
  );
}
