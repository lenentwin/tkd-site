import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../app/providers/AuthProvider";
import { DisplayText } from "../components/presentation/DisplayText";
import { yandexAuthEnabled } from "../services/backend";

export default function LoginPage() {
  const { session, signIn, loading, unavailable } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function enter() {
    setBusy(true);
    try {
      await signIn();
      if (!yandexAuthEnabled) navigate("/account");
    } catch {
      setError("Вход недоступен. Повторите попытку.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main id="main" className="page-shell demo-page container">
      <div className="demo-heading">
        <span className="eyebrow">Личный кабинет</span>
        <h1>
          До встречи
          <br />в зале
        </h1>
        <p>
          {yandexAuthEnabled ? "Войдите через Яндекс ID в личный кабинет MFT39." : "В будущем здесь можно будет войти через Яндекс и записаться на тренировку."}
        </p>
      </div>
      <section className="demo-panel" aria-labelledby="login-title">
        {!yandexAuthEnabled && <span className="demo-tag">Демонстрация интерфейса</span>}
        <h2 id="login-title">Вход в MFT39</h2>
        <p>
          {yandexAuthEnabled ? "Подтверждение входа откроется на сайте Яндекса. Пароль вводится только там." : "Настоящая авторизация пока не подключена. Кнопка откроет тестовый кабинет без передачи данных в Яндекс."}
        </p>
        {session ? (
          <Link className="button" to="/account">
            {yandexAuthEnabled ? "Открыть кабинет" : "Открыть демо-кабинет"}
          </Link>
        ) : (
          <button
            className="yandex-button"
            onClick={() => void enter()}
            disabled={busy || loading}
          >
            <span aria-hidden="true">Я</span>
            {busy ? "Открываем кабинет…" : "Войти через Яндекс"}
          </button>
        )}
        {error && <p role="alert"><DisplayText text={error} /></p>}
        {unavailable && <p role="status">Сервис входа временно недоступен. Попробуйте позже.</p>}
        <p className="demo-note">
          {yandexAuthEnabled ? "MFT39 получает только идентификатор аккаунта для входа." : "Здесь нет ввода паролей и подключения к аккаунту Яндекса."}
        </p>
        <Link to="/contacts">Связаться с тренером</Link>
      </section>
    </main>
  );
}
