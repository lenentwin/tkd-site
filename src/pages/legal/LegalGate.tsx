import { lazy, Suspense, useState, type ReactNode } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../../app/providers/AuthProvider";
import "./legal.css";

const LegalAcceptance = lazy(() => import("./LegalAcceptance"));

/** Children must not mount (or request private data) until this session passes the gate. */
export default function LegalGate({ children }: { children: ReactNode }) {
  const { session, loading, unavailable, blocked, refresh, signOut } = useAuth();
  const [error, setError] = useState("");
  if (loading) return <main id="main" className="page-shell container legal-page"><h1>Личный кабинет</h1><p role="status">Проверяем доступ…</p><Link className="text-link" to="/">На главную</Link></main>;
  if (blocked) return <Navigate to="/login?error=account_blocked" replace />;
  if (unavailable) return <main id="main" className="page-shell container legal-page"><h1>Не удалось проверить доступ</h1><p role="status">Проверьте подключение к интернету и повторите попытку. Публичные документы доступны по ссылкам внизу страницы.</p>{error ? <p role="alert">{error}</p> : null}<div className="legal-actions"><button className="button" onClick={() => void refresh()}>Повторить проверку</button><Link className="button-secondary" to="/">На главную</Link><button className="text-link" onClick={() => void signOut().catch(() => setError("Не удалось выйти. Подключитесь к интернету и повторите попытку."))}>Выйти из аккаунта</button></div></main>;
  if (!session) return <Navigate to="/login" replace />;
  // A session without legal metadata is the previous backend contract and remains compatible.
  if (session.mode === "server" && session.legal?.required) return <Suspense fallback={<main id="main" className="page-shell container legal-page"><p role="status">Открываем документы…</p></main>}><LegalAcceptance key={session.id} onAccepted={refresh} onSignOut={signOut} /></Suspense>;
  return children;
}
