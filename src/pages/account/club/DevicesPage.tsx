import { useState } from "react";
import { clubApi } from "../../../services/club";
import { ClubConnection, useClub } from "./ClubProvider";
import { useResource } from "./useResource";

export default function DevicesPage() {
  const club = useClub(); const result = useResource(clubApi.devices, !!club.data?.staff && !club.error); const [label, setLabel] = useState("");
  const [token, setToken] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  if (club.data && !club.data.staff) return <><h1>Доступ только для тренера</h1><p>Для подключения приложения нужна назначенная сервером роль.</p></>;
  async function create() {
    setBusy(true); setError(""); setToken(""); try { const value = await clubApi.createDevice(label); setToken(value.token); await result.reload(); }
    catch (error) { setError(error instanceof Error ? error.message : "Не удалось создать доступ."); } finally { setBusy(false); }
  }
  async function revoke(id: string) {
    setBusy(true); setError(""); try { await clubApi.revokeDevice(id); setToken(""); await result.reload(); }
    catch (error) { setError(error instanceof Error ? error.message : "Не удалось отозвать доступ."); } finally { setBusy(false); }
  }
  return <><p className="eyebrow">Личный кабинет тренера</p><h1>Доступ для приложения</h1><ClubConnection /><p className="cabinet-intro">Доступ связан с вашим аккаунтом, действует 8 часов и учитывает текущие назначения залов. Ваша версия приложения должна поддерживать этот способ подключения.</p>
    <div className="club-details"><label>Название устройства<input value={label} maxLength={80} onChange={event => setLabel(event.target.value)} /></label><button className="button" disabled={busy || !label.trim() || !club.data?.staff || !!club.error} onClick={() => void create()}>Создать доступ</button>
      {token && <div className="cabinet-notice"><p>Ключ показывается только здесь и не сохраняется в браузере. Не передавайте его другим людям.</p><label>Ключ доступа<textarea readOnly autoComplete="off" value={token} /></label><button className="text-link" onClick={() => setToken("")}>Скрыть ключ</button></div>}
    </div>{(error || result.error) && <p role="alert">{error || result.error}</p>}
    <div className="club-list">{result.data?.items.map(device => <article key={device.id}><h3>{device.label}</h3><p>{device.revoked_at ? "Доступ отозван" : device.expires_at * 1000 <= Date.now() ? "Срок истёк" : `Действует до ${new Date(device.expires_at * 1000).toLocaleString("ru-RU")}`}</p><button className="button-secondary" disabled={busy || !!device.revoked_at} onClick={() => void revoke(device.id)}>Отозвать доступ</button></article>)}</div>
  </>;
}
