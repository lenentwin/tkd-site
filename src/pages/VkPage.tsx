import { useContent } from "../app/providers/ContentProvider";
import { PageIntro } from "../components/presentation/SectionHeading";
import { ClubReviews } from "../sections/reviews/ReviewsSection";
import Icon from "../components/presentation/Icon";
import { DisplayText } from "../components/presentation/DisplayText";

export default function VkPage() {
  const { content } = useContent();
  return (
    <main id="main" className="public-page community-page">
      <PageIntro
        title={
          content.pages["/vk"]?.title.split(" — ")[0] || "Сообщество клуба"
        }
        description={content.pages["/vk"]?.description}
      />
      <section className="container community-content">
        <a
          className="community-banner"
          href={content.contacts.vkUrl}
          target="_blank"
          rel="noreferrer"
        >
          <span className="vk-symbol" aria-hidden="true">
            VK
          </span>
          <div>
            <h2><DisplayText text={content.brand.fullName} /></h2>
            <p>Официальное сообщество ВКонтакте</p>
          </div>
          <Icon name="external" />
        </a>
        <ClubReviews />
      </section>
    </main>
  );
}
