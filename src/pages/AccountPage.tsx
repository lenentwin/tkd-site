import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../app/providers/AuthProvider";
import { useContent } from "../app/providers/ContentProvider";
import { DisplayText } from "../components/presentation/DisplayText";

export default function AccountPage() {
  const { session, signOut } = useAuth();
  const { content } = useContent();
  const navigate = useNavigate();
  if (!session) return <Navigate to="/login" replace />;
  return (
    <main id="main" className="page-shell container account-page">
      <span className="demo-tag">Демонстрационный кабинет</span>
      <h1>
        Здравствуйте,
        <br />
        <DisplayText text={session.displayName} />
      </h1>
      <p className="account-intro">
        Вы вошли в тестовом режиме. Можно посмотреть, как будет устроена запись,
        или выбрать удобный зал.
      </p>
      <div className="demo-actions">
        <Link to="/booking" className="button">
          <DisplayText text={content.brand.bookingLabel} />
        </Link>
        <button
          className="button-secondary"
          onClick={() => void signOut().then(() => navigate("/login"))}
        >
          Выйти из демо
        </button>
      </div>
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
