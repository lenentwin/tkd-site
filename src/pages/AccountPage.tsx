import { useEffect, useRef, useState } from "react";
import { Link, Navigate, NavLink, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import gsap from "gsap";
import { useAuth } from "../app/providers/AuthProvider";
import { useContent } from "../app/providers/ContentProvider";
import { useMotionPreference } from "../animations/useMotionPreference";
import { yandexAuthEnabled } from "../services/backend";
import BookingPage from "./BookingPage";
import ProfilePage, { roleLabels } from "./account/ProfilePage";
import Icon from "../components/presentation/Icon";
import { DisplayText } from "../components/presentation/DisplayText";
import "./account/account.css";
import { ClubProvider, useClub } from "./account/club/ClubProvider";
import ParentTrainings from "./account/club/ParentTrainings";
import TrainerPage from "./account/club/TrainerPage";
import DevicesPage from "./account/club/DevicesPage";
import { usePwa } from "../pwa/runtime";

const items = [
  { to: "/account", label: "Главная" }, { to: "/account/bookings", label: "Мои тренировки" },
  { to: "/account/book", label: "Записаться на тренировку" }, { to: "/account/profile", label: "Мои данные" },
];
function Overview() {
  const { content } = useContent();
  const club = useClub();
  const halls = club.data ? club.data.halls.filter(hall => hall.active) : content.locations;
  return <>
    <div className="cabinet-welcome"><p className="eyebrow">Добро пожаловать в MFT39</p><h1>Тренироваться.<br />Становиться сильнее.</h1>
      <p>Всё, что связано с вашими занятиями и занятиями детей, будет здесь. Выберите нужный раздел.</p></div>
    <div className="cabinet-links">
      <Link to="/account/book"><span>Первая или следующая тренировка</span><h2>Записаться на тренировку</h2><p>{club.data ? "Выберите зал и отправьте заявку. Тренер примет решение в кабинете." : "Выберите зал и подготовьте данные ученика. Проверяем подключение сервиса."}</p><Icon name="arrow" /></Link>
      <Link to="/account/bookings"><span>Ваши занятия</span><h2>Мои тренировки</h2><p>Заявки, статусы учеников и история ежемесячных отметок оплаты.</p><Icon name="arrow" /></Link>
    </div>
    <section className="cabinet-halls" aria-labelledby="cabinet-halls-title"><div className="cabinet-section-heading"><h2 id="cabinet-halls-title">Залы клуба</h2><Link className="text-link" to="/contacts#map">Адреса и маршруты <Icon name="arrow" /></Link></div>
      {halls.map(location => <article key={location.id}><div><h3><DisplayText text={location.name} /></h3><p><DisplayText text={location.address} /></p></div><Link className="text-link" to={`/account/book?location=${encodeURIComponent(location.id)}`}>Выбрать зал <Icon name="arrow" /></Link></article>)}
    </section>
  </>;
}
function Trainings() {
  return <ParentTrainings />;
}
export default function AccountPage() {
  const { online } = usePwa();
  const { session, signOut, loading, unavailable, blocked, refresh } = useAuth();
  const [error, setError] = useState(""); const [signingOut, setSigningOut] = useState(false);
  const navigate = useNavigate(); const { pathname } = useLocation(); const reduced = useMotionPreference();
  const body = useRef<HTMLDivElement>(null);
  const authenticated = !!session;
  useEffect(() => { if (yandexAuthEnabled) void refresh(); }, [pathname, refresh]);
  useEffect(() => {
    if (!body.current) return;
    const context = gsap.context(() => {
      gsap.fromTo(body.current, { opacity: 0, y: reduced ? 0 : 10 }, { opacity: 1, y: 0, duration: reduced ? 0.15 : 0.35, ease: "power2.out", clearProps: "opacity,transform" });
    }, body);
    return () => context.revert();
  }, [pathname, reduced, authenticated, loading, unavailable, online]);
  if (!online) return <main id="main" className="page-shell container cabinet-state"><h1>Для кабинета нужен интернет</h1><p role="status">Подключение отсутствует. Данные учеников, заявки и оплаты не сохраняются для офлайн-доступа. После подключения проверим сессию и загрузим свежие данные.</p><Link className="button-secondary" to="/">Информация о клубе</Link></main>;
  if (blocked) return <main id="main" className="page-shell container cabinet-state"><h1>Доступ к аккаунту ограничен</h1><p>Свяжитесь с администратором клуба для уточнения причины.</p><Link className="button-secondary" to="/contacts">Контакты клуба</Link></main>;
  if (loading) return <main id="main" className="page-shell container cabinet-state"><h1>Личный кабинет</h1><p role="status">Проверяем серверную сессию…</p></main>;
  if (unavailable) return <main id="main" className="page-shell container cabinet-state"><h1>Не удалось проверить вход</h1><p role="status">Сервис временно недоступен. Попробуйте ещё раз.</p><button className="button" onClick={() => void refresh()}>Повторить проверку</button><Link className="text-link" to="/contacts">Связаться с тренером</Link></main>;
  if (!session) return <Navigate to="/login" replace />;
  async function leave() {
    setSigningOut(true); setError("");
    try { await signOut(); navigate("/login", { replace: true }); }
    catch { setError("Не удалось завершить сессию. Проверьте подключение и повторите выход."); }
    finally { setSigningOut(false); }
  }
  const staff = session.mode === "server" && session.role !== "user";
  const navigation = staff ? [...items, { to: "/account/trainer", label: "Ученики и заявки" }] : items;
  return <ClubProvider><main id="main" className="container cabinet page-shell">
    <aside className="cabinet-sidebar"><div className="cabinet-identity"><span className="cabinet-mark" aria-hidden="true">МФТ</span><div><strong>{session.displayName}</strong><span>{session.mode === "server" ? "Вход через Яндекс ID" : "Локальная демонстрация"}</span></div></div>
      {staff && <p className="cabinet-small">{roleLabels[session.role]} · ID {session.id}</p>}
      {session.mode === "server" && session.role === "admin" && <Link className="button-secondary" to="/admin">Административная панель</Link>}
      <nav aria-label="Разделы личного кабинета">{navigation.map(item => <NavLink key={item.to} to={item.to} end={item.to === "/account"} className={({ isActive }) => isActive ? "is-current" : ""}>{item.label}<Icon name="arrow" /></NavLink>)}</nav>
      <button className="cabinet-logout" onClick={() => void leave()} disabled={signingOut}>{signingOut ? "Завершаем сессию…" : "Выход из аккаунта"}<Icon name="external" /></button>
      {error && <p role="alert" className="cabinet-error">{error}</p>}
    </aside>
    <div className="cabinet-content" ref={body}><Routes>
      <Route index element={<Overview />} /><Route path="bookings" element={<Trainings />} />
      <Route path="book" element={<BookingPage />} /><Route path="profile" element={<ProfilePage />} />
      <Route path="trainer" element={<TrainerPage />} /><Route path="devices" element={<DevicesPage />} />
      <Route path="*" element={<><h1>Раздел не найден</h1><Link to="/account" className="button">На главную кабинета</Link></>} />
    </Routes></div>
  </main></ClubProvider>;
}
