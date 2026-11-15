import { useCallback, useEffect, useState } from "react";
import { Link, Navigate, NavLink, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "../../app/providers/AuthProvider";
import { adminApi } from "../../services/admin";
import { usePwa } from "../../pwa/runtime";
import { ClubProvider } from "../account/club/ClubProvider";
import Overview from "./Overview";
import Users from "./Users";
import Halls from "./Halls";
import Students from "./Students";
import Audit from "./Audit";
import { ResultState, useAdminResource } from "./shared";
import "./admin.css";

const navigation = [["/admin", "Обзор"], ["/admin/users", "Пользователи и права"], ["/admin/halls", "Залы и тренеры"], ["/admin/students", "Ученики и заявки"], ["/admin/archive", "Архив"], ["/admin/audit", "История действий"]] as const;
function AdminWorkspace() {
  const { session } = useAuth(); const [revision, setRevision] = useState(0); const location = useLocation();
  const halls = useAdminResource(useCallback(() => adminApi.halls(), []), revision, true);
  useEffect(() => { document.title = "Управление клубом · MFT39"; }, []);
  useEffect(() => { document.getElementById("main")?.focus({ preventScroll: true }); }, [location.pathname]);
  return <div className="admin-shell"><aside className="admin-sidebar"><Link to="/" className="admin-brand" aria-label="MFT39, на главную">MFT<span>39</span></Link><p>Управление клубом</p><nav aria-label="Разделы административной панели">{navigation.map(([to, label]) => <NavLink key={to} to={to} end={to === "/admin"}>{label}</NavLink>)}</nav><div className="admin-identity"><strong>{session?.displayName}</strong><span>Администратор{session?.mode === "server" ? ` · ID #${session.id}` : ""}</span><Link to="/account">Личный кабинет</Link><Link to="/">Открыть сайт</Link></div></aside><main id="main" className="admin-main" tabIndex={-1}><header className="admin-header"><h1>Управление MFT39</h1><span className="admin-badge">Защищённый доступ</span></header><ResultState {...halls} retry={() => setRevision(value => value + 1)} />{halls.data && <Routes><Route index element={<Overview />} /><Route path="users" element={<Users halls={halls.data.items} />} /><Route path="halls" element={<Halls halls={halls.data.items} reload={() => setRevision(value => value + 1)} />} /><Route path="students" element={<Students key="active" halls={halls.data.items} />} /><Route path="archive" element={<Students key="archive" halls={halls.data.items} archived />} /><Route path="audit" element={<Audit halls={halls.data.items} />} /><Route path="*" element={<Navigate to="/admin" replace />} /></Routes>}</main></div>;
}
export default function AdminPage() {
  const auth = useAuth(); const refresh = auth.refresh; const { online } = usePwa(); const [blockedByRequest, setBlocked] = useState(false);
  useEffect(() => {
    const blocked = () => setBlocked(true); const changed = () => { void refresh(); };
    window.addEventListener("mft39:account-blocked", blocked); window.addEventListener("mft39:access-changed", changed);
    return () => { window.removeEventListener("mft39:account-blocked", blocked); window.removeEventListener("mft39:access-changed", changed); };
  }, [refresh]);
  const blocked = blockedByRequest || ("blocked" in auth && auth.blocked === true);
  let title = ""; let description = "";
  if (blocked) { title = "Аккаунт заблокирован"; description = "Доступ к административным операциям прекращён. Для восстановления доступа обратитесь к администратору клуба."; }
  else if (!online) { title = "Нет подключения"; description = "Данные клуба доступны только при подключении к серверу. Восстановите соединение, чтобы продолжить."; }
  else if (auth.loading) { title = "Проверяем доступ"; description = "Проверяем сессию и полномочия на сервере…"; }
  else if (auth.unavailable) { title = "Не удалось проверить доступ"; description = "Сервис авторизации временно недоступен. Повторите проверку подключения."; }
  else if (!auth.session || auth.session.mode !== "server" || auth.session.role !== "admin") { title = "Раздел для администратора"; description = "Управление клубом доступно только аккаунту с ролью администратора. Войдите через Яндекс под нужным аккаунтом."; }
  if (title) return <main id="main" className="admin-access"><Link className="admin-brand" to="/">MFT39</Link><h1>{title}</h1><p role={auth.loading ? "status" : "alert"}>{description}</p><div className="admin-actions">{!auth.loading && !blocked && online && <button className="button" onClick={() => void auth.refresh()}>Повторить проверку</button>}<Link className="button-secondary" to="/account">Личный кабинет</Link><Link className="text-link" to="/">На главную</Link></div></main>;
  return <ClubProvider><AdminWorkspace /></ClubProvider>;
}
