import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useContent } from "../../app/providers/ContentProvider";
import AccountLink from "./AccountLink";
import { useMediaQuery } from "../../animations/useMotionPreference";
import { copyPhone, getGmailLink } from "../../services/integrations";
import Icon from "./Icon";
import { DisplayText } from "./DisplayText";

export default function ContactActions({
  compact = false,
}: {
  compact?: boolean;
}) {
  const { content } = useContent();
  const mobile = useMediaQuery("(max-width: 767px)");
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(""), 5500);
    return () => window.clearTimeout(timer);
  }, [message]);
  async function copy() {
    try {
      await copyPhone(content.contacts.phone);
      setMessage("Номер телефона скопирован");
    } catch {
      setMessage(
        "Не удалось скопировать. Выделите номер и скопируйте его вручную.",
      );
    }
  }
  return (
    <div className={`contact-actions ${compact ? "is-compact" : ""}`}>
      <div className="contact-primary">
        {mobile ? (
          <a
            className="contact-phone"
            href={`tel:${content.contacts.phone.replace(/[^+\d]/g, "")}`}
          >
            <DisplayText text={content.contacts.phone} />
            <Icon name="phone" />
          </a>
        ) : (
          <button
            type="button"
            className="contact-phone"
            onClick={copy}
            title="Скопировать номер телефона"
          >
            <DisplayText text={content.contacts.phone} />
            <Icon name="phone" />
          </button>
        )}
        <span className="contact-hint">
          {mobile ? "Позвонить тренеру" : "Нажмите, чтобы скопировать номер"}
        </span>
      </div>
      <div className="contact-email">
        <a href={`mailto:${content.contacts.email}`}>
          <DisplayText text={content.contacts.email} />
          <Icon name="mail" />
        </a>
        <a
          className="text-link"
          href={getGmailLink(content.contacts.email)}
          target="_blank"
          rel="noreferrer"
        >
          Написать через Gmail
          <Icon name="external" />
        </a>
      </div>
      <div className="contact-cta">
        <AccountLink />
        <Link className="text-link" to="/contacts#map">
          Адреса и маршруты
          <Icon name="pin" />
        </Link>
      </div>
      {message ? (
        <p className="action-notification" role="status">
          <DisplayText text={message} />
        </p>
      ) : null}
    </div>
  );
}
