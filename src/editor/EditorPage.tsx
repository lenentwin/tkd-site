import { useState } from "react";
import { Link } from "react-router-dom";
import { useContent } from "../app/providers/ContentProvider";
import { defaultContent } from "../content/site.content";
import type { MediaItem, SiteContent } from "../types/content";
import { CollectionEditor } from "./components/CollectionEditor";
import { Field, ObjectFields } from "./components/Fields";
import { MediaControls } from "./components/MediaControls";
import { Preview } from "./components/Preview";
import {
  exportConfiguration,
  importConfiguration,
} from "./persistence/transfer";
import "./editor.css";

const tabs = [
  ["brand", "Название и тексты"],
  ["sections", "Разделы"],
  ["locations", "Залы и условия"],
  ["coaches", "Тренеры"],
  ["events", "Победы и турниры"],
  ["media", "Фотографии"],
  ["video", "Видео и отзывы"],
  ["contacts", "Контакты"],
  ["theme", "Оформление и движение"],
  ["pages", "Страницы и SEO"],
] as const;
type Tab = (typeof tabs)[number][0];
type Path = (string | number)[];
function setValue(
  source: SiteContent,
  path: Path,
  value: unknown,
): SiteContent {
  const result = structuredClone(source);
  let cursor = result as unknown as Record<string | number, unknown>;
  for (const part of path.slice(0, -1))
    cursor = cursor[part] as Record<string | number, unknown>;
  cursor[path[path.length - 1]] = value;
  return result;
}
const newId = (prefix: string) =>
  `${prefix}-${crypto.randomUUID().slice(0, 8)}`;

