import { useCallback, useState, type FormEvent } from "react";
import { clubApi } from "../../services/club";
import { useAuth } from "../../app/providers/AuthProvider";
import { useResource } from "./club/useResource";

export const roleLabels = { user: "Пользователь", trainer: "Тренер", head_trainer: "Главный тренер", admin: "Администратор" };
type ProfileData = Awaited<ReturnType<typeof clubApi.profile>>["profile"];
function ProfileForm({ profile, saved }: { profile: ProfileData; saved: () => Promise<void> }) {
  const [firstName, setFirst] = useState(profile.firstName); const [lastName, setLast] = useState(profile.lastName); const [middleName, setMiddle] = useState(profile.middleName);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [success, setSuccess] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy) return; setBusy(true); setError(""); setSuccess(false);
    try { await clubApi.saveProfile(firstName.trim(), lastName.trim(), middleName.trim(), profile.version); await saved(); setSuccess(true); }
    catch (error) { setError(error instanceof Error ? error.message : "Не удалось сохранить профиль."); }
    finally { setBusy(false); }
  }
  return <form className="cabinet-form" onSubmit={event => void submit(event)} aria-busy={busy}>
    <fieldset disabled={busy}><legend>Ваше ФИО</legend><div className="cabinet-field-grid">
      <label>Фамилия<input name="lastName" autoComplete="family-name" required maxLength={80} value={lastName} onChange={e => { setLast(e.target.value); setSuccess(false); }} /></label>
      <label>Имя<input name="firstName" autoComplete="given-name" required maxLength={80} value={firstName} onChange={e => { setFirst(e.target.value); setSuccess(false); }} /></label>
      <label>Отчество (необязательно)<input name="middleName" autoComplete="additional-name" maxLength={80} value={middleName} onChange={e => { setMiddle(e.target.value); setSuccess(false); }} /></label>
    </div><p className="cabinet-small">Имя первоначально берётся из Яндекс ID, если вы разрешили его передачу. Здесь можно уточнить ФИО. Тренер увидит его рядом с карточкой связанного ученика.</p>
    <button className="button" type="submit" disabled={busy}>{busy ? "Сохраняем…" : "Сохранить ФИО"}</button></fieldset>
    {error && <p role="alert" className="cabinet-error">{error}</p>}{success && <p role="status">Профиль сохранён на сервере.</p>}
  </form>;
}
export default function ProfilePage() {
  const { session, refresh } = useAuth(); const load = useCallback(() => clubApi.profile(), []); const profile = useResource(load, session?.mode === "server");
  if (!session) return null;
  const staff = session.mode === "server" && session.role !== "user";
  return <><h1>Мои данные</h1><p className="cabinet-intro">Это ваш профиль. Сведения об учениках хранятся отдельно в разделе «Мои тренировки».</p>
    <dl className="cabinet-profile"><div><dt>Имя</dt><dd>{session.displayName}</dd></div><div><dt>Способ входа</dt><dd>{session.mode === "server" ? "Яндекс ID" : "Локальная демонстрация"}</dd></div>
      {staff && <><div><dt>Номер аккаунта MFT39</dt><dd>{session.id}</dd></div><div><dt>Роль</dt><dd>{roleLabels[session.role]}</dd></div></>}
    </dl>
    {profile.busy && <p role="status">Загружаем профиль…</p>}
    {profile.error && <div role="alert"><p className="cabinet-error">{profile.error}</p><button className="text-link" onClick={() => void profile.reload()}>Повторить загрузку профиля</button></div>}
    {profile.data && <ProfileForm profile={profile.data.profile} saved={async () => { await Promise.all([profile.reload(), refresh()]); }} />}
  </>;
}
