import { useState, type FormEvent } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../app/providers/AuthProvider";
import { useContent } from "../app/providers/ContentProvider";
import { demoBookingService } from "../services/demo";
import { DisplayText, formatDisplayText } from "../components/presentation/DisplayText";

export default function BookingPage() {
  const { session } = useAuth();
  const { content } = useContent();
  const [params] = useSearchParams();
  const [adult, setAdult] = useState(false);
  const [location, setLocation] = useState(() =>
    content.locations.some((item) => item.id === params.get("location"))
      ? params.get("location")!
      : content.locations[0].id,
  );
  const [date, setDate] = useState("");
  const [message, setMessage] = useState("");
  const today = new Date().toLocaleDateString("en-CA");
  if (!session) return <Navigate to="/login" replace />;
  async function submit(event: FormEvent) {
    event.preventDefault();
    const result = await demoBookingService.submit({
      locationId: location,
      participantType: adult ? "adult" : "child",
      fullName: adult ? "Тестовый Участник" : "Тестовый Ребёнок",
      birthDate: adult ? "1995-01-01" : "2018-01-01",
      requestedDate: date,
    });
    setMessage(result.message);
  }
  return (
    <main id="main" className="page-shell container booking-page">
      <div className="demo-heading">
        <span className="demo-tag">Только демонстрация</span>
        <h1>
          Первая
          <br />
          тренировка
        </h1>
        <p>
          Посмотрите, как будет выглядеть запись. Для настоящей тренировки
          свяжитесь с тренером.
        </p>
        <Link to="/contacts" className="button-secondary">
          Контакты тренера
        </Link>
      </div>
      <form
        className="demo-panel booking-form"
        onSubmit={(event) => void submit(event)}
      >
        <h2>Кто будет заниматься?</h2>
        <fieldset className="participant-switch">
          <legend className="sr-only">Возрастная группа</legend>
          <label>
            <input
              type="radio"
              name="participant"
              checked={!adult}
              onChange={() => {
                setAdult(false);
                setMessage("");
              }}
            />
            Ребёнок / подросток
          </label>
          <label>
            <input
              type="radio"
              name="participant"
              checked={adult}
              onChange={() => {
                setAdult(true);
                setMessage("");
              }}
            />
            Взрослый
          </label>
        </fieldset>
        <label>
          Зал
          <select
            aria-label="Зал"
            value={location}
            onChange={(event) => setLocation(event.target.value)}
          >
            {content.locations.map((item) => (
              <option value={item.id} key={item.id}>
                {formatDisplayText(item.name)}
              </option>
            ))}
          </select>
        </label>
        <p className="demo-note">
          Чтобы случайно не собрать персональные данные, имя и дата рождения
          здесь заполнены вымышленными примерами и не редактируются.
        </p>
        <label>
          {adult ? "ФИО участника" : "ФИО ребёнка"}
          <input
            value={adult ? "Тестовый Участник" : "Тестовый Ребёнок"}
            readOnly
            autoComplete="off"
          />
        </label>
        <label>
          {adult ? "Дата рождения участника" : "Дата рождения ребёнка"}
          <input
            type="date"
            value={adult ? "1995-01-01" : "2018-01-01"}
            readOnly
          />
        </label>
        <label>
          Желаемая дата тренировки
          <input
            type="date"
            value={date}
            min={today}
            required
            onChange={(event) => {
              setDate(event.target.value);
              setMessage("");
            }}
          />
        </label>
        <p className="demo-note">
          Дата не подтверждает наличие занятия. Заявки не отправляются и не
          сохраняются.
        </p>
        <button type="submit" className="button">
          Посмотреть результат записи
        </button>
        {message && (
          <div role="status" className="demo-result">
            <strong>Демонстрация завершена</strong>
            <p><DisplayText text={message} /></p>
            <Link to="/account">Вернуться в кабинет</Link>
          </div>
        )}
      </form>
    </main>
  );
}
