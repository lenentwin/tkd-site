import { parseContent, type SiteContent } from "../../types/content";
import { defaultContent } from "../../content/site.content";

export const CONTENT_KEY = "mft39.content.v1";
export function loadContent(): { content: SiteContent; error: string } {
  if (import.meta.env.PROD) return { content: defaultContent, error: "" };
  try {
    const raw = localStorage.getItem(CONTENT_KEY);
    return {
      content: raw ? parseContent(JSON.parse(raw)) : defaultContent,
      error: "",
    };
  } catch {
    return {
      content: defaultContent,
      error:
        "Локальные настройки недоступны или повреждены. Загружены исходные данные; сохранение не удалит оригинальные файлы.",
    };
  }
}

export function persistContent(content: SiteContent): void {
  localStorage.setItem(CONTENT_KEY, JSON.stringify(parseContent(content)));
}
