import { Link } from "react-router-dom";
import { usePwa } from "../../pwa/runtime";
import { LEGAL_DOCUMENTS } from "../../legal/documents";
import { legalPaths, type LegalDocumentType } from "../../services/legal";
import LegalMarkdown from "./LegalMarkdown";
import "./legal.css";

export default function LegalDocumentPage({ type }: { type: LegalDocumentType }) {
  const { online } = usePwa();
  const document = LEGAL_DOCUMENTS.find((item) => item.type === type);
  if (!document) return <main id="main" className="page-shell container legal-page"><h1>Документ временно недоступен</h1><p>Попробуйте открыть страницу позже или обратитесь в клуб.</p><Link className="button-secondary" to="/contacts">Контакты клуба</Link></main>;
  return <main id="main" className="page-shell container legal-page">
    {!online ? <p className="legal-notice" role="status">Не удалось проверить актуальность документа: подключение к интернету отсутствует. Сохранённый текст можно прочитать; перед подтверждением подключитесь к интернету и проверьте действующую редакцию.</p> : null}
    <nav className="legal-navigation" aria-label="Юридические документы">
      {LEGAL_DOCUMENTS.map((item) => <Link key={item.type} to={legalPaths[item.type]} aria-current={item.type === type ? "page" : undefined}>{item.title}</Link>)}
    </nav>
    <header className="legal-page-header">
      <h1>{document.title}</h1>
      <p className="legal-version">Версия {document.version}</p>
      {document.status === "draft" ? <p className="legal-notice" role="note"><strong>Черновик для согласования.</strong> Документ пока не утверждён. Ознакомление с текстом не означает предоставление согласия; подтверждение этой редакции недоступно.</p> : <p className="legal-version">Утверждённая редакция</p>}
    </header>
    <article aria-label={document.title}><LegalMarkdown content={document.content} omitTitle /></article>
    <div className="legal-actions"><Link className="button-secondary" to="/">На главную</Link><Link className="text-link" to="/contacts">Связаться с клубом</Link></div>
  </main>;
}
