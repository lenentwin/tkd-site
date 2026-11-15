import { useEffect, useId, useRef } from "react";
import { Link } from "react-router-dom";
import { legalPaths, type LegalDocument } from "../../services/legal";
import LegalMarkdown from "./LegalMarkdown";
import "./legal.css";

export default function LegalDocumentReader({ document, onRead }: { document: LegalDocument; onRead?: () => void }) {
  const labelId = useId();
  const hintId = useId();
  const reader = useRef<HTMLDivElement>(null);
  const notified = useRef(false);
  const callback = useRef(onRead);
  useEffect(() => { callback.current = onRead; }, [onRead]);
  useEffect(() => {
    const element = reader.current;
    if (!element) return;
    notified.current = false;
    const checkEnd = () => {
      if (!notified.current && element.clientHeight > 0 && element.scrollHeight - element.scrollTop - element.clientHeight <= 4) {
        notified.current = true; callback.current?.();
      }
    };
    checkEnd();
    element.addEventListener("scroll", checkEnd, { passive: true });
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(checkEnd) : null;
    observer?.observe(element);
    return () => { element.removeEventListener("scroll", checkEnd); observer?.disconnect(); };
  }, [document.type, document.version, document.hash]);
  return <section className="legal-reader">
    <div className="legal-reader-heading">
      <h2 id={labelId}>{document.title}</h2>
      <Link to={legalPaths[document.type]} target="_blank" rel="noopener noreferrer">Открыть на отдельной странице<span className="legal-sr-only"> (в новой вкладке)</span></Link>
    </div>
    {document.status === "draft" ? <p className="legal-notice" role="note">Черновик для согласования. Подтвердить эту редакцию пока нельзя.</p> : null}
    <p id={hintId} className="legal-reader-hint">Полный текст. Прокрутите документ до конца; с клавиатуры можно использовать Page Down или End.</p>
    <div ref={reader} tabIndex={0} role="region" aria-labelledby={labelId} aria-describedby={hintId} className="legal-reader-scroll">
      <LegalMarkdown content={document.content} embedded omitTitle />
      <p className="legal-document-end">Конец документа · версия {document.version}</p>
    </div>
  </section>;
}
