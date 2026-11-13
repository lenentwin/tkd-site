import { useEffect, useRef, useState } from "react";
import { Link, Navigate, NavLink, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import gsap from "gsap";
import { useAuth } from "../app/providers/AuthProvider";
import { useContent } from "../app/providers/ContentProvider";
import { useMotionPreference } from "../animations/useMotionPreference";
import { yandexAuthEnabled } from "../services/backend";
import BookingPage from "./BookingPage";
import Icon from "../components/presentation/Icon";
import { DisplayText } from "../components/presentation/DisplayText";
import "./account/account.css";

const items = [
  { to: "/account", label: "Главная" }, { to: "/account/bookings", label: "Мои тренировки" },
  { to: "/account/book", label: "Записаться на тренировку" }, { to: "/account/profile", label: "Мои данные" },
];
function Overview() {
  const { content } = useContent();
  return <>
    <div className="cabinet-welcome"><p className="eyebrow">Добро пожаловать в MFT39</p><h1>Тренироваться.<br />Становиться сильнее.</h1>
      <p>Всё, что связано с вашими занятиями и занятиями детей, будет здесь. Выберите нужный раздел.</p></div>
    <div className="cabinet-links">
      <Link to="/account/book"><span>Первая или следующая тренировка</span><h2>Записаться на тренировку</h2><p>Выберите зал и подготовьте данные ученика. Онлайн-отправка пока недоступна.</p><Icon name="arrow" /></Link>
      <Link to="/account/bookings"><span>Ваши занятия</span><h2>Мои тренировки</h2><p>Расписание и история станут доступны после подключения сервиса тренировок.</p><Icon name="arrow" /></Link>
    </div>
    <section className="cabinet-halls" aria-labelledby="cabinet-halls-title"><div className="cabinet-section-heading"><h2 id="cabinet-halls-title">Залы клуба</h2><Link className="text-link" to="/contacts#map">Адреса и маршруты <Icon name="arrow" /></Link></div>
      {content.locations.map(location => <article key={location.id}><div><h3><DisplayText text={location.name} /></h3><p><DisplayText text={location.address} /></p></div><Link className="text-link" to={`/account/book?location=${encodeURIComponent(location.id)}`}>Выбрать зал <Icon name="arrow" /></Link></article>)}
    </section>
  </>;
}
function Trainings() {
  return <><p className="eyebrow">Личный кабинет</p><h1>Мои тренировки</h1><section className="cabinet-empty"><span className="cabinet-symbol" aria-hidden="true"><Icon name="pause" /></span><h2>Расписание пока недоступно</h2><p>Сервис тренировок ещё не подключён. Поэтому здесь пока нет сведений о ваших занятиях. Дату и время тренировки можно уточнить у тренера.</p><Link className="button" to="/contacts">Связаться с тренером <Icon name="arrow" /></Link></section></>;
}
function Profile() {
  const { session } = useAuth();
  if (!session) return null;
  const roles = { user: "Пользователь", trainer: "Тренер", head_trainer: "Главный тренер" };
  return <><p className="eyebrow">Личный кабинет</p><h1>Мои данные</h1><p className="cabinet-intro">Аккаунт принадлежит вам. Ученик, которого вы записываете, может быть вашим ребёнком.</p>
    <dl className="cabinet-profile"><div><dt>Способ входа</dt><dd>{session.mode === "server" ? "Яндекс ID" : "Локальная демонстрация"}</dd></div>
      {session.mode === "server" && <><div><dt>Номер аккаунта MFT39</dt><dd>{session.id}</dd></div><div><dt>Роль</dt><dd>{roles[session.role]}</dd></div></>}
    </dl><div className="cabinet-notice"><h2>Без лишних данных</h2><p>ФИО, возраст и телефон из Яндекса не запрашиваются. Профили учеников и редактирование личных данных пока не подключены.</p></div>
  </>;
}
export default function AccountPage() {
  const { session, signOut, loading, unavailable, refresh } = useAuth();
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
  }, [pathname, reduced, authenticated, loading, unavailable]);
  if (loading) return <main id="main" className="page-shell container cabinet-state"><h1>Личный кабинет</h1><p role="status">Проверяем серверную сессию…</p></main>;
  if (unavailable) return <main id="main" className="page-shell container cabinet-state"><h1>Не удалось проверить вход</h1><p role="status">Сервис временно недоступен. Попробуйте ещё раз.</p><button className="button" onClick={() => void refresh()}>Повторить проверку</button><Link className="text-link" to="/contacts">Связаться с тренером</Link></main>;
  if (!session) return <Navigate to="/login" replace />;
  async function leave() {
    setSigningOut(true); setError("");
    try { await signOut(); navigate("/login", { replace: true }); }
    catch { setError("Не удалось завершить сессию. Проверьте подключение и повторите выход."); }
    finally { setSigningOut(false); }
  }
  return <main id="main" className="container cabinet page-shell">
    <aside className="cabinet-sidebar"><div className="cabinet-identity"><span className="cabinet-mark" aria-hidden="true">МФТ</span><div><strong>Личный кабинет</strong><span>{session.mode === "server" ? "Вход через Яндекс ID" : "Локальная демонстрация"}</span></div></div>
      <nav aria-label="Разделы личного кабинета">{items.map(item => <NavLink key={item.to} to={item.to} end={item.to === "/account"} className={({ isActive }) => isActive ? "is-current" : ""}>{item.label}<Icon name="arrow" /></NavLink>)}</nav>
      <button className="cabinet-logout" onClick={() => void leave()} disabled={signingOut}>{signingOut ? "Завершаем сессию…" : "Выход из аккаунта"}<Icon name="external" /></button>
      {error && <p role="alert" className="cabinet-error">{error}</p>}
    </aside>
    <div className="cabinet-content" ref={body}><Routes>
      <Route index element={<Overview />} /><Route path="bookings" element={<Trainings />} />
      <Route path="book" element={<BookingPage />} /><Route path="profile" element={<Profile />} />
      <Route path="*" element={<><h1>Раздел не найден</h1><Link to="/account" className="button">На главную кабинета</Link></>} />
    </Routes></div>
  </main>;
}
