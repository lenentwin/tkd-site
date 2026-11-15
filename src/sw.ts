/// <reference lib="webworker" />
import { isNetworkOnly, isStaticResource, navigationCanUseShell, oldCachesToDelete, STATIC_CACHE_PREFIX } from "./pwa/policy";

declare const self: ServiceWorkerGlobalScope;
declare const __MFT39_PRECACHE__: { url: string; revision: string }[];
declare const __MFT39_PWA_BUILD__: string;

const origin = self.location.origin;
const cacheName = STATIC_CACHE_PREFIX + __MFT39_PWA_BUILD__;
const entries = __MFT39_PRECACHE__;
const urls = new Set(entries.map(entry => new URL(entry.url, origin).href));
const shellUrl = new URL("/index.html", origin).href;

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    if (!urls.has(shellUrl) || entries.some(entry => !isStaticResource(new URL(entry.url, origin), origin))) throw new Error("Invalid static precache");
    const cache = await caches.open(cacheName);
    try {
      // Credentials are omitted even for static files. Never cache requests
      // made by the user: install is the ONLY writer to Cache Storage.
      await Promise.all(entries.map(async entry => {
        const url = new URL(entry.url, origin).href;
        const response = await fetch(url, { credentials: "omit", cache: "reload", redirect: "error" });
        if (!response.ok || response.type === "opaque") throw new Error("Static resource unavailable");
        const digest = await crypto.subtle.digest("SHA-256", await response.clone().arrayBuffer());
        const revision = Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, "0")).join("");
        if (revision !== entry.revision) throw new Error("Release is not fully available yet");
        await cache.put(url, response);
      }));
    } catch (error) { await caches.delete(cacheName); throw error; }
    // Waiting workers activate only after an explicit update action.
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const old = oldCachesToDelete(await caches.keys(), cacheName);
    await Promise.all(old.map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", event => {
  const source = event.source;
  if (event.data?.type !== "SKIP_WAITING" || !source || !("url" in source)) return;
  if (new URL(source.url).origin !== origin) return;
  event.waitUntil(self.skipWaiting());
});

async function cachedStatic(request: Request): Promise<Response> {
  const current = await caches.open(cacheName);
  const hit = await current.match(request.url);
  if (hit) return hit;
  // A tab using a previous release may still request one of its lazy chunks.
  // Old caches contain the same static allowlist, never HTML per private URL.
  for (const name of (await caches.keys()).reverse()) {
    if (!name.startsWith(STATIC_CACHE_PREFIX) || name === cacheName) continue;
    const previous = await (await caches.open(name)).match(request.url);
    if (previous && new URL(request.url).pathname !== "/index.html") return previous;
  }
  return fetch(request).catch(() => Response.error());
}

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || request.headers.has("authorization") || isNetworkOnly(url, origin)) {
    // Preserve cookies, CSRF, redirects and errors. No synthetic success,
    // background queue, response cache or offline fallback for OAuth/API.
    event.respondWith(fetch(request, { cache: "no-store" }).catch(() => Response.error()));
    return;
  }
  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try { return await fetch(request, { cache: "no-store" }); }
      catch {
        if (!navigationCanUseShell(url, origin)) return Response.error();
        return await (await caches.open(cacheName)).match(shellUrl) ?? Response.error();
      }
    })());
    return;
  }
  if (isStaticResource(url, origin)) event.respondWith(cachedStatic(request));
});
