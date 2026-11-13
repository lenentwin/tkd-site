import { Link } from "react-router-dom";
import { useContent } from "../app/providers/ContentProvider";
import { PageIntro } from "../components/presentation/SectionHeading";
import { CoachPortrait } from "../sections/coach/CoachSection";
import ContactActions from "../components/presentation/ContactActions";
import Icon from "../components/presentation/Icon";

export default function CoachPage() {
  const { content } = useContent();
  const page = content.pages["/coach"];
  return (
    <main id="main" className="public-page coach-page">
      <PageIntro
        title={page?.title.split(" — ")[0] || "Главный тренер"}
        description={page?.description}
      />
      <div className="container coach-profiles">
        {content.coaches.map((coach) => (
          <CoachPortrait key={coach.id} coach={coach} expanded />
        ))}
      </div>
      <section className="container page-contact-block">
        <h2>Познакомимся на тренировке</h2>
        <p>Уточните группу и удобную площадку у тренера.</p>
        <ContactActions compact />
        <Link className="text-link" to="/contacts">
          Все залы
          <Icon name="arrow" />
        </Link>
      </section>
    </main>
  );
}
