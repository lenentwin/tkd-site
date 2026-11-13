import type { LocationItem } from "../types/content";

export function getMapLink(
  location: LocationItem,
  provider: "yandex" | "2gis",
): string | null {
  const url = provider === "yandex" ? location.yandexUrl : location.twoGisUrl;
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const allowed =
      provider === "yandex"
        ? ["yandex.ru", "yandex.com", "maps.yandex.ru"]
        : ["2gis.ru", "2gis.com"];
    return parsed.protocol === "https:" && allowed.includes(parsed.hostname)
      ? parsed.href
      : null;
  } catch {
    return null;
  }
}
/** Official share-widget format; its token comes only from the owner's map URL. */
export function getYandexEmbed(location: LocationItem): string | null {
  const source = getMapLink(location, "yandex");
  if (!source) return null;
  const token = new URL(source).pathname.match(
    /^\/maps\/-\/([A-Za-z0-9_-]{6,64})\/?$/,
  )?.[1];
  return token
    ? `https://api-maps.yandex.ru/frame/v1/-/${token}?lang=ru_RU`
    : null;
}

export function getRutubeEmbed(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (
      parsed.protocol !== "https:" ||
      !["rutube.ru", "www.rutube.ru"].includes(parsed.hostname)
    )
      return null;
    const match = parsed.pathname.match(
      /^\/(?:video\/|play\/embed\/)([a-f\d]{32})\/?$/i,
    );
    return match ? `https://rutube.ru/play/embed/${match[1]}/` : null;
  } catch {
    return null;
  }
}
export function getGmailLink(email: string): string {
  return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}`;
}
export async function copyPhone(phone: string): Promise<void> {
  if (!navigator.clipboard?.writeText)
    throw new Error(
      "Копирование недоступно. Выделите и скопируйте номер вручную.",
    );
  await navigator.clipboard.writeText(phone);
}
