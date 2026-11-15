import { useState } from "react";
import { canClub, clubApi, type ClubStudent } from "../../../services/club";
import { useClub } from "./ClubProvider";
export default function ArchiveControls({ student, changed }: { student: ClubStudent; changed: () => Promise<void> }) {
  const { data, error: connectionError } = useClub(); const restore = student.archived; const allowed = canClub(data, restore ? "students.restore" : "students.archive");
  const [reason, setReason] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  if (!allowed) return null;
  async function submit() {
    if (busy || !reason.trim() || !allowed) return; setBusy(true); setError("");
    try { await clubApi.archive(student.id, student.version, reason.trim(), restore); await changed(); setReason(""); }
    catch (error) { setError(error instanceof Error ? error.message : "Не удалось изменить архивное состояние."); } finally { setBusy(false); }
  }
  return <section className="cabinet-notice"><h3>{restore ? "Восстановление ученика" : "Архивирование ученика"}</h3><p>{restore ? "Вернётся прежний учебный статус. Заявки, оплаты и история сохранятся." : "Карточка исчезнет из рабочих списков. Статус обучения, заявки, оплаты и история сохранятся в архиве."}</p>
    <label>Причина {restore ? "восстановления" : "архивирования"}<textarea value={reason} maxLength={500} onChange={event => setReason(event.target.value)} disabled={busy} /></label>
    <button className="button-secondary" type="button" disabled={busy || !!connectionError || !reason.trim()} onClick={() => void submit()}>{busy ? "Сохраняем…" : restore ? "Восстановить из архива" : "Перенести в архив"}</button>{error && <p role="alert" className="cabinet-error">{error}</p>}
  </section>;
}
