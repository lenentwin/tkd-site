import { useRef, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useContent } from "../app/providers/ContentProvider";
import { localToday, trainingBookingSchema } from "../types/trainingBooking";
import Icon from "../components/presentation/Icon";
import { formatDisplayText } from "../components/presentation/DisplayText";
import { clubApi } from "../services/club";
import { ClubConnection, useClub } from "./account/club/ClubProvider";

type StudentDraft = { key: string; lastName: string; firstName: string; middleName: string; age: string };
const newStudent = (): StudentDraft => ({ key: crypto.randomUUID(), lastName: "", firstName: "", middleName: "", age: "" });
const blankGuardian = { lastName: "", firstName: "", middleName: "", relationship: "parent" as "parent" | "guardian", phone: "" };
export default function BookingPage() {
  const { content } = useContent(); const [params] = useSearchParams();
  const club = useClub();
  const [students, setStudents] = useState<StudentDraft[]>(() => [newStudent()]);
  const [guardian, setGuardian] = useState(blankGuardian);
  const [locationId, setLocation] = useState(() => content.locations.some(item => item.id === params.get("location")) ? params.get("location")! : "");
  const [date, setDate] = useState(""); const [errors, setErrors] = useState<Record<string, string>>({}); const [checked, setChecked] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const [comment, setComment] = useState(""); const [busy, setBusy] = useState(false); const sending = useRef(false);
  const [sent, setSent] = useState(false); const [sendError, setSendError] = useState(""); const key = useRef(crypto.randomUUID());
  const connected = !!club.data && !club.error && !club.loading;
  const hasMinor = students.some(student => /^\d+$/.test(student.age) && Number(student.age) > 0 && Number(student.age) < 18);
  const fieldError = (key: string) => errors[key] ? <span className="cabinet-error" id={`error-${key}`}>{errors[key]}</span> : null;
  const accessibility = (key: string) => ({ "aria-invalid": !!errors[key], "aria-describedby": errors[key] ? `error-${key}` : undefined });
  const changed = () => { setChecked(false); setErrors({}); setSent(false); setSendError(""); key.current = crypto.randomUUID(); };
  async function validate(event: FormEvent) {
    event.preventDefault();
    if (sending.current) return;
    const result = trainingBookingSchema(content.locations.map(item => item.id)).safeParse({
      students: students.map(({ lastName, firstName, middleName, age }) => ({ lastName, firstName, middleName, age })),
      guardian: hasMinor ? guardian : undefined, locationId, requestedDate: date, comment,
    });
    if (result.success) {
      setErrors({}); setChecked(true); setSendError("");
      if (!connected) return;
      sending.current = true; setBusy(true);
      try {
        await clubApi.enroll(result.data, key.current);
        setSent(true); setStudents([newStudent()]); setGuardian(blankGuardian); setDate(""); setComment(""); setChecked(false); key.current = crypto.randomUUID();
      } catch (error) { setSendError(error instanceof Error ? error.message : "Не удалось отправить заявку."); }
      finally { sending.current = false; setBusy(false); }
      return;
    }
    const next: Record<string, string> = {};
    for (const issue of result.error.issues) { const key = issue.path.join("."); next[key] ??= issue.message; }
    setErrors(next); setChecked(false);
    requestAnimationFrame(() => form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
  }
  return <>
    <p className="eyebrow">Личный кабинет</p><h1>Записаться на тренировку</h1>
    <p className="cabinet-intro">Запишите себя или детей. Заявка поступит тренеру выбранного зала; дату и зачисление он подтвердит отдельно.</p>
    <ClubConnection />
    {!connected && !club.loading && <div className="cabinet-notice" role="note"><h2>Онлайн-запись пока недоступна</h2><p>Форма ничего не отправляет и не сохраняет. Можно проверить заполнение; для настоящей записи свяжитесь с тренером.</p><Link className="text-link" to="/contacts">Контакты тренера <Icon name="arrow" /></Link></div>}
    {sent && <div className="cabinet-validation" role="status"><strong>Заявка сохранена и ожидает решения тренера.</strong><Link className="text-link" to="/account/bookings">Мои тренировки <Icon name="arrow" /></Link></div>}
    <form className="cabinet-form" ref={form} onSubmit={event => void validate(event)} noValidate autoComplete="off" aria-busy={busy}>
      <fieldset className="club-book-fields" disabled={busy}>
      <div className="cabinet-section-heading"><h2>Кто будет тренироваться</h2><span>{students.length === 1 ? "1 ученик" : `Учеников: ${students.length}`}</span></div>
      {students.map((student, index) => <fieldset className="cabinet-student" key={student.key}>
        <legend>Ученик {index + 1}</legend>
        {students.length > 1 && <button type="button" className="cabinet-remove" aria-label={`Убрать ученика ${index + 1}`} onClick={() => { setStudents(items => items.filter(item => item.key !== student.key)); changed(); }}>Убрать <Icon name="close" /></button>}
        <div className="cabinet-field-grid">{([
          ["lastName", "Фамилия ученика"], ["firstName", "Имя ученика"], ["middleName", "Отчество (необязательно)"], ["age", "Возраст, полных лет"],
        ] as const).map(([field, label]) => {
          const key = `students.${index}.${field}`;
          return <label key={field}>{label}<input aria-label={label} name={key} type={field === "age" ? "number" : "text"} inputMode={field === "age" ? "numeric" : "text"} min={field === "age" ? 1 : undefined} max={field === "age" ? 120 : undefined} step={field === "age" ? 1 : undefined} maxLength={field !== "age" ? 80 : undefined} required={field !== "middleName"} value={student[field]} {...accessibility(key)} onChange={event => { setStudents(items => items.map(item => item.key === student.key ? { ...item, [field]: event.target.value } : item)); changed(); }} />{fieldError(key)}</label>;
        })}</div>
      </fieldset>)}
      <button type="button" className="cabinet-add" disabled={students.length >= 20} onClick={() => { setStudents(items => [...items, newStudent()]); changed(); }}><Icon name="plus" />Добавить ещё ученика</button>
      {hasMinor && <fieldset className="cabinet-guardian"><legend>Родитель или законный представитель</legend><p>Укажите одного представителя для несовершеннолетних учеников в этой форме.</p><div className="cabinet-field-grid">
        {([ ["lastName", "Фамилия представителя"], ["firstName", "Имя представителя"], ["middleName", "Отчество представителя (необязательно)"], ["phone", "Телефон представителя"] ] as const).map(([field, label]) => {
          const key = `guardian.${field}`; return <label key={field}>{label}<input aria-label={label} name={key} type={field === "phone" ? "tel" : "text"} maxLength={field === "phone" ? 24 : 80} required={field !== "middleName"} value={guardian[field]} {...accessibility(key)} onChange={event => { setGuardian(value => ({ ...value, [field]: event.target.value })); changed(); }} />{fieldError(key)}</label>;
        })}
        <label>Вы приходитесь ученику<select name="guardian.relationship" value={guardian.relationship} onChange={event => { setGuardian(value => ({ ...value, relationship: event.target.value as "parent" | "guardian" })); changed(); }}><option value="parent">Родитель</option><option value="guardian">Законный представитель</option></select></label>
      </div></fieldset>}
      <fieldset className="cabinet-place"><legend>Зал и дата</legend><div className="cabinet-field-grid">
        <label>Спортивный зал<select aria-label="Спортивный зал" name="locationId" required value={locationId} {...accessibility("locationId")} onChange={event => { setLocation(event.target.value); changed(); }}><option value="">Выберите зал</option>{content.locations.map(item => <option key={item.id} value={item.id}>{formatDisplayText(item.name)}</option>)}</select>{fieldError("locationId")}</label>
        <label>Желаемая дата тренировки<input aria-label="Желаемая дата тренировки" name="requestedDate" type="date" required min={localToday()} value={date} {...accessibility("requestedDate")} onChange={event => { setDate(event.target.value); changed(); }} />{fieldError("requestedDate")}</label>
      </div><p className="cabinet-small">Дата указывает ваше пожелание. Расписание и наличие места подтверждает тренер.</p></fieldset>
      <label>Комментарий (необязательно)<textarea name="comment" value={comment} maxLength={1000} rows={3} onChange={event => { setComment(event.target.value); changed(); }} />{fieldError("comment")}</label>
      {Object.keys(errors).length > 0 && <p role="alert" className="cabinet-error">Проверьте отмеченные поля. Ничего не отправлено.</p>}
      {sendError && <p role="alert" className="cabinet-error">{sendError} Подтверждения сохранения нет. При повторе без изменения полей дубликат не создастся.</p>}
      <div className="cabinet-form-actions"><button className={connected ? "button" : "button-secondary"} type="submit" disabled={busy}>{busy ? "Отправляем…" : connected ? "Отправить заявку" : "Проверить заполнение"}</button>{!connected && <button className="button" type="button" disabled>Отправка недоступна</button>}</div>
      {checked && !connected && <p role="status" className="cabinet-validation">Поля заполнены корректно. Заявка не отправлялась: онлайн-запись пока недоступна.</p>}
      </fieldset>
      <p className="cabinet-small">{connected ? "Отправленные данные сохраняются на сервере клуба в России. " : ""}Черновик очищается при уходе из раздела и не сохраняется в браузере.</p>
    </form>
  </>;
}
