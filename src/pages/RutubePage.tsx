import { useContent } from "../app/providers/ContentProvider";
import { PageIntro } from "../components/presentation/SectionHeading";
import { ClubVideo } from "../sections/rutube/RutubeSection";

export default function RutubePage() {
  const { content } = useContent();
  return (
    <main id="main" className="public-page video-page">
      <PageIntro
        title={content.pages["/rutube"]?.title.split(" — ")[0] || "Видео клуба"}
        description={content.pages["/rutube"]?.description}
      />
      <div className="container">
        <ClubVideo />
      </div>
    </main>
  );
}
