import { z } from "zod";
import type { UserSession } from "../types/services";

const profileSchema = z.object({
  authenticated: z.literal(true),
  user: z.object({ id: z.number().int().positive().safe(), role: z.enum(["user", "trainer", "head_trainer", "admin"]),
    displayName: z.string().max(250).optional(), firstName: z.string().max(80).default(""), lastName: z.string().max(80).default(""), middleName: z.string().max(80).default(""), version: z.number().int().positive().default(1) }),
  legal: z.object({required:z.boolean(),enforcement:z.boolean(),canAccept:z.boolean()}).optional(),
  csrfToken: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
});
export const yandexStartUrl = "https://api.mft39.ru/auth/yandex/start/";
export class AccountBlockedError extends Error { constructor() { super("Доступ к аккаунту ограничен. Свяжитесь с клубом."); } }
export async function fetchYandexSession(): Promise<{ session: UserSession | null; csrfToken: string | null }> {
  const response = await fetch("https://api.mft39.ru/api/me/", { credentials: "include", cache: "no-store", signal: AbortSignal.timeout(12000) });
  if (response.status === 401) return { session: null, csrfToken: null };
  if (response.status === 403) { const body = await response.json().catch(() => null); if (body?.error === "account_blocked") throw new AccountBlockedError(); }
  if (!response.ok) throw new Error("Не удалось проверить сессию. Попробуйте позже.");
  const data = profileSchema.parse(await response.json());
  return { session: { mode: "server", id: data.user.id, role: data.user.role, displayName: data.user.displayName || "Участник MFT39", firstName: data.user.firstName, lastName: data.user.lastName, middleName: data.user.middleName, profileVersion: data.user.version, legal: data.legal }, csrfToken: data.csrfToken };
}
export async function logoutYandexSession(): Promise<void> {
  // CSRF token lives only in this request's memory. The HttpOnly session cookie
  // remains inaccessible to JavaScript. Network failures never fake a logout.
  const { session, csrfToken } = await fetchYandexSession();
  if (!session || !csrfToken) return;
  // Cludex's directory URL rejects OPTIONS before PHP; the physical entrypoint
  // reaches the same CSRF-protected route without changing cookie/CORS policy.
  const response = await fetch("https://api.mft39.ru/api/logout/index.php", {
    method: "POST", credentials: "include", cache: "no-store", signal: AbortSignal.timeout(12000),
    headers: { "X-CSRF-Token": csrfToken },
  });
  if (!response.ok && response.status !== 401) throw new Error("Не удалось завершить сессию. Повторите попытку.");
}
