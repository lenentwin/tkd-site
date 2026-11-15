import { useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../app/providers/AuthProvider";
import { DisplayText } from "../components/presentation/DisplayText";
import { yandexAuthEnabled } from "../services/backend";
import { usePwa } from "../pwa/runtime";

export default function LoginPage() {
  const { online } = usePwa();
  const [search] = useSearchParams();
  const { session, signIn, loading, unavailable, blocked, refresh } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const localDemo = import.meta.env.DEV && !yandexAuthEnabled;
  async function enter() {
    setBusy(true);
    setError("");
    try {
      await signIn();
      if (!yandexAuthEnabled) navigate("/account");
    } catch {
      setError("Вход недоступен. Повторите попытку.");
    } finally {
      setBusy(false);
    }
  }
  if (blocked || search.get("error") === "account_blocked") return <main id="main" className="page-shell container cabinet-state"><h1>Доступ к аккаунту ограничен</h1><p>Для уточнения причины и восстановления доступа свяжитесь с администратором клуба.</p><Link className="button-secondary" to="/contacts">Контакты клуба</Link><Link className="text-link" to="/login" onClick={() => void refresh()}>Повторить вход после разблокировки</Link></main>;
  if (session && !unavailable && !loading) return <Navigate to="/account" replace />;
  return (
    <main id="main" className="page-shell demo-page container">
      <div className="demo-heading">
        <span className="eyebrow">Личный кабинет</span>
        <h1>
          До встречи
          <br />в зале
        </h1>
        <p>
          Войдите через Яндекс ID, чтобы открыть личный кабинет и раздел записи на тренировку.
        </p>
      </div>
      <section className="demo-panel" aria-labelledby="login-title">
        {localDemo && <span className="demo-tag">Локальная демонстрация</span>}
        <h2 id="login-title">Вход в MFT39</h2>
        <p>
          Подтверждение входа откроется на сайте Яндекса. Пароль вводится только там.
        </p>
        {session ? (
          <Link className="button" to="/account">
            {yandexAuthEnabled ? "Открыть кабинет" : "Открыть демо-кабинет"}
          </Link>
        ) : (
          <button
            className="yandex-button"
            onClick={() => void enter()}
            disabled={busy || loading || (yandexAuthEnabled && !online) || (!yandexAuthEnabled && !localDemo)}
          >
            <span aria-hidden="true">Я</span>
            {busy ? "Подключаемся…" : localDemo ? "Открыть локальную демонстрацию" : "Войти через Яндекс"}
          </button>
        )}
        {error && <p role="alert"><DisplayText text={error} /></p>}
        {!online && yandexAuthEnabled && <p role="status">Для входа через Яндекс подключитесь к интернету.</p>}
        {loading && <p role="status">Проверяем сессию…</p>}
        {unavailable && <div role="status"><p>Сервис входа временно недоступен. Попробуйте позже.</p><button className="text-link" onClick={() => void refresh()}>Повторить проверку</button></div>}
        {!yandexAuthEnabled && !localDemo && <p role="status">Вход ещё не подключён. Пока можно связаться с тренером.</p>}
        <p className="demo-note">
          Аккаунт может принадлежать родителю. Данные ученика указываются отдельно в кабинете.
        </p>
        <Link to="/contacts">Связаться с тренером</Link>
        <nav className="login-legal-links" aria-label="Документы перед входом">
          <Link to="/legal/terms">Пользовательское соглашение</Link>
          <Link to="/legal/privacy">Политика обработки персональных данных</Link>
          <Link to="/legal/user-consent">Согласие пользователя</Link>
          <Link to="/legal/guardian-consent">Согласие законного представителя</Link>
        </nav>
        <p className="demo-note">Вход через Яндекс сам по себе не означает принятия соглашения или предоставления согласия. Документы подтверждаются отдельно после входа.</p>
      </section>
    </main>
  );
}
