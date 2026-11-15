import { useEffect, useRef, useState, type ReactNode } from "react";
import { deleteReasonLabels, type AuditEvent } from "../../services/admin";

export const roleLabels = { user: "Пользователь", trainer: "Тренер", head_trainer: "Главный тренер", admin: "Администратор" };
export const dateTime = (value: string | null) => value ? new Date(value).toLocaleString("ru-RU", { timeZone: "Europe/Kaliningrad" }) : "Нет данных";
export const actionLabels: Record<string, string> = { "user.access": "Изменение доступа аккаунта", "staff.role": "Изменение роли", "staff.grant": "Назначение тренера", "staff.revoke": "Снятие назначения", "student.birth_year": "Изменение года рождения", "profile.updated": "Изменение профиля", "student.created": "Создание ученика", "student.status": "Статус обучения", "payment.status": "Отметка оплаты", "application.created": "Создание заявки", "application.accepted": "Приём заявки", "application.rejected": "Отклонение заявки", "student.archived": "Архивирование", "student.restored": "Восстановление", "student.deleted": "Окончательное удаление", "user.updated": "Изменение аккаунта", "user.permissions": "Изменение прав", "user.role": "Изменение роли", "user.blocked": "Блокировка", "user.unblocked": "Разблокировка", "hall.saved": "Изменение зала", "trainer.halls": "Назначение залов" };
export function useAdminResource<T>(load: () => Promise<T>, revision = 0, keepData = false) {
  const [data, setData] = useState<T | null>(null); const [error, setError] = useState(""); const [busy, setBusy] = useState(true);
  useEffect(() => {
    let active = true; setBusy(true); setError(""); if (!keepData) setData(null);
    void load().then(value => { if (active) setData(value); }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : "Не удалось загрузить данные."); }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [load, revision, keepData]);
  return { data, error, busy };
}
export function ResultState({ busy, error, retry }: { busy: boolean; error: string; retry: () => void }) {
  return <>{busy && <p role="status" className="admin-status">Загружаем данные…</p>}{error && <div role="alert" className="admin-error"><p>{error}</p><button type="button" className="button-secondary" onClick={retry}>Повторить загрузку</button></div>}</>;
}
export function Pagination({ data, change, busy }: { data: { page: number; pages: number; total: number }; change: (page: number) => void; busy: boolean }) {
  return <nav className="admin-pagination" aria-label="Страницы списка"><span>Всего: {data.total}</span><button className="button-secondary" disabled={busy || data.page <= 1} onClick={() => change(data.page - 1)}>Назад</button><span aria-live="polite">{data.page} / {Math.max(1, data.pages)}</span><button className="button-secondary" disabled={busy || data.page >= data.pages} onClick={() => change(data.page + 1)}>Далее</button></nav>;
}
export function Modal({ title, close, children, busy = false }: { title: string; close: () => void; children: ReactNode; busy?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null); const dismiss = useRef(close); dismiss.current = close;
  useEffect(() => { const dialog = ref.current; const previous = document.activeElement; dialog?.showModal(); return () => { dialog?.close(); if (previous instanceof HTMLElement && previous.isConnected) previous.focus(); }; }, []);
  return <dialog ref={ref} className="admin-dialog" aria-labelledby="admin-dialog-title" onCancel={event => { event.preventDefault(); if (!busy) dismiss.current(); }}><div className="admin-dialog-head"><h2 id="admin-dialog-title">{title}</h2><button type="button" className="button-secondary" aria-label="Закрыть карточку" disabled={busy} onClick={close}>Закрыть</button></div>{children}</dialog>;
}
const fieldLabels: Record<string, string> = { reason: "Причина", reasonCode: "Основание удаления", from: "Ранее", to: "Стало", role: "Роль", status: "Статус", hallIds: "Залы", hallScope: "Охват", permissions: "Права", overrides: "Индивидуальные права", expectedVersion: "Версия", month: "Месяц", redacted: "Данные обезличены", active: "Активность", name: "Название", address: "Адрес", trainerIds: "Тренеры" };
const valueLabels: Record<string, string> = { ...roleLabels, ...deleteReasonLabels, paid: "Оплачено", unpaid: "Не оплачено", trial: "Пробный", permanent: "Постоянный", inactive: "Неактивный", active: "Активен", blocked: "Заблокирован", all: "Все залы", assigned: "Назначенные залы", pending: "Ожидает решения", accepted: "Принята", rejected: "Отклонена" };
function displayValue(value: unknown): string { if (value === null) return "Нет данных"; if (typeof value === "boolean") return value ? "Да" : "Нет"; if (typeof value === "string") return valueLabels[value] ?? value; if (typeof value === "number") return String(value); if (Array.isArray(value)) return value.map(displayValue).join(", ") || "Нет"; if (value && typeof value === "object") return Object.entries(value).map(([key, child]) => `${fieldLabels[key] ?? key}: ${displayValue(child)}`).join("; "); return "Нет данных"; }
export function AuditList({ events }: { events: AuditEvent[] }) {
  return events.length ? <ol className="admin-timeline">{events.map(event => <li key={event.id}><div><strong>{actionLabels[event.action] ?? event.action}</strong><time dateTime={event.createdAt}>{dateTime(event.createdAt)}</time></div><p>{event.actorName ?? (event.actorId ? `Сотрудник #${event.actorId}` : "Система")}<span className="admin-muted"> · {event.entityId}</span></p>{Object.keys(event.details).length > 0 && <details><summary>Изменения и причина</summary><dl className="admin-definition">{Object.entries(event.details).map(([key, value]) => <div key={key}><dt>{fieldLabels[key] ?? key}</dt><dd>{displayValue(value)}</dd></div>)}</dl></details>}</li>)}</ol> : <p className="admin-empty">Событий по выбранным условиям нет.</p>;
}
