import { useContent } from "../app/providers/ContentProvider";
import { PageIntro } from "../components/presentation/SectionHeading";
import MedalBoard from "../sections/achievements/MedalBoard";
import Timeline from "../sections/achievements/Timeline";

export default function AchievementsPage() {
  const { content } = useContent();
  return (
    <main id="main" className="public-page achievements-page">
      <PageIntro
        title={
          content.sections.find((section) => section.id === "achievements")
            ?.title || "Наши победы"
        }
        description={content.pages["/achievements"]?.description}
      />
      <div className="container">
        <MedalBoard />
        <Timeline />
      </div>
    </main>
  );
}
