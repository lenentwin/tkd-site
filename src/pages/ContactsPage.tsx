import { useContent } from "../app/providers/ContentProvider";
import { PageIntro } from "../components/presentation/SectionHeading";
import ContactActions from "../components/presentation/ContactActions";
import MapSection from "../sections/locations/MapSection";
import LocationsSection from "../sections/locations/LocationsSection";

export default function ContactsPage() {
  const { content } = useContent();
  return (
    <main id="main" className="public-page contacts-page">
      <PageIntro
        title={
          content.pages["/contacts"]?.title.split(" — ")[0] || "Залы и контакты"
        }
        description={content.pages["/contacts"]?.description}
      />
      <div className="container">
        <ContactActions compact />
      </div>
      <MapSection />
      <LocationsSection />
    </main>
  );
}
