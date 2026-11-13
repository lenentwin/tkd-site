import { useContent } from "../../app/providers/ContentProvider";
import Icon from "../../components/presentation/Icon";
import { DisplayText } from "../../components/presentation/DisplayText";

export function ClubReviews() {
  const { content } = useContent();
  const reviews = content.reviews.filter(
    (review) => review.confirmed && review.originalUrl,
  );
  return (
    <div className="club-reviews">
      {reviews.length ? (
        reviews.map((review) => (
          <figure className="review-quote" key={review.id}>
            <blockquote><DisplayText text={review.quote} /></blockquote>
            <figcaption>
              <span><DisplayText text={review.author} /></span>
              <a
                className="text-link"
                href={review.originalUrl}
                target="_blank"
                rel="noreferrer"
              >
                Оригинал отзыва
                <Icon name="external" />
              </a>
            </figcaption>
          </figure>
        ))
      ) : (
        <div className="reviews-empty">
          <div>
            <h3>Подтверждённых отзывов пока нет</h3>
            <p>
              Здесь появятся реальные отзывы со ссылками на оригинал. Пока можно
              познакомиться с жизнью клуба в сообществе ВКонтакте.
            </p>
            <a
              className="button button-secondary"
              href={content.contacts.vkUrl}
              target="_blank"
              rel="noreferrer"
            >
              Перейти в сообщество ВКонтакте
              <Icon name="external" />
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ReviewsSection() {
  const { content } = useContent();
  const section = content.sections.find((item) => item.id === "reviews");
  return (
    <section className="reviews-section section-space" id="reviews">
      <div className="container reviews-layout">
        <div className="reviews-heading">
          <p className="reviews-section-kicker">Мнения о занятиях</p>
          <h2>Отзывы</h2>
          {section?.title ? (
            <p className="reviews-section-title"><DisplayText text={section.title} /></p>
          ) : null}
          <p><DisplayText text={section?.intro || ""} /></p>
          <a
            className="reviews-community-link text-link"
            href={content.contacts.vkUrl}
            target="_blank"
            rel="noreferrer"
          >
            Сообщество ВКонтакте
            <Icon name="external" />
          </a>
        </div>
        <ClubReviews />
      </div>
    </section>
  );
}
