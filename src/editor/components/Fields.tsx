import { useEffect, useState, type ChangeEvent } from "react";

const labels: Record<string, string> = {
  shortName: "Краткое название",
  fullName: "Полное название",
  motto: "Девиз",
  description: "Описание",
  bookingLabel: "Текст кнопки записи",
  ageGroups: "Возрастные группы — по одной строке",
  title: "Заголовок",
  intro: "Вводный текст",
  enabled: "Показывать / включить",
  name: "Название / имя",
  address: "Адрес",
  hours: "Часы работы площадки",
  schedule: "Расписание тренировок",
  yandexUrl: "Ссылка Яндекс Карт",
  twoGisUrl: "Проверенная ссылка 2ГИС",
  role: "Должность",
  qualifications: "Квалификация — по одной строке",
  experience: "Тренерский стаж",
  bio: "Биография",
  mediaId: "ID фотографии",
  year: "Год",
  gold: "Золотые медали",
  silver: "Серебряные медали",
  bronze: "Бронзовые медали",
  note: "Пояснение к статистике",
  src: "Путь или ссылка изображения",
  alt: "Альтернативный текст",
  category: "Категория",
  aspectRatio: "Соотношение сторон",
  focalPoint: "Точка фокуса",
  x: "Фокус по горизонтали, %",
  y: "Фокус по вертикали, %",
  order: "Порядок",
  visible: "Показывать фотографию",
  usage: "Где используется",
  eventId: "ID связанного события",
  channelName: "Название канала",
  channelUrl: "Ссылка на канал",
  videoUrl: "Ссылка на выбранное видео",
  posterMediaId: "ID обложки",
  author: "Автор",
  quote: "Текст отзыва",
  originalUrl: "Ссылка на оригинал",
  confirmed: "Подтверждаю, что отзыв настоящий и согласован для публикации",
  phone: "Телефон",
  email: "Электронная почта",
  vkUrl: "Сообщество ВКонтакте",
  rutubeUrl: "Канал RuTube",
  defaultMode: "Исходная тема",
  accent: "Основной акцент",
  secondaryAccent: "Второй акцент",
  gridOpacity: "Прозрачность сетки",
  introDuration: "Длительность вступления, с",
  transitionDuration: "Длительность переходов, с",
  rotateSpeed: "Скорость вращения",
  inertia: "Инерция",
  tilt: "Наклон, °",
  radius: "Радиус карусели, px",
  percent: "Скидка, %",
  details: "Условия",
};
const choices: Record<string, [string, string][]> = {
  defaultMode: [
    ["dark", "Тёмная"],
    ["light", "Светлая"],
  ],
  aspectRatio: [
    ["1:1", "Квадрат 1:1"],
    ["1:2", "Вертикальный 1:2"],
  ],
  usage: [
    ["hero", "Главный экран"],
    ["gallery", "Галерея"],
    ["coach", "Тренер"],
  ],
};
const ranges: Record<string, [number, number, number]> = {
  gridOpacity: [0, 0.3, 0.01],
  introDuration: [2.8, 3.2, 0.05],
  transitionDuration: [0.15, 0.8, 0.05],
  rotateSpeed: [0, 0.12, 0.002],
  inertia: [0.8, 0.99, 0.01],
  tilt: [0, 12, 1],
  radius: [180, 600, 10],
  x: [0, 100, 1],
  y: [0, 100, 1],
};

export function Field({
  name,
  value,
  onChange,
}: {
  name: string;
  value: string | number | boolean | string[];
  onChange: (value: unknown) => void;
}) {
  const textValue = Array.isArray(value) ? value.join("\n") : String(value);
  const [draft, setDraft] = useState(textValue);
  const [error, setError] = useState("");
  useEffect(() => {
    setDraft(textValue);
    setError("");
  }, [textValue]);
  function commit(next: unknown) {
    try {
      onChange(next);
      setError("");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Проверьте значение");
    }
  }
  const label = labels[name] ?? name;
  if (typeof value === "boolean")
    return (
      <label className="editor-check">
        <input
          type="checkbox"
          checked={value}
          onChange={(event) => commit(event.target.checked)}
        />
        <span>{label}</span>
      </label>
    );
  if (choices[name])
    return (
      <label className="editor-field">
        {label}
        <select
          aria-label={label}
          value={String(value)}
          onChange={(event) => commit(event.target.value)}
        >
          {choices[name].map(([key, title]) => (
            <option key={key} value={key}>
              {title}
            </option>
          ))}
        </select>
        {error && <small role="alert">{error}</small>}
      </label>
    );
  if (ranges[name]) {
    const [min, max, step] = ranges[name];
    return (
      <label className="editor-field">
        {label}
        <span className="editor-range">
          <input
            aria-label={label}
            type="range"
            min={min}
            max={max}
            step={step}
            value={Number(value)}
            onChange={(event) => commit(Number(event.target.value))}
          />
          <output>{value}</output>
        </span>
      </label>
    );
  }
  if (/accent/i.test(name))
    return (
      <label className="editor-field">
        {label}
        <input
          type="color"
          value={String(value)}
          onChange={(event) => commit(event.target.value)}
        />
      </label>
    );
  const commitOnBlur =
    typeof value === "number" || /Url$|^email$|^src$|Id$/.test(name);
  const multiline =
    Array.isArray(value) ||
    [
      "bio",
      "description",
      "intro",
      "schedule",
      "hours",
      "note",
      "quote",
      "details",
    ].includes(name);
  const inputProps = {
    "aria-label": label,
    value: draft,
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const next = event.target.value;
      setDraft(next);
      if (!commitOnBlur)
        commit(Array.isArray(value) ? next.split("\n").filter(Boolean) : next);
    },
    onBlur: () =>
      commit(
        typeof value === "number"
          ? Number(draft)
          : Array.isArray(value)
            ? draft.split("\n").filter(Boolean)
            : draft,
      ),
    "aria-invalid": !!error,
  };
  return (
    <label className="editor-field">
      {label}
      {multiline ? (
        <textarea rows={4} {...inputProps} />
      ) : (
        <input
          type={typeof value === "number" ? "number" : "text"}
          {...inputProps}
        />
      )}
      {error && <small role="alert">{error}</small>}
    </label>
  );
}

export function ObjectFields({
  value,
  path,
  onChange,
}: {
  value: Record<string, unknown>;
  path: (string | number)[];
  onChange: (path: (string | number)[], value: unknown) => void;
}) {
  return (
    <div className="editor-fields">
      {Object.entries(value)
        .filter(([key]) => key !== "id")
        .map(([key, item]) => {
          const nextPath = [...path, key];
          if (item !== null && typeof item === "object" && !Array.isArray(item))
            return (
              <fieldset className="editor-group" key={key}>
                <legend>{labels[key] ?? key}</legend>
                <ObjectFields
                  value={item as Record<string, unknown>}
                  path={nextPath}
                  onChange={onChange}
                />
              </fieldset>
            );
          if (
            typeof item === "string" ||
            typeof item === "number" ||
            typeof item === "boolean" ||
            (Array.isArray(item) &&
              item.every((entry) => typeof entry === "string"))
          )
            return (
              <Field
                key={key}
                name={key}
                value={item as string | number | boolean | string[]}
                onChange={(next) => onChange(nextPath, next)}
              />
            );
          return null;
        })}
    </div>
  );
}
