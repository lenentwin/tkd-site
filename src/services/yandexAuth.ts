import { z } from "zod";
import type { UserSession } from "../types/services";

const profileSchema = z.object({
  authenticated: z.literal(true),
  user: z.object({ id: z.number().int().positive().safe(), role: z.enum(["user", "trainer", "head_trainer"]) }),
  csrfToken: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
});
export const yandexStartUrl = "https://api.mft39.ru/auth/yandex/start/";
export async function fetchYandexSession(): Promise<{ session: UserSession | null; csrfToken: string | null }> {
  const response = await fetch("https://api.mft39.ru/api/me/", { credentials: "include", cache: "no-store", signal: AbortSignal.timeout(12000) });
  if (response.status === 401) return { session: null, csrfToken: null };
  if (!response.ok) throw new Error("Не удалось проверить сессию. Попробуйте позже.");
  const data = profileSchema.parse(await response.json());
  return { session: { mode: "server", id: data.user.id, role: data.user.role, displayName: "Участник MFT39" }, csrfToken: data.csrfToken };
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
