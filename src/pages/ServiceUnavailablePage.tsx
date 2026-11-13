import { Link } from "react-router-dom";
import { backendStatus } from "../services/backend";

export default function ServiceUnavailablePage() {
  return (
    <main id="main" className="page-shell container">
      <span className="eyebrow">Запись на тренировку</span>
      <h1>Свяжитесь с тренером</h1>
      <p role="status" data-backend-status={backendStatus}>
        Онлайн-запись и вход через Яндекс пока не подключены.
        Чтобы выбрать группу и время тренировки, позвоните или напишите тренеру.
      </p>
      <Link to="/contacts" className="button">Контакты тренера</Link>
    </main>
  );
}
