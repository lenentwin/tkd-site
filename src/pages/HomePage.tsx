import type { ComponentType } from "react";
import { useContent } from "../app/providers/ContentProvider";
import HeroSection from "../sections/hero/HeroSection";
import LocationsSection from "../sections/locations/LocationsSection";
import MapSection from "../sections/locations/MapSection";
import CoachSection from "../sections/coach/CoachSection";
import AchievementsSection from "../sections/achievements/AchievementsSection";
import GallerySection from "../sections/gallery/GallerySection";
import RutubeSection from "../sections/rutube/RutubeSection";
import ReviewsSection from "../sections/reviews/ReviewsSection";
import ContactsSection from "../sections/contacts/ContactsSection";
import type { SectionId } from "../types/content";

const sections: Record<SectionId, ComponentType> = {
  hero: HeroSection,
  locations: LocationsSection,
  map: MapSection,
  coach: CoachSection,
  achievements: AchievementsSection,
  gallery: GallerySection,
  rutube: RutubeSection,
  reviews: ReviewsSection,
  contacts: ContactsSection,
};

export default function HomePage() {
  const { content } = useContent();
  return (
    <main id="main">
      {content.sections
        .filter((section) => section.enabled)
        .map((section) => {
          const Section = sections[section.id];
          return <Section key={section.id} />;
        })}
    </main>
  );
}
