/** This allowlist is shared by the build and the worker. No runtime API cache. */
export const STATIC_CACHE_PREFIX = "mft39-static-";
const sensitiveQuery = /^(code|state|token|access_token|id_token|refresh_token|csrf|session|sid|authorization)$/i;

export function isNetworkOnly(url: URL, origin: string): boolean {
  return url.origin !== origin || /^\/(api|auth|oauth|callback)(\/|$)/i.test(url.pathname)
    || [...url.searchParams.keys()].some(key => sensitiveQuery.test(key));
}

export function isStaticResource(url: URL, origin: string): boolean {
  if (isNetworkOnly(url, origin) || url.search || url.hash || /%2f|%5c|%00/i.test(url.pathname)) return false;
  return ["/index.html", "/manifest.webmanifest", "/favicon.svg"].includes(url.pathname)
    || /^\/assets\/[^/]+\.(js|css)$/.test(url.pathname)
    || /^\/fonts\/[^/]+\.(woff2?|otf|ttf)$/.test(url.pathname)
    || /^\/pwa\/[^/]+\.png$/.test(url.pathname)
    || /^\/images\/[a-zA-Z0-9._%+/-]+\.(svg|png|webp|jpe?g|avif)$/.test(url.pathname);
}

export function navigationCanUseShell(url: URL, origin: string): boolean {
  return !isNetworkOnly(url, origin);
}

export function oldCachesToDelete(names: string[], current: string): string[] {
  // Two old static releases keep lazy chunks usable in other open tabs.
  const old = names.filter(name => name.startsWith(STATIC_CACHE_PREFIX) && name !== current);
  return old.slice(0, Math.max(0, old.length - 2));
}
