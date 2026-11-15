import { useEffect, useRef } from "react";
import { applyPwaUpdate, closeInstallHelp, dismissPwaUpdate, installPlatform, installPwa, showPwaUpdate, usePwa } from "./runtime";
import "./pwa.css";

export function PwaFooterAction() {
  const pwa = usePwa();
  if (!pwa.supported) return null;
  if (pwa.updateReady) return <button type="button" className="pwa-footer-action" onClick={showPwaUpdate}>Обновить MFT39</button>;
  if (pwa.standalone || pwa.installed) return null;
  return <button type="button" className="pwa-footer-action" disabled={pwa.installing} onClick={() => void installPwa()}>{pwa.installing ? "Открываем установку…" : "Установить MFT39"}</button>;
}

export function PwaStatus() {
  const pwa = usePwa(); const dialog = useRef<HTMLDialogElement>(null);
  const platform = installPlatform(navigator.userAgent, navigator.maxTouchPoints);
  useEffect(() => {
    if (pwa.installHelp && !dialog.current?.open) dialog.current?.showModal();
    if (!pwa.installHelp && dialog.current?.open) dialog.current.close();
  }, [pwa.installHelp]);
  return <>
    <div className="pwa-notices">
      {!pwa.online && <section className="pwa-notice" role="status" aria-label="Нет подключения">
        <strong>Вы без интернета</strong><p>Публичная информация доступна из сохранённой версии сайта. Вход, заявки, данные кабинета, карты и видео требуют подключения.</p>
      </section>}
      {pwa.online && pwa.updateReady && pwa.updateVisible && <section className="pwa-notice" role="status" aria-label="Обновление MFT39">
        <strong>Доступна новая версия MFT39</strong><p>Обновление перезагрузит эту страницу. Сначала завершите работу: несохранённые поля будут очищены.</p>
        <div className="pwa-actions"><button type="button" className="button" disabled={pwa.applying} onClick={applyPwaUpdate}>{pwa.applying ? "Обновляем…" : "Обновить"}</button><button type="button" className="button-secondary" disabled={pwa.applying} onClick={dismissPwaUpdate}>Позже</button></div>
        {pwa.error && <p role="alert">{pwa.error}</p>}
      </section>}
    </div>
    <dialog ref={dialog} className="pwa-dialog" aria-labelledby="pwa-install-title" onClose={closeInstallHelp} onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
      <div className="pwa-dialog-heading"><h2 id="pwa-install-title">MFT39 под рукой</h2><button type="button" aria-label="Закрыть инструкцию установки" onClick={() => dialog.current?.close()}>×</button></div>
      <p>Тот же сайт с отдельной иконкой и собственным окном.</p>
      <section aria-label="Инструкция для устройства">
        {platform === "ios" ? <><h3>На iPhone и iPad</h3><ol><li>Откройте mft39.ru в Safari.</li><li>Нажмите «Поделиться» и выберите «На экран Домой».</li><li>Если есть переключатель «Открывать как веб-приложение», оставьте его включённым и нажмите «Добавить».</li></ol></>
          : platform === "android" ? <><h3>На Android</h3><ol><li>Откройте mft39.ru в Chrome.</li><li>Откройте меню ⋮ и выберите «Установить приложение» или «Добавить на главный экран».</li><li>Подтвердите установку MFT39.</li></ol></>
            : <><h3>На компьютере</h3><p>В Chrome или Edge нажмите значок установки в адресной строке либо найдите «Установить MFT39» в меню браузера. В Safari на Mac: «Файл» → «Добавить в Dock».</p></>}
      </section>
      <p className="pwa-help-note">Доступность и названия пунктов зависят от браузера. Если установки нет, сайт продолжает работать в обычной вкладке. Для Яндекс ID, записи, учеников и оплат нужен интернет.</p>
      {pwa.error && <p role="alert">{pwa.error}</p>}
      <button type="button" className="button-secondary" onClick={() => dialog.current?.close()}>Понятно</button>
    </dialog>
  </>;
}
