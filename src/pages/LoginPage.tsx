import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../app/providers/AuthProvider";
import { DisplayText } from "../components/presentation/DisplayText";

export default function LoginPage() {
  const { session, signIn } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function enter() {
    setBusy(true);
    try {
      await signIn();
      navigate("/account");
    } catch {
      setError("Демонстрационный вход недоступен. Повторите попытку.");
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
          В будущем здесь можно будет войти через Яндекс и записаться на
          тренировку.
        </p>
      </div>
      <section className="demo-panel" aria-labelledby="login-title">
        <span className="demo-tag">Демонстрация интерфейса</span>
        <h2 id="login-title">Вход в MFT39</h2>
        <p>
          Настоящая авторизация пока не подключена. Кнопка откроет тестовый
          кабинет без передачи данных в Яндекс.
        </p>
        {session ? (
          <Link className="button" to="/account">
            Открыть демо-кабинет
          </Link>
        ) : (
          <button
            className="yandex-button"
            onClick={() => void enter()}
            disabled={busy}
          >
            <span aria-hidden="true">Я</span>
            {busy ? "Открываем кабинет…" : "Войти через Яндекс"}
          </button>
        )}
        {error && <p role="alert"><DisplayText text={error} /></p>}
        <p className="demo-note">
          Здесь нет ввода паролей и подключения к аккаунту Яндекса.
        </p>
        <Link to="/contacts">Связаться с тренером</Link>
      </section>
    </main>
  );
}
