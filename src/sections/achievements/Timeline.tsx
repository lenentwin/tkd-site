import { Link } from "react-router-dom";
import { useContent } from "../../app/providers/ContentProvider";
import MediaFrame from "../../components/presentation/MediaFrame";
import Icon from "../../components/presentation/Icon";
import { DisplayText } from "../../components/presentation/DisplayText";

export default function Timeline({ compact = false }: { compact?: boolean }) {
  const { content } = useContent();
  const events = compact ? content.events.slice(0, 3) : content.events;
  return (
    <div className={`timeline ${compact ? "is-compact" : ""}`}>
      <div className="timeline-heading">
        <h3>Соревнования и события</h3>
        {compact ? (
          <Link className="text-link" to="/achievements">
            Вся хронология
            <Icon name="arrow" />
          </Link>
        ) : null}
      </div>
      <div className="timeline-events">
        {events.map((event) => {
          const media = content.media.find(
            (item) => item.id === event.mediaId && item.visible,
          );
          return (
            <details className="timeline-event" key={event.id}>
              <summary>
                <span className="event-year"><DisplayText text={event.year} /></span>
                <h4><DisplayText text={event.title} /></h4>
                <span className="event-expand">
                  <Icon name="plus" />
                </span>
              </summary>
              <div className="event-description">
                <p><DisplayText text={event.description} /></p>
                {media ? <MediaFrame item={media} /> : null}
              </div>
            </details>
          );
        })}
      </div>
      {!events.length ? (
        <p className="empty-state">События пока не добавлены.</p>
      ) : null}
    </div>
  );
}
