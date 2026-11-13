import { useCallback, useState } from "react";
import { clubApi, type ClubStudent } from "../../../services/club";
import { ClubConnection, currentPayment, useClub } from "./ClubProvider";
import { usePaged } from "./usePaged";
export const learningLabels = { trial: "Пробный", permanent: "Постоянный", inactive: "Неактивный" };
export const applicationLabels = { pending: "Ожидает решения", accepted: "Принята", rejected: "Отклонена" };
export function fullName(student: { lastName: string; firstName: string; middleName: string }) { return [student.lastName, student.firstName, student.middleName].filter(Boolean).join(" "); }
const dateTime = (date: string) => new Date(date).toLocaleString("ru-RU", { timeZone: "Europe/Kaliningrad" });
export function PaymentLabel({ student }: { student: ClubStudent }) {
  const { month } = useClub(); const status = currentPayment(student.payment, month);
  return <span className={`club-badge is-${status}`}>{month}: {status === "paid" ? "Оплачено" : status === "unpaid" ? "Не оплачено" : "Нужно обновить"}</span>;
}
export function HistoryView({ studentId }: { studentId: string }) {
  const { month, data, error } = useClub(); const enabled = !!data && !error;
  const loadPayments = useCallback((cursor: string) => clubApi.payments(studentId, cursor), [studentId]);
  const loadAudit = useCallback(async (cursor: string) => { const value = await clubApi.audit(studentId, Number(cursor)); return { items: value.items, nextCursor: value.hasMore ? String(value.cursor) : null }; }, [studentId]);
  const payments = usePaged(loadPayments, enabled, `${studentId}:${month}`); const audit = usePaged(loadAudit, enabled, `${studentId}:${month}`);
  return <section className="club-history"><h3>История оплат</h3>
    {(payments.error || audit.error) && <p role="alert" className="cabinet-error">{payments.error || audit.error}<button className="text-link" onClick={() => { void payments.reload(); void audit.reload(); }}>Повторить загрузку</button></p>}
    {payments.busy && <p role="status">Загружаем историю…</p>}
    <ul>{payments.data?.items.map(payment => <li key={payment.month}><strong>{payment.month}</strong><span>{payment.status === "paid" ? "Оплачено" : "Не оплачено"}</span>{payment.confirmedAt && <small>Подтверждение: {dateTime(payment.confirmedAt)} · тренер #{payment.confirmedBy}</small>}</li>)}</ul>
    {payments.data?.nextCursor && <button className="text-link" disabled={payments.busy} onClick={() => void payments.more()}>Предыдущие месяцы</button>}
    <h3>История изменений</h3><ul>{audit.data?.items.map(event => <li key={event.id}><time>{dateTime(event.createdAt)}</time><span>{({ "student.created": "Ученик добавлен", "application.created": "Заявка создана", "application.accepted": "Заявка принята", "application.rejected": "Заявка отклонена", "student.status": "Изменён статус обучения", "payment.status": "Изменена отметка оплаты" } as Record<string, string>)[event.action] ?? "Изменение записи"}</span><small>{typeof event.details.from === "string" && typeof event.details.to === "string" ? `${({ ...learningLabels, paid: "Оплачено", unpaid: "Не оплачено", ...applicationLabels } as Record<string, string>)[event.details.from] ?? event.details.from} → ${({ ...learningLabels, paid: "Оплачено", unpaid: "Не оплачено", ...applicationLabels } as Record<string, string>)[event.details.to] ?? event.details.to}` : ""}{typeof event.details.reason === "string" ? ` ${event.details.reason}` : ""}</small></li>)}</ul>
    {audit.data?.nextCursor && <button className="text-link" disabled={audit.busy} onClick={() => void audit.more()}>Показать ещё изменения</button>}
  </section>;
}
export default function ParentTrainings() {
  const club = useClub(); const [selected, setSelected] = useState<string | null>(null);
  const loadStudents = useCallback((cursor: string) => clubApi.students("all", cursor), []); const loadApplications = useCallback((cursor: string) => clubApi.applications(cursor), []);
  const enabled = !!club.data && !club.error; const refreshKey = `${club.month}:${club.data?.scopeVersion}`;
  const students = usePaged(loadStudents, enabled, refreshKey); const applications = usePaged(loadApplications, enabled, refreshKey);
  return <><p className="eyebrow">Личный кабинет</p><h1>Мои тренировки</h1><ClubConnection />
    {(students.error || applications.error) && <p role="alert" className="cabinet-error">{students.error || applications.error}<button className="text-link" onClick={() => { void students.reload(); void applications.reload(); }}>Повторить</button></p>}
    {(students.busy || applications.busy) && <p role="status">Загружаем заявки и учеников…</p>}
    {applications.data && <><h2>Мои заявки</h2>{applications.data.items.length === 0 ? <p>Вы ещё не подавали заявок.</p> : <div className="club-list">{applications.data.items.map(application => <article key={application.id}><h3>{fullName(application)}</h3><p>{club.data?.halls.find(hall => hall.id === application.locationId)?.name}</p><p>Желаемая дата: {application.requestedDate}</p><span className="club-badge">{applicationLabels[application.status]}</span></article>)}</div>}
    {applications.data.nextCursor && <button className="text-link" disabled={applications.busy} onClick={() => void applications.more()}>Показать ещё заявки</button>}</>}
    {students.data && <><h2>Ученики</h2>{students.data.items.length === 0 && <p>Ученики появятся после подачи заявки.</p>}<div className="club-list">{students.data.items.map(student => <article key={student.id}><h3>{fullName(student)}</h3><p>Возраст при добавлении: {student.age} · {learningLabels[student.status]}{!student.admitted ? " · ещё не зачислен" : ""}</p><PaymentLabel student={student} /><button className="text-link" onClick={() => setSelected(value => value === student.id ? null : student.id)}>История оплат и статусов</button>{selected === student.id && <HistoryView key={student.id} studentId={student.id} />}</article>)}</div>
    {students.data.nextCursor && <button className="text-link" disabled={students.busy} onClick={() => void students.more()}>Показать ещё учеников</button>}</>}
  </>;
}