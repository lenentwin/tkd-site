import { useState, type FormEvent } from "react";
import { clubApi, type ClubStudent } from "../../../services/club";
import { useClub } from "./ClubProvider";
export function studentAgeText(student: ClubStudent, month: string): string {
  return student.birthYear !== null ? (Number(month.slice(0,4)) - student.birthYear) + " лет в этом году · " + student.birthYear + " г. р."
    : "Возраст при добавлении: " + student.age + " лет · год рождения не указан";
}
export function BirthYearEditor({ student, saved }: { student: ClubStudent; saved: () => Promise<void> }) {
  const { month, data, error: connectionError } = useClub(); const [year, setYear] = useState(student.birthYear === null ? "" : String(student.birthYear));
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [success, setSuccess] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy || connectionError || data?.schemaVersion !== 3) return;
    setBusy(true); setError(""); setSuccess(false);
    try { await clubApi.birthYear(student.id, Number(year), student.version); await saved(); setSuccess(true); }
    catch (error) { setError(error instanceof Error ? error.message : "Не удалось сохранить год рождения."); } finally { setBusy(false); }
  }
  const currentYear = Number(month.slice(0,4));
  return <form onSubmit={event => void submit(event)} className="club-birth-year"><label>Год рождения ученика<input type="number" inputMode="numeric" required min={Math.max(1900,currentYear-120)} max={currentYear-1} step={1} value={year} onChange={event => { setYear(event.target.value); setSuccess(false); }} /></label>
    <p className="cabinet-small">Возраст рассчитывается по году рождения и меняется с началом календарного года. Точный день рождения не собирается.</p>
    <button className="button-secondary" disabled={busy || !!connectionError || data?.schemaVersion !== 3 || student.archived || year === String(student.birthYear)}>{busy ? "Сохраняем…" : "Сохранить год рождения"}</button>
    {error && <p role="alert" className="cabinet-error">{error}</p>}{success && <p role="status">Год рождения сохранён.</p>}
  </form>;
}
