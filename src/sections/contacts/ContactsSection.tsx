import { useContent } from "../../app/providers/ContentProvider";
import ContactActions from "../../components/presentation/ContactActions";
import Icon from "../../components/presentation/Icon";
import { DisplayText } from "../../components/presentation/DisplayText";

export default function ContactsSection() {
  const { content } = useContent();
  const section = content.sections.find((item) => item.id === "contacts");
  return (
    <section className="contacts-section section-space" id="contacts">
      <div className="container">
        <div className="contacts-heading">
          <h2><DisplayText text={section?.title || "Контакты"} /></h2>
          <p><DisplayText text={section?.intro || ""} /></p>
        </div>
        <ContactActions />
        <div className="contacts-socials">
          <a href={content.contacts.vkUrl} target="_blank" rel="noreferrer">
            ВКонтакте
            <Icon name="external" />
          </a>
          <a href={content.contacts.rutubeUrl} target="_blank" rel="noreferrer">
            RuTube
            <Icon name="external" />
          </a>
          <span><DisplayText text={content.brand.fullName} /></span>
        </div>
      </div>
    </section>
  );
}
