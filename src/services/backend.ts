/** Public configuration only. No credentials, OAuth tokens or personal data. */
export function parseApiBaseUrl(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  const url = new URL(value.trim());
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
    throw new Error("VITE_API_BASE_URL must be an HTTPS URL without credentials, query or fragment");
  }
  return url.href.replace(/\/$/, "");
}
export const apiBaseUrl = parseApiBaseUrl(import.meta.env.VITE_API_BASE_URL);
// Enable only after PHP/MySQL/OAuth acceptance on the Russian host.
export const yandexAuthEnabled = import.meta.env.VITE_AUTH_ENABLED === "true"
  && apiBaseUrl === "https://api.mft39.ru";
// An address alone never enables an unimplemented authentication/booking adapter.
export const backendStatus = "not-connected" as const;
