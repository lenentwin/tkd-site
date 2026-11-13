import { Link } from "react-router-dom";
import { useContent } from "../../app/providers/ContentProvider";
import MediaFrame from "../../components/presentation/MediaFrame";
import Icon from "../../components/presentation/Icon";
import type { CoachItem } from "../../types/content";
import { DisplayText } from "../../components/presentation/DisplayText";

export function CoachPortrait({
  coach,
  expanded = false,
}: {
  coach: CoachItem;
  expanded?: boolean;
}) {
  const { content } = useContent();
  const media = content.media.find(
    (item) => item.id === coach.mediaId && item.visible,
  );
  const belt = coach.qualifications.find((item) => /дан/i.test(item));
  return (
    <article className={`coach-presentation ${expanded ? "is-expanded" : ""}`}>
      <div className="coach-portrait">
        <MediaFrame item={media} variant={3} showLabel={false} />
        <div className="coach-portrait-caption">
          <span><DisplayText text={coach.experience} /></span>
          {belt ? (
            <strong><DisplayText text={belt.replace(/ч[её]рный пояс\s*/i, "")} /></strong>
          ) : null}
        </div>
      </div>
      <div className="coach-copy">
        <p className="coach-role"><DisplayText text={coach.role} /></p>
        {expanded ? <h2><DisplayText text={coach.name} /></h2> : <h3><DisplayText text={coach.name} /></h3>}
        <div className="coach-qualifications">
          {coach.qualifications.map((qualification) => (
            <span key={qualification}><DisplayText text={qualification} /></span>
          ))}
        </div>
        <p className="coach-biography"><DisplayText text={coach.bio} /></p>
        {!expanded ? (
          <Link className="text-link" to="/coach">
            Подробнее о тренере
            <Icon name="arrow" />
          </Link>
        ) : null}
      </div>
    </article>
  );
}

export default function CoachSection() {
  const { content } = useContent();
  const section = content.sections.find((item) => item.id === "coach");
  const coach = content.coaches[0];
  if (!coach) return null;
  return (
    <section className="coach-section section-space" id="coach">
      <div className="container">
        <div className="coach-section-heading">
          <p><DisplayText text={section?.intro || "Главный тренер"} /></p>
          <h2><DisplayText text={section?.title || ""} /></h2>
        </div>
        <CoachPortrait coach={coach} />
      </div>
    </section>
  );
}
