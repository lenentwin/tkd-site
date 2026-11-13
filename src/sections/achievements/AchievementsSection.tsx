import { Link } from "react-router-dom";
import { useContent } from "../../app/providers/ContentProvider";
import { SectionHeading } from "../../components/presentation/SectionHeading";
import Icon from "../../components/presentation/Icon";
import MedalBoard from "./MedalBoard";
import Timeline from "./Timeline";

export default function AchievementsSection() {
  const { content } = useContent();
  const section = content.sections.find((item) => item.id === "achievements");
  return (
    <section className="achievements-section section-space" id="achievements">
      <div className="container">
        <SectionHeading
          title={section?.title || "Наши победы"}
          intro={section?.intro}
          aside={
            <Link className="text-link" to="/achievements">
              Результаты и события
              <Icon name="arrow" />
            </Link>
          }
        />
        <MedalBoard />
        <Timeline compact />
      </div>
    </section>
  );
}