export default function EditorPage() {
  const {
    content,
    replaceContent,
    save,
    reset,
    undo,
    redo,
    canUndo,
    canRedo,
    dirty,
    error,
    clearError,
  } = useContent();
  const [tab, setTab] = useState<Tab>("brand");
  const [notice, setNotice] = useState("");
  const [transferBusy, setTransferBusy] = useState(false);
  const [includeMedia, setIncludeMedia] = useState(true);
  function write(path: Path, value: unknown) {
    replaceContent(setValue(content, path, value));
    setNotice("");
  }
  function resetPanel() {
    const keys: (keyof SiteContent)[] =
      tab === "events"
        ? ["events", "medals"]
        : tab === "locations"
          ? ["locations", "ageGroups", "discounts"]
          : tab === "video"
            ? ["video", "reviews"]
            : tab === "theme"
              ? ["theme", "motion"]
              : [tab];
    const draft = structuredClone(content);
    for (const key of keys)
      Object.assign(draft, { [key]: structuredClone(defaultContent[key]) });
    replaceContent(draft);
    setNotice("Блок восстановлен. Действие можно отменить.");
  }
  async function exportData() {
    setTransferBusy(true);
    try {
      await exportConfiguration(content, includeMedia);
      setNotice(
        "Экспорт подготовлен. Файл содержит текущие изменения, включая несохранённые.",
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Экспорт не удался.");
    } finally {
      setTransferBusy(false);
    }
  }
  function mediaExtra(item: MediaItem, index: number) {
    return (
      <>
        <MediaControls
          item={item}
          onSource={(src) => write(["media", index, "src"], src)}
        />
        <Field
          name="eventId"
          value={item.eventId ?? ""}
          onChange={(value) => write(["media", index, "eventId"], value)}
        />
      </>
    );
  }
  const fields = (key: keyof SiteContent) => (
    <ObjectFields
      value={content[key] as unknown as Record<string, unknown>}
      path={[key]}
      onChange={write}
    />
  );
  return (
    <main id="main" className="editor-root">
      <header className="editor-header">
        <div>
          <Link className="editor-brand" to="/">
            {content.brand.shortName}
          </Link>
          <span>Локальная студия</span>
        </div>
        <div className="editor-toolbar">
          <span className={dirty ? "editor-unsaved" : "editor-saved"}>
            {dirty ? "Есть несохранённые изменения" : "Изменения сохранены"}
          </span>
          <button onClick={undo} disabled={!canUndo}>
            Отменить
          </button>
          <button onClick={redo} disabled={!canRedo}>
            Повторить
          </button>
          <button
            className="editor-primary"
            onClick={() => {
              if (save()) setNotice("Сохранено только в этом браузере.");
            }}
          >
            Сохранить
          </button>
          <Link to="/">На сайт</Link>
        </div>
      </header>
      <div className="editor-local-notice">
        Демонстрационный редактор без пароля. Изменения видны только в этом
        браузере и не публикуются для других посетителей. Не загружайте
        конфиденциальные материалы.
      </div>
      {(notice || error) && (
        <div className="editor-status" role="status">
          <span>{error || notice}</span>
          <button
            aria-label="Закрыть уведомление"
            onClick={() => {
              setNotice("");
              clearError();
            }}
          >
            ×
          </button>
        </div>
      )}
      <div className="editor-workspace">
        <aside className="editor-sidebar">
          <nav aria-label="Разделы редактора">
            {tabs.map(([key, label]) => (
              <button
                key={key}
                className={tab === key ? "is-active" : ""}
                onClick={() => {
                  setTab(key);
                  setNotice("");
                }}
              >
                {label}
              </button>
            ))}
          </nav>
          <div className="editor-transfer">
            <h2>Перенести настройки</h2>
            <label className="editor-check">
              <input
                type="checkbox"
                checked={includeMedia}
                onChange={(event) => setIncludeMedia(event.target.checked)}
              />
              С локальными изображениями
            </label>
            <button onClick={() => void exportData()} disabled={transferBusy}>
              {transferBusy ? "Подготовка…" : "Экспорт JSON"}
            </button>
            <label className="editor-file-button">
              Импорт JSON
              <input
                type="file"
                accept="application/json,.json"
                disabled={transferBusy}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  setTransferBusy(true);
                  void importConfiguration(file)
                    .then((next) => {
                      replaceContent(next);
                      setNotice(
                        "Конфигурация импортирована в предпросмотр. Проверьте её и сохраните.",
                      );
                    })
                    .catch((error: unknown) =>
                      setNotice(
                        error instanceof Error
                          ? error.message
                          : "Ошибка импорта",
                      ),
                    )
                    .finally(() => setTransferBusy(false));
                  event.target.value = "";
                }}
              />
            </label>
            <p>
              Без изображений ссылки idb: работают только в исходном браузере.
            </p>
            <button
              onClick={() => {
                reset();
                setNotice(
                  "Восстановлены исходные данные. Можно отменить или сохранить.",
                );
              }}
            >
              Сбросить всё
            </button>
          </div>
        </aside>
        <section
          className="editor-panel"
          aria-label="Редактирование содержимого"
        >
          <div className="editor-panel-title">
            <h1>{tabs.find(([key]) => key === tab)?.[1]}</h1>
            <button onClick={resetPanel}>Сбросить блок</button>
          </div>
          {tab === "brand" && (
            <>
              {fields("brand")}
              <p className="editor-help">
                Исходный девиз задан техническим заданием. Ваши изменения —
                явное локальное переопределение.
              </p>
            </>
          )}
          {tab === "sections" && (
            <>
              <p className="editor-help">
                Выберите раздел, отредактируйте текст, измените видимость или
                порядок стрелками. Исходный порядок соответствует разделу 11 ТЗ.
              </p>
              <CollectionEditor
                title="Блоки главной"
                items={content.sections}
                path="sections"
                onItems={(items) => write(["sections"], items)}
                onChange={write}
              />
            </>
          )}
          {tab === "locations" && (
            <>
              <CollectionEditor
                title="Залы"
                items={content.locations}
                path="locations"
                minItems={1}
                onItems={(items) => write(["locations"], items)}
                onChange={write}
                createItem={() => ({
                  id: newId("location"),
                  name: "Название новой площадки",
                  address: "Адрес уточняется",
                  hours: "Часы работы уточняются",
                  schedule: "Расписание уточняется у тренера",
                  yandexUrl: "",
                  twoGisUrl: "",
                })}
              />
              <Field
                name="ageGroups"
                value={content.ageGroups}
                onChange={(value) => write(["ageGroups"], value)}
              />
              <CollectionEditor
                title="Скидки"
                items={content.discounts}
                path="discounts"
                onItems={(items) => write(["discounts"], items)}
                onChange={write}
                createItem={() => ({
                  id: newId("discount"),
                  title: "Укажите подтверждённое предложение",
                  percent: 0,
                  details: "Условия уточняются у тренера",
                })}
              />
              <p className="editor-help">
                Часы работы площадки и расписание занятий — разные поля. Цены
                абонементов не публикуются.
              </p>
            </>
          )}
          {tab === "coaches" && (
            <CollectionEditor
              title="Тренеры"
              items={content.coaches}
              path="coaches"
              minItems={1}
              onItems={(items) => write(["coaches"], items)}
              onChange={write}
              createItem={() => ({
                id: newId("coach"),
                name: "Укажите имя тренера",
                role: "",
                qualifications: [],
                experience: "",
                bio: "",
                mediaId: "",
              })}
            />
          )}
          {tab === "events" && (
            <>
              <h2>Медальный зачёт</h2>
              {fields("medals")}
              <p className="editor-help">
                Всего{" "}
                {content.medals.gold +
                  content.medals.silver +
                  content.medals.bronze}
                . Доли пересчитываются автоматически на сайте.
              </p>
              <CollectionEditor
                title="События и турниры"
                items={content.events}
                path="events"
                onItems={(items) => write(["events"], items)}
                onChange={write}
                createItem={() => ({
                  id: newId("event"),
                  year: "",
                  title: "Название подтверждённого события",
                  description: "",
                  mediaId: "",
                })}
              />
            </>
          )}
          {tab === "media" && (
            <CollectionEditor
              title="Фотографии"
              items={content.media}
              path="media"
              onItems={(items) => write(["media"], items)}
              onChange={write}
              renderExtra={mediaExtra}
              createItem={(): MediaItem => ({
                id: newId("photo"),
                src: "",
                title: "Будущий кадр",
                alt: "Описание будущего кадра",
                category: "Тренировки",
                aspectRatio: "1:1",
                focalPoint: { x: 50, y: 50 },
                order: content.media.length,
                visible: true,
                usage: "gallery",
                eventId: "",
              })}
            />
          )}
          {tab === "video" && (
            <>
              <h2>RuTube</h2>
              {fields("video")}
              <p className="editor-help">
                Выбирайте конкретное видео вручную. Пустая ссылка показывает
                честную заглушку. Ролик не включается со звуком автоматически.
              </p>
              <CollectionEditor
                title="Подтверждённые отзывы"
                items={content.reviews}
                path="reviews"
                onItems={(items) => write(["reviews"], items)}
                onChange={write}
                createItem={() => ({
                  id: newId("review"),
                  author: "",
                  quote: "",
                  originalUrl: "",
                  confirmed: false,
                })}
              />
              <p className="editor-help">
                Отзыв показывается после подтверждения и добавления ссылки на
                оригинал. Не используйте вымышленные тексты или имена.
              </p>
            </>
          )}
          {tab === "contacts" && fields("contacts")}
          {tab === "theme" && (
            <>
              <h2>Цвет и тема</h2>
              {fields("theme")}
              <h2>Движение</h2>
              {fields("motion")}
              <p className="editor-help">
                Уменьшение движения в настройках устройства имеет приоритет.
                Включение анимации не должно задерживать запись на телефоне.
              </p>
            </>
          )}
          {tab === "pages" && (
            <>
              {Object.entries(content.pages).map(([path, value]) => (
                <fieldset className="editor-group" key={path}>
                  <legend>{path}</legend>
                  <ObjectFields
                    value={value}
                    path={["pages", path]}
                    onChange={write}
                  />
                </fieldset>
              ))}
              <p className="editor-help">
                Прототип закрыт от индексации. Перед публикацией потребуется
                prerender публичных страниц и проверка метаданных.
              </p>
            </>
          )}
        </section>
        <Preview content={content} />
      </div>
    </main>
  );
}
