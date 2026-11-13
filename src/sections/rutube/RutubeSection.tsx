import { useState } from "react";
import { Link } from "react-router-dom";
import { useContent } from "../../app/providers/ContentProvider";
import { getRutubeEmbed } from "../../services/integrations";
import { SectionHeading } from "../../components/presentation/SectionHeading";
import MediaFrame from "../../components/presentation/MediaFrame";
import Icon from "../../components/presentation/Icon";
import { DisplayText, formatDisplayText } from "../../components/presentation/DisplayText";

export function ClubChannels() {
  const { content } = useContent();
  const channels = [
    {
      name: "RuTube",
      kind: "Официальный канал",
      description: "Видео клуба",
      url: content.video.channelUrl,
      action: "Открыть канал",
      label: "Открыть канал клуба на RuTube",
      className: "channel-rutube",
    },
    {
      name: "ВКонтакте",
      kind: "Официальное сообщество",
      description: "Новости и общение с командой",
      url: content.contacts.vkUrl,
      action: "Перейти в сообщество",
      label: "Открыть сообщество клуба ВКонтакте",
      className: "channel-vk",
    },
  ];
  return (
    <div
      className="club-channels"
      role="group"
      aria-label="Официальные каналы клуба"
    >
      {channels.map((channel) =>
        channel.url ? (
          <a
            className={`club-channel-link ${channel.className}`}
            key={channel.name}
            href={channel.url}
            target="_blank"
            rel="noreferrer"
            aria-label={channel.label}
          >
            <span className="channel-kind"><DisplayText text={channel.kind} /></span>
            <strong><DisplayText text={channel.name} /></strong>
            <span className="channel-description"><DisplayText text={channel.description} /></span>
            <span className="channel-action">
              <DisplayText text={channel.action} />
              <Icon name="external" />
            </span>
          </a>
        ) : (
          <div
            className={`club-channel-link channel-unavailable ${channel.className}`}
            key={channel.name}
          >
            <span className="channel-kind"><DisplayText text={channel.kind} /></span>
            <strong><DisplayText text={channel.name} /></strong>
            <span className="channel-description">
              Ссылка пока не добавлена
            </span>
          </div>
        ),
      )}
    </div>
  );
}

export function ClubVideo() {
  const { content } = useContent();
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const video = content.video;
  const embed = getRutubeEmbed(video.videoUrl);
  const poster = content.media.find(
    (item) => item.id === video.posterMediaId && item.visible,
  );
  return (
    <div className="club-video">
      <div className="video-surface">
        {playing && embed && !failed ? (
          <iframe
            src={embed}
            title={formatDisplayText(`Видео: ${video.channelName}`)}
            loading="lazy"
            allow="fullscreen; picture-in-picture"
            allowFullScreen
            onError={() => setFailed(true)}
          />
        ) : (
          <>
            <div className="video-background">
              {poster ? (
                <MediaFrame item={poster} showLabel={false} />
              ) : (
                <div className="video-placeholder-art" aria-hidden="true">
                  <span className="video-court" />
                  <span className="video-court-line" />
                </div>
              )}
            </div>
            <div className="video-overlay">
              <span className="rutube-wordmark">
                <i />
                RuTube
              </span>
              <h3><DisplayText text={video.channelName} /></h3>
              {embed ? (
                <button
                  className="video-play"
                  type="button"
                  onClick={() => {
                    setPlaying(true);
                    setFailed(false);
                  }}
                  aria-label="Включить выбранное видео клуба"
                >
                  <Icon name="play" />
                </button>
              ) : (
                <span className="video-empty-label">
                  {import.meta.env.DEV ? "Здесь будет выбранный ролик клуба" : "Смотрите видео на официальном канале"}
                </span>
              )}
              <span className="video-subtitle">Тхэквондо в кадре</span>
            </div>
          </>
        )}
      </div>
      <div className="video-description">
        <p>
          <DisplayText text={failed
            ? "Встроенный плеер недоступен. Откройте видео на RuTube."
            : video.description} />
        </p>
        {video.videoUrl ? (
          <div>
            <a
              className="text-link"
              href={video.videoUrl}
              target="_blank"
              rel="noreferrer"
            >
              Смотреть на RuTube
              <Icon name="external" />
            </a>
          </div>
        ) : null}
      </div>
      <ClubChannels />
    </div>
  );
}

export default function RutubeSection() {
  const { content } = useContent();
  const section = content.sections.find((item) => item.id === "rutube");
  return (
    <section className="rutube-section section-space" id="rutube">
      <div className="container">
        <SectionHeading
          title={section?.title || "Видео клуба"}
          intro={section?.intro}
          aside={
            <Link className="text-link" to="/rutube">
              Видеоматериалы
              <Icon name="arrow" />
            </Link>
          }
        />
        <ClubVideo />
      </div>
    </section>
  );
}
