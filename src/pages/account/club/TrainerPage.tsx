import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { canClub, clubApi, type ClubStudent } from "../../../services/club";
import { ClubConnection, useClub } from "./ClubProvider";
import { fullName, HistoryView, learningLabels, PaymentLabel } from "./ParentTrainings";
import { useResource } from "./useResource";
import { usePaged } from "./usePaged";
import { BirthYearEditor, studentAgeText } from "./StudentIdentity";
import ArchiveControls from "./ArchiveControls";
function followingMonth(month: string) { const [year, m] = month.split("-").map(Number); return `${m === 12 ? year + 1 : year}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}`; }
export function StudentDetails({ student, updated, refresh }: { student: ClubStudent; updated: (student: ClubStudent) => void; refresh: () => Promise<void> }) {
  const { month, data, error: connectionError } = useClub(); const [status, setStatus] = useState(student.status); const [selectedMonth, setMonth] = useState(month);
  const [reason, setReason] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false); const [revision, setRevision] = useState(0);
  const load = useCallback(() => clubApi.payments(student.id, selectedMonth && selectedMonth !== month ? followingMonth(selectedMonth) : ""), [student.id, selectedMonth, month]);
  const payments = useResource(load, !!data && !connectionError, `${revision}:${data?.serverTime}`);
  useEffect(() => setMonth(month), [month]); useEffect(() => setStatus(student.status), [student.status]);
  const payment = payments.data?.items.find(item => item.month === selectedMonth);
  const canWrite = !student.archived && canClub(data, "payments.write") && !busy && !payments.busy && !connectionError && !!payment && data?.currentMonth === month && payments.data?.currentMonth === month;
  async function changeStatus() {
    setBusy(true); setError(""); try { const value = await clubApi.status(student.id, status, student.version, reason); updated({ ...student, status: value.status, version: value.version }); setRevision(value => value + 1); }
    catch (error) { setError(error instanceof Error ? error.message : "Не удалось изменить статус."); } finally { setBusy(false); }
  }
  async function mark(value: "paid" | "unpaid") {
    if (!canWrite || !payment) return;
    setBusy(true); setError(""); try { const result = await clubApi.payment(student.id, selectedMonth, value, payment.version, month, reason); if (selectedMonth === month) updated({ ...student, payment: { month, status: result.status, version: result.version } }); setRevision(value => value + 1); }
    catch (error) { setError(error instanceof Error ? error.message : "Не удалось изменить оплату."); } finally { setBusy(false); }
  }
  return <section className="club-details"><div className="cabinet-section-heading"><h2>{fullName(student)}</h2><button className="text-link" disabled={busy} onClick={() => { setBusy(true); void refresh().then(() => { setRevision(value => value + 1); setError(""); }).catch(error => setError(error instanceof Error ? error.message : "Не удалось обновить карточку.")).finally(() => setBusy(false)); }}>Обновить карточку</button></div>
    <p>{studentAgeText(student, month)}</p><p>Статус: {learningLabels[student.status]}{student.archived ? " · В архиве" : ""}</p>{student.guardians.map(guardian => <p key={guardian.id}>{guardian.relationship === "self" ? "Аккаунт ученика" : "Родитель или представитель"}: {guardian.displayName}</p>)}
    <BirthYearEditor key={student.version} student={student} saved={refresh} /><div className="cabinet-field-grid"><label>Статус обучения<select aria-label="Статус обучения" value={status} onChange={event => setStatus(event.target.value as ClubStudent["status"])}>{Object.entries(learningLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label>Причина изменения<input value={reason} maxLength={500} onChange={event => setReason(event.target.value)} /></label></div>
    <button className="button-secondary" disabled={!canClub(data, "students.status") || student.archived || busy || !!connectionError || status === student.status} onClick={() => void changeStatus()}>Изменить статус</button>
    <h3>Отметка оплаты</h3><label>Месяц оплаты<input type="month" value={selectedMonth} min={student.createdAt.slice(0, 7)} max={month} onChange={event => setMonth(event.target.value)} /></label>
    <p>{payment && payments.data?.currentMonth === month ? payment.status === "paid" ? "Оплачено" : "Не оплачено" : "Нужно обновить данные за выбранный месяц"}</p>
    <div className="cabinet-form-actions"><button className="button" disabled={!canWrite || payment?.status === "paid"} onClick={() => void mark("paid")}>Отметить оплату</button><button className="button-secondary" disabled={!canWrite || payment?.status !== "paid"} onClick={() => void mark("unpaid")}>Снять отметку оплаты</button></div>
    <p className="cabinet-small">Это ручная отметка тренера. Банковский платёж не выполняется. Для исправления и прошлого месяца укажите причину.</p>
    {(error || payments.error) && <p role="alert" className="cabinet-error">{error || payments.error}</p>}
    <HistoryView key={`${student.id}-${revision}`} studentId={student.id} />
  </section>;
}
export default function TrainerPage() {
  const club = useClub(); const [filter, setFilter] = useState("active"); const [selected, setSelected] = useState<ClubStudent | null>(null); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const loadStudents = useCallback((cursor: string) => clubApi.students(filter === "archived" ? "all" : filter, cursor, false, filter === "archived"), [filter]); const loadApplications = useCallback((cursor: string) => clubApi.applications(cursor, "pending"), []);
  const enabled = !!club.data?.staff && !club.error; const refreshKey = `${club.month}:${club.data?.scopeVersion}:${club.data?.serverTime}`;
  const students = usePaged(loadStudents, enabled, refreshKey); const applications = usePaged(loadApplications, enabled, refreshKey);
  useEffect(() => setSelected(null), [club.data?.scopeVersion]);
  const selectedId = selected?.id;
  const selectedVersion = selected?.version; const selectedPaymentVersion = selected?.payment.version;
  useEffect(() => {
    if (!selectedId || !enabled) return;
    let stale = false;
    void clubApi.student(selectedId).then(fresh => {
      if (stale) return;
      setSelected(current => {
        if (!current || current.id !== selectedId || fresh.version < current.version || fresh.payment.month < current.payment.month || (fresh.payment.month === current.payment.month && fresh.payment.version < current.payment.version)) return current;
        return fresh.version === current.version && fresh.payment.month === current.payment.month && fresh.payment.version === current.payment.version ? current : fresh;
      });
    }).catch(error => { if (!stale) { setSelected(null); setError(error instanceof Error ? error.message : "Не удалось обновить карточку."); } });
    return () => { stale = true; };
  }, [selectedId, selectedVersion, selectedPaymentVersion, enabled, club.data?.serverTime]);
  useEffect(() => {
    if (!selectedId) return;
    const frame = requestAnimationFrame(() => document.querySelector(".club-details")?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" }));
    return () => cancelAnimationFrame(frame);
  }, [selectedId]);
  if (club.data && !club.data.staff) return <><h1>Раздел для тренеров</h1><p>Доступ к ученикам определяется назначениями на сервере.</p></>;
  async function decide(id: string, status: "accepted" | "rejected", version: number) {
    setBusy(true); setError(""); try { await clubApi.decide(id, status, version); await Promise.all([students.reload(), applications.reload()]); } catch (error) { setError(error instanceof Error ? error.message : "Не удалось обработать заявку."); } finally { setBusy(false); }
  }
  return <><p className="eyebrow">Управление секцией</p><h1>Ученики и заявки</h1><ClubConnection /><Link className="text-link" to="/account/devices">Доступ для приложения</Link>
    {(error || students.error || applications.error) && <p role="alert" className="cabinet-error">{error || students.error || applications.error}</p>}
    {(students.busy || applications.busy) && <p role="status">Обновляем данные…</p>}
    {applications.data && <><div className="cabinet-section-heading"><h2>Новые заявки</h2><button className="text-link" onClick={() => { setError(""); void students.reload(); void applications.reload(); }}>Обновить список</button></div>
      <div className="club-list">{applications.data.items.map(application => <article key={application.id}><h3>{fullName(application)}</h3><p>{application.age} лет · {club.data?.halls.find(hall => hall.id === application.locationId)?.name}</p><p>Желаемая дата: {application.requestedDate}</p>{application.applicant && <p>Родитель или заявитель: {application.applicant.displayName}</p>}{application.comment && <p className="club-comment">{application.comment}</p>}{application.guardian && <p>Представитель: {fullName(application.guardian)} · {application.guardian.phone}</p>}<div className="cabinet-form-actions"><button className="button" disabled={busy || !canClub(club.data, "applications.decide")} onClick={() => void decide(application.id, "accepted", application.version)}>Принять заявку</button><button className="button-secondary" disabled={busy || !canClub(club.data, "applications.decide")} onClick={() => void decide(application.id, "rejected", application.version)}>Отклонить заявку</button></div></article>)}</div>
      {applications.data.items.length === 0 && <p>Нет ожидающих заявок.</p>}{applications.data.nextCursor && <button className="text-link" disabled={applications.busy} onClick={() => void applications.more()}>Показать ещё заявки</button>}</>}
    {students.data && <><div className="cabinet-section-heading"><h2>Занимающиеся</h2><label>Показать<select value={filter} onChange={event => { setFilter(event.target.value); setSelected(null); }}><option value="active">Занимающиеся</option><option value="all">Все зачисленные</option>{(canClub(club.data, "students.archive") || canClub(club.data, "students.restore")) && <option value="archived">Архив</option>}{Object.entries(learningLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label></div>
      <div className="club-list">{students.data.items.map(student => <article key={student.id}><h3>{fullName(student)}</h3><p>{studentAgeText(student, club.month)} · {learningLabels[student.status]}</p>{student.guardians.map(guardian => <p key={guardian.id}>{guardian.relationship === "self" ? "Аккаунт ученика" : "Родитель или представитель"}: {guardian.displayName}</p>)}<p>{club.data?.halls.find(hall => hall.id === student.locationId)?.name}</p><PaymentLabel student={student} /><button className="text-link" onClick={() => setSelected(student)}>Открыть карточку</button></article>)}</div>
      {students.data.items.length === 0 && <p>В этом списке пока нет учеников.</p>}{students.data.nextCursor && <button className="text-link" disabled={students.busy} onClick={() => void students.more()}>Показать ещё учеников</button>}</>}
    {enabled && selected && <ArchiveControls key={selected.id + ":" + selected.version} student={selected} changed={async () => { setSelected(null); await students.reload(); await applications.reload(); }} />}
    {enabled && selected && <StudentDetails key={selected.id} student={selected} updated={value => { setSelected(value); void students.reload(); }} refresh={async () => { const fresh = await clubApi.student(selected.id); setSelected(fresh); await students.reload(); }} />}
  </>;
}
