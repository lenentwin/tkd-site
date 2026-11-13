import { Link, Navigate, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../app/providers/AuthProvider";
import { useContent } from "../app/providers/ContentProvider";
import { DisplayText } from "../components/presentation/DisplayText";

export default function AccountPage() {
  const { session, signOut, loading, unavailable } = useAuth();
  const [error, setError] = useState("");
  const { content } = useContent();
  const navigate = useNavigate();
  if (loading) return <main id="main" className="page-shell container"><h1>Личный кабинет</h1><p role="status">Проверяем сессию…</p></main>;
  if (unavailable) return <main id="main" className="page-shell container"><h1>Личный кабинет временно недоступен</h1><p>Не удалось проверить подключение. Повторите попытку позже.</p><Link to="/contacts">Связаться с тренером</Link></main>;
  if (!session) return <Navigate to="/login" replace />;
  return (
    <main id="main" className="page-shell container account-page">
      {session.mode === "demo" && <span className="demo-tag">Демонстрационный кабинет</span>}
      <h1>
        Здравствуйте,
        <br />
        <DisplayText text={session.displayName} />
      </h1>
      <p className="account-intro">
        {session.mode === "server" ? "Вход через Яндекс ID подтверждён. Информация о залах доступна ниже; запись пока оформляется через тренера." : "Вы вошли в тестовом режиме. Можно посмотреть, как будет устроена запись, или выбрать удобный зал."}
      </p>
      <div className="demo-actions">
        <Link to="/booking" className="button">
          <DisplayText text={content.brand.bookingLabel} />
        </Link>
        <button
          className="button-secondary"
          onClick={() => void signOut().then(() => navigate("/login")).catch(() => setError("Не удалось выйти. Повторите попытку."))}
        >
          {session.mode === "server" ? "Выйти" : "Выйти из демо"}
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
      <section
        className="account-locations"
        aria-labelledby="account-locations"
      >
        <h2 id="account-locations">Где тренироваться</h2>
        {content.locations.map((location) => (
          <article key={location.id}>
            <h3><DisplayText text={location.name} /></h3>
            <p><DisplayText text={location.address} /></p>
            <p><DisplayText text={location.schedule} /></p>
            <Link to={`/booking?location=${encodeURIComponent(location.id)}`}>
              Выбрать этот зал
            </Link>
          </article>
        ))}
      </section>
      <Link to="/contacts">Контакты тренера и маршруты</Link>
    </main>
  );
}
