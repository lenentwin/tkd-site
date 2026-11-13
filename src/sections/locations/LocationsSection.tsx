import { Link } from "react-router-dom";
import { useContent } from "../../app/providers/ContentProvider";
import { SectionHeading } from "../../components/presentation/SectionHeading";
import Icon from "../../components/presentation/Icon";
import { DisplayText } from "../../components/presentation/DisplayText";

export default function LocationsSection() {
  const { content } = useContent();
  const section = content.sections.find((item) => item.id === "locations");
  return (
    <section className="locations-section section-space" id="locations">
      <div className="container">
        <SectionHeading
          title={section?.title || "Залы и занятия"}
          intro={section?.intro}
          aside={
            <Link className="text-link" to="/contacts">
              Все контакты
              <Icon name="arrow" />
            </Link>
          }
        />
        <div className="age-group-strip">
          {content.ageGroups.map((group) => (
            <span key={group}><DisplayText text={group} /></span>
          ))}
        </div>
        <div className="location-overview">
          {content.locations.map((location) => (
            <article key={location.id} className="location-overview-item">
              <Icon name="pin" />
              <h3><DisplayText text={location.name} /></h3>
              <p><DisplayText text={location.address} /></p>
              <span className="location-hours-label">Часы работы площадки</span>
              <p className="location-hours"><DisplayText text={location.hours} /></p>
              <a className="text-link" href="#map">
                Посмотреть на карте
                <Icon name="arrow" />
              </a>
            </article>
          ))}
        </div>
        <div className="conditions-row">
          <div className="conditions-main">
            <h3>
              Группа и расписание<br />с учётом вашего возраста
            </h3>
            <p>
              Стоимость занятий уточняется у тренера. Часы работы площадок
              отличаются от фактического расписания тренировок.
            </p>
            <Link className="text-link" to="/contacts">
              Уточнить расписание
              <Icon name="arrow" />
            </Link>
          </div>
          <div className="discount-list">
            {content.discounts.map((discount) => (
              <div className="discount-line" key={discount.id}>
                <span className="discount-number">
                  {discount.percent}
                  <small>%</small>
                </span>
                <div>
                  <h4><DisplayText text={discount.title} /></h4>
                  <p><DisplayText text={discount.details} /></p>
                </div>
              </div>
            ))}
            <p className="small-note">
              Условия применения и совместимость скидок уточняйте у тренера.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
