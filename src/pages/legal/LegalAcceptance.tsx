import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { LEGAL_DOCUMENTS } from "../../legal/documents";
import { ClubError } from "../../services/club";
import { accountLegalTypes, legalApi, legalPaths, matchingApprovedDocument, pendingAccountDocuments, type LegalState } from "../../services/legal";
import LegalDocumentReader from "./LegalDocumentReader";
import "./legal.css";

function message(error: unknown): string {
  if (error instanceof ClubError) {
    if (error.code === "legal_migration_required") return "Механизм подтверждения документов временно недоступен. Обратитесь в клуб или повторите попытку позже.";
    if (error.status === 401) return "Сессия завершилась. Войдите снова.";
    if (["legal_version_changed", "legal_document_changed", "version_conflict", "legal_confirmation_required"].includes(error.code)) return "Редакция документов изменилась. Обновите список и прочитайте актуальные тексты.";
    if (["legal_draft", "legal_not_approved", "legal_unavailable", "legal_documents_unavailable"].includes(error.code)) return "Документы ещё не утверждены. Подтвердить черновик нельзя.";
  }
  return "Не удалось проверить или сохранить подтверждение. Проверьте подключение и повторите попытку.";
}

export default function LegalAcceptance({ onAccepted, onSignOut }: { onAccepted: () => Promise<void>; onSignOut: () => Promise<void> }) {
  const [state, setState] = useState<LegalState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [generation, setGeneration] = useState(0);
  const [read, setRead] = useState<string[]>([]);
  const [checked, setChecked] = useState<string[]>([]);
  useEffect(() => {
    let active = true;
    void legalApi.state().then((result) => { if (active) { setState(result); setLoading(false); } }, (failure: unknown) => { if (active) { setError(message(failure)); setLoading(false); } });
    return () => { active = false; };
  }, [generation]);
  const pending = state ? pendingAccountDocuments(state) : [];
  const complete = state && accountLegalTypes.every((type) => state.documents.some((document) => document.type === type));
  const matches = pending.map((metadata) => ({ metadata, document: matchingApprovedDocument(metadata, LEGAL_DOCUMENTS) }));
  const available = Boolean(state?.canAccept && complete && pending.length > 0 && matches.every(({ document }) => Boolean(document)));
  const ready = available && pending.every((document) => checked.includes(document.type));
  function retry() {
    setLoading(true); setError(""); setState(null); setRead([]); setChecked([]); setGeneration((value) => value + 1);
  }
  async function accept() {
    if (!ready || busy) return;
    setBusy(true); setError("");
    try {
      const result = await legalApi.accept(pending.map(({ type, version, hash }) => ({ type, version, hash, accepted: true })));
      setState(result); setChecked([]); setRead([]);
      if (result.required) { setError("Подтверждение не завершено. Проверьте актуальные документы и повторите действие."); return; }
      await onAccepted();
    } catch (failure) { setError(message(failure)); }
    finally { setBusy(false); }
  }
  async function signOut() {
    setBusy(true); setError("");
    try { await onSignOut(); } catch { setError("Не удалось выйти из аккаунта. Проверьте подключение и повторите попытку."); }
    finally { setBusy(false); }
  }
  return <main id="main" className="page-shell container legal-page legal-acceptance">
    <h1>Документы для личного кабинета</h1>
    <p>Перед использованием кабинета ознакомьтесь с актуальными документами. Пользовательское соглашение и согласие на обработку ваших данных подтверждаются отдельно.</p>
    <p><Link className="text-link" to="/legal/privacy" target="_blank" rel="noopener noreferrer">Политика обработки персональных данных (в новой вкладке)</Link></p>
    {loading ? <p role="status">Проверяем редакции документов…</p> : null}
    {error ? <p role="alert" className="legal-notice">{error}</p> : null}
    {!loading && state && !state.required ? <div className="legal-notice"><p>Документы подтверждены. Проверяем доступ к кабинету.</p><button className="text-link" disabled={busy} onClick={() => void onAccepted().catch(() => setError("Не удалось проверить доступ. Повторите попытку."))}>Повторить проверку доступа</button></div> : null}
    {!loading && state?.required && !available ? <p role="status" className="legal-notice">Подтверждение пока недоступно: документы ещё не утверждены или редакция в браузере отличается от серверной. Можно прочитать публичные тексты. Доступ к кабинету откроется после утверждения и подтверждения актуальных документов.</p> : null}
    {!loading && state?.required ? <div className="legal-acceptance-documents">
      {matches.map(({ metadata, document }) => <section key={`${metadata.type}-${metadata.version}-${metadata.hash}`} className="legal-consent-section">
        {document ? <LegalDocumentReader document={document} onRead={() => setRead((value) => value.includes(metadata.type) ? value : [...value, metadata.type])} /> : <div><h2>{metadata.title}</h2><p>Версия {metadata.version} · {metadata.status === "draft" ? "Черновик" : "Текст требует обновления"}</p></div>}
        <label className="legal-checkbox"><input type="checkbox" checked={checked.includes(metadata.type)} disabled={!available || !read.includes(metadata.type) || busy} onChange={(event) => setChecked((value) => event.target.checked ? [...value, metadata.type] : value.filter((type) => type !== metadata.type))} /><span>{metadata.type === "terms" ? "Я прочитал(а) и принимаю Пользовательское соглашение" : "Я прочитал(а) согласие и даю согласие на обработку моих персональных данных"}</span></label>
        {document && !read.includes(metadata.type) ? <p className="legal-reader-hint">Подтверждение станет доступно после просмотра полного текста до конца.</p> : null}
      </section>)}
    </div> : null}
    <div className="legal-actions">
      {state?.required ? <button className="button" type="button" disabled={!ready || busy || loading} onClick={() => void accept()}>{busy ? "Сохраняем…" : "Подтвердить и открыть кабинет"}</button> : null}
      {!loading ? <button className="button-secondary" type="button" disabled={busy} onClick={retry}>Обновить документы</button> : null}
      <Link className="button-secondary" to="/">На главную</Link>
      <button className="text-link" type="button" disabled={busy} onClick={() => void signOut()}>Выйти из аккаунта</button>
    </div>
    <nav className="legal-navigation" aria-label="Все юридические документы">{LEGAL_DOCUMENTS.map((document) => <Link key={document.type} to={legalPaths[document.type]}>{document.title}</Link>)}</nav>
  </main>;
}
