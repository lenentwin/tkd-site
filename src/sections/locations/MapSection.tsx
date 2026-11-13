import { useEffect, useRef, useState } from "react";
import { useContent } from "../../app/providers/ContentProvider";
import { getMapLink, getYandexEmbed } from "../../services/integrations";
import { SectionHeading } from "../../components/presentation/SectionHeading";
import Icon from "../../components/presentation/Icon";
import type { LocationItem } from "../../types/content";
import { DisplayText, formatDisplayText } from "../../components/presentation/DisplayText";

function YandexMapFrame({ location }: { location: LocationItem }) {
  const container = useRef<HTMLDivElement>(null);
  const [nearViewport, setNearViewport] = useState(false);
  const [status, setStatus] = useState<"loading" | "ready" | "slow" | "error">(
    "loading",
  );
  const [attempt, setAttempt] = useState(0);
  const src = getYandexEmbed(location);
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setNearViewport(true);
        observer.disconnect();
      },
      { rootMargin: "200px 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!nearViewport || !src) return;
    const timer = window.setTimeout(
      () => setStatus((current) => (current === "loading" ? "slow" : current)),
      15000,
    );
    return () => window.clearTimeout(timer);
  }, [nearViewport, src, attempt]);
  useEffect(() => {
    const offline = () => setStatus("error");
    const online = () => {
      setStatus("loading");
      setAttempt((current) => current + 1);
    };
    window.addEventListener("offline", offline);
    window.addEventListener("online", online);
    return () => {
      window.removeEventListener("offline", offline);
      window.removeEventListener("online", online);
    };
  }, []);
  function retry() {
    setStatus("loading");
    setAttempt((current) => current + 1);
  }
  return (
    <div
      className="yandex-map-frame"
      ref={container}
      aria-busy={nearViewport && status === "loading"}
    >
      {src && nearViewport ? (
        <iframe
          key={attempt}
          src={src}
          title={formatDisplayText("Яндекс Карты — " + location.name)}
          loading="lazy"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          onLoad={() => setStatus(navigator.onLine ? "ready" : "error")}
          onError={() => setStatus("error")}
        />
      ) : null}
      {!src ? (
        <div className="map-embed-unavailable">
          <Icon name="pin" />
          <p>Встроенная карта для этой ссылки недоступна.</p>
          <p>Адрес и кнопка открытия Яндекс Карт находятся ниже.</p>
        </div>
      ) : !nearViewport || status === "loading" ? (
        <div className="map-embed-loading" role="status">
          <span className="map-loading-dot" aria-hidden="true" />
          <p>
            {nearViewport
              ? "Загружаем Яндекс Карту…"
              : "Яндекс Карта выбранного зала"}
          </p>
        </div>
      ) : null}
      {status === "slow" || status === "error" ? (
        <div className="map-embed-error" role="status">
          <p>
            {status === "slow"
              ? "Карта загружается дольше обычного."
              : "Не удалось загрузить карту."}{" "}
            Адрес и внешняя ссылка остаются доступны ниже.
          </p>
          <button
            className="button button-secondary"
            type="button"
            onClick={retry}
          >
            Попробовать снова
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default function MapSection() {
  const { content } = useContent();
  const section = content.sections.find((item) => item.id === "map");
  const [selectedId, setSelectedId] = useState(content.locations[0]?.id);
  const selected =
    content.locations.find((location) => location.id === selectedId) ||
    content.locations[0];
  if (!selected) return null;
  const mapLink = getMapLink(selected, "yandex");
  return (
    <section className="map-section section-space" id="map">
      <div className="container">
        <SectionHeading
          title={section?.title || "Найдите свой зал"}
          intro={section?.intro}
        />
        <div className="map-panel map-panel-embedded">
          <div className="map-selector">
            <p className="map-selector-caption">Выберите площадку</p>
            <div
              className="location-options"
              role="group"
              aria-label="Выбор зала"
            >
              {content.locations.map((location, index) => (
                <button
                  type="button"
                  key={location.id}
                  className={
                    "location-option " +
                    (selected.id === location.id ? "is-selected" : "")
                  }
                  aria-pressed={selected.id === location.id}
                  onClick={() => setSelectedId(location.id)}
                >
                  <span className="location-option-pin">
                    <Icon name="pin" />
                  </span>
                  <span>
                    <strong><DisplayText text={location.name} /></strong>
                    <span><DisplayText text={location.address} /></span>
                  </span>
                  <span className="location-option-index" aria-hidden="true">
                    {index + 1}
                  </span>
                </button>
              ))}
            </div>
            <p className="small-note">Все площадки находятся в Калининграде.</p>
          </div>
          <div className="map-canvas-column">
            <div className="map-canvas-heading">
              <span>Карта выбранного зала</span>
              <strong>Яндекс Карты</strong>
            </div>
            <YandexMapFrame
              key={selected.id + ":" + selected.yandexUrl}
              location={selected}
            />
          </div>
          <div
            className="map-location-detail map-selected-summary"
            aria-live="polite"
          >
            <div className="map-summary-heading">
              <span className="map-symbol" aria-hidden="true">
                <Icon name="pin" />
              </span>
              <h3><DisplayText text={selected.name} /></h3>
              <p className="map-address"><DisplayText text={selected.address} /></p>
            </div>
            <dl>
              <div>
                <dt>Часы площадки</dt>
                <dd><DisplayText text={selected.hours} /></dd>
              </div>
              <div>
                <dt>Тренировки</dt>
                <dd><DisplayText text={selected.schedule} /></dd>
              </div>
            </dl>
            <div className="map-summary-actions">
              {mapLink ? (
                <a
                  className="button"
                  href={mapLink}
                  target="_blank"
                  rel="noreferrer"
                >
                  Открыть в Яндекс Картах
                  <Icon name="external" />
                </a>
              ) : (
                <p className="map-external-unavailable">
                  Ссылка на Яндекс Карты пока не добавлена. Используйте
                  указанный адрес.
                </p>
              )}
              <p className="map-external-note">
                Если встроенная карта недоступна, откройте выбранный зал в
                Яндекс Картах. Часы площадки отличаются от расписания
                тренировок.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
