import { chromium, devices } from "playwright";
import { createServer } from "node:http";
import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import { resolve, relative, sep, extname } from "node:path";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";

// Real SW/CacheStorage; all account/OAuth responses below are synthetic fixtures.
// Every external request is fulfilled or aborted, never sent to production.
const root = resolve("dist"), base = "http://127.0.0.1:4186";
const files = new Map();
async function load(dir) {
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const path = resolve(dir, item.name); if (item.isDirectory()) await load(path);
    else files.set("/" + relative(root, path).split(sep).join("/"), await readFile(path));
  }
}
await load(root);
const hash = value => createHash("sha256").update(value).digest("hex");
const workerA = files.get("/sw.js").toString();
const versionA = workerA.match(/["']([a-f0-9]{20})["']/)?.[1]; assert(versionA);
const indexA = files.get("/index.html");
function release(label, broken = false) {
  const html = Buffer.from(indexA.toString().replace("</head>", '<meta name="pwa-qa-release" content="' + label + '"></head>'));
  const version = hash(label + html.toString()).slice(0, 20);
  const worker = workerA.replaceAll(versionA, version).replaceAll(hash(indexA), broken ? hash(indexA) : hash(html));
  return { html, worker: Buffer.from(worker), version };
}
const builds = { A: { html: indexA, worker: files.get("/sw.js"), version: versionA }, B: release("B"), BROKEN: release("BROKEN", true) };
let active = "A";
const privateMarker = "PWA_PRIVATE_FIXTURE_7849";
const csrf = "s".repeat(43), bearer = "p".repeat(43);
let sameOriginProbe = 0;
const server = createServer((request, response) => {
  const path = new URL(request.url, base).pathname;
  if (path.startsWith("/api/")) { sameOriginProbe++; response.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" }).end(JSON.stringify({ privateMarker })); return; }
  const body = path === "/sw.js" ? builds[active].worker : (path === "/" || path === "/index.html" || path === "/404.html") ? builds[active].html : files.get(path);
  const htmlFallback = !body && !extname(path);
  const type = ({ ".js": "application/javascript", ".css": "text/css", ".webmanifest": "application/manifest+json", ".html": "text/html", ".png": "image/png", ".svg": "image/svg+xml", ".woff2": "font/woff2" })[extname(path)] ?? (path === "/" || htmlFallback ? "text/html" : "application/octet-stream");
  response.writeHead(body ? 200 : 404, { "content-type": type, "cache-control": "no-store" }).end(body ?? (htmlFallback ? builds[active].html : "Not found"));
});
await new Promise(done => server.listen(4186, "127.0.0.1", done));
const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_PATH ?? (process.platform === "win32" ? "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" : chromium.executablePath()) });
await mkdir("test-results/pwa/screenshots", { recursive: true });
const checks = [], errors = []; let diagnosticPage, diagnosticState;
const check = name => checks.push({ name, passed: true });
const id = "e264ab6a-6416-4fef-89e6-ea74157ddcc0";
const month = "2026-11", serverTime = "2026-11-15T12:00:00Z";
async function fixture(options = {}, authenticated = false) {
  const state = { authenticated, offline: false, posts: 0, seen: [] };
  const context = await browser.newContext({ ...options, serviceWorkers: "allow" });
  await context.addInitScript(() => {
    sessionStorage.setItem("mft39:intro-seen", "1"); window.__pwaWrites = [];
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) { window.__pwaWrites.push(String(value)); return set.call(this, key, value); };
    for (const method of ["put", "add"]) { const previous = IDBObjectStore.prototype[method]; IDBObjectStore.prototype[method] = function(value, ...args) { window.__pwaWrites.push(JSON.stringify(value)); return previous.call(this, value, ...args); }; }
  });
  await context.route("**/*", async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin === base) return route.continue();
    if (state.offline) return route.abort();
    const headers = { "Access-Control-Allow-Origin": base, "Access-Control-Allow-Credentials": "true" };
    const json = (body, status = 200) => route.fulfill({ status, headers, contentType: "application/json", body: JSON.stringify(body) });
    if (url.origin === "https://oauth.yandex.ru") return route.fulfill({ contentType: "text/html; charset=utf-8", body: '<h1>Фиктивный Яндекс</h1><a href="https://api.mft39.ru/auth/yandex/callback/?code=fictional">Продолжить тестовый вход</a>' });
    if (url.origin !== "https://api.mft39.ru") return route.abort();
    state.seen.push({ path: url.pathname, resource: url.searchParams.get("resource"), method: request.method() });
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: { ...headers, "Access-Control-Allow-Methods": "GET, POST", "Access-Control-Allow-Headers": "Content-Type, X-CSRF-Token" } });
    if (request.method() === "POST") state.posts++;
    // A fresh navigation is used between fixture origins: Playwright does not
    // intercept every hop of a fulfilled HTTP redirect chain. Never follow a
    // fictional code/state to a real provider. PHP's real 302 flow has own CI.
    if (url.pathname.includes("/start")) return route.fulfill({ contentType: "text/html; charset=utf-8", body: '<h1>Тестовый переход OAuth</h1><a href="https://oauth.yandex.ru/authorize?state=fictional">Перейти в тестовый Яндекс</a>' });
    if (url.pathname.includes("/callback")) { state.authenticated = true; return route.fulfill({ status: 302, headers: { Location: base + "/account" }, body: "" }); }
    if (url.pathname.includes("/me")) return json(state.authenticated ? { authenticated: true, user: { id: 7, role: "trainer" }, csrfToken: csrf } : { authenticated: false }, state.authenticated ? 200 : 401);
    if (!state.authenticated) return json({ error: "unauthenticated" }, 401);
    const resource = url.searchParams.get("resource");
    if (resource === "bootstrap") return json({ schemaVersion: 2, actor: { id: 7, role: "trainer" }, staff: true, halls: [{ id: "city", name: "Тестовый зал", address: "Синтетический адрес" }], scopeVersion: "test", cursor: 1, currentMonth: month, serverTime });
    if (resource === "students") return json({ items: [{ id, locationId: "city", lastName: privateMarker, firstName: "Тест", middleName: "", age: 20, ageRecordedOn: "2026-11-15", status: "permanent", admitted: true, createdAt: serverTime, version: 1, payment: { month, status: "paid", version: 1 } }], nextCursor: null });
    if (resource === "applications") return json({ items: [], nextCursor: null });
    if (resource === "device-create") return json({ id, token: bearer, expiresAt: 1999999999 });
    return json({ error: "not_found" }, 404);
  });
  const page = await context.newPage(); page.on("pageerror", error => errors.push(error.message));
  diagnosticPage=page;diagnosticState=state;return { context, page, state };
}
async function controlled(page) { await page.waitForFunction(() => !!navigator.serviceWorker.controller, {}, { timeout: 30000 }); }
async function fit(page) { assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)); }
async function privateCacheCheck(page) {
  const result = await page.evaluate(async markers => {
    const keys = [], leaks = [];
    for (const name of await caches.keys()) for (const request of await (await caches.open(name)).keys()) {
      keys.push(request.url);
      const body = await (await (await caches.open(name)).match(request)).text();
      if (markers.some(marker => body.includes(marker))) leaks.push(request.url);
    }
    return { keys, leaks };
  }, [privateMarker, csrf, bearer, "Пвачерновик"]);
  assert.deepEqual(result.leaks, []);
  assert(result.keys.length > 0);
  for (const key of result.keys) { const u = new URL(key); assert.equal(u.origin, base); assert(!/^\/(account|api|auth|admin|editor)(\/|$)/.test(u.pathname)); assert.equal(u.search, ""); }
  const writes = await page.evaluate(() => window.__pwaWrites);
  assert(!writes.some(value => [privateMarker, csrf, bearer, "Пвачерновик"].some(marker => value.includes(marker))));
}
try {
  const manifest = JSON.parse(files.get("/manifest.webmanifest"));
  assert.equal(manifest.name, "MFT39"); assert.equal(manifest.display, "standalone"); assert.equal(manifest.start_url, "/"); assert.equal(manifest.scope, "/");
  for (const icon of manifest.icons) { const png = files.get(icon.src); const [width, height] = icon.sizes.split("x").map(Number); assert.equal(png.readUInt32BE(16), width); assert.equal(png.readUInt32BE(20), height); }
  assert.equal(files.get("/pwa/apple-touch-icon.png").readUInt32BE(16), 180); check("manifest, Android icons, maskable and Apple icon");
  active = "A";
  {
    const { context, page, state } = await fixture({ ...devices["Pixel 7"], reducedMotion: "reduce" });
    await page.goto(base); await controlled(page); await fit(page); check("real Android-emulated service worker controls the existing website");
    state.offline = true; await context.setOffline(true); await page.reload(); await page.getByText("Вы без интернета", { exact: true }).waitFor(); await page.locator(".hero-main-action a").waitFor(); check("offline public shell works after reload");
    await page.goto(base + "/contacts"); await page.getByRole("heading", { level: 1 }).waitFor(); await fit(page); check("offline public client route");
    await page.goto(base + "/account/trainer"); await page.getByRole("heading", { name: "Для кабинета нужен интернет", exact: true }).waitFor(); assert(!await page.locator("main").innerText().then(text => text.includes(privateMarker))); check("private routes show explicit offline state");
    const rejected = await page.evaluate(async () => { try { await fetch("/api/probe"); return false; } catch { return true; } }); assert(rejected); check("offline API is rejected, no cached or synthetic response");
    await page.screenshot({ path: "test-results/pwa/screenshots/offline-android.png", scale: "css" });
    state.offline = false; await context.setOffline(false); await page.waitForURL("**/login"); check("reconnect validates session and redirects anonymous visitor");
    await page.getByRole("button", { name: "Войти через Яндекс", exact: false }).click(); await page.waitForURL("https://api.mft39.ru/auth/yandex/start/");
    await page.getByRole("link", { name: "Перейти в тестовый Яндекс", exact: true }).click(); await page.waitForURL("https://oauth.yandex.ru/**");
    await page.getByRole("link", { name: "Продолжить тестовый вход" }).click(); await page.waitForURL("**/account"); await page.getByRole("heading", { name: "Тренироваться.Становиться сильнее.", exact: false }).count();
    assert(state.authenticated); assert(state.seen.some(item => item.path.includes("/start"))); assert(state.seen.some(item => item.path.includes("/callback"))); await controlled(page); await privateCacheCheck(page); check("OAuth external navigation/callback preserved, auth responses stay out of cache");
    await context.close();
  }
  for (const [name, options] of [["ios", { ...devices["iPhone 13"] }], ["small-android", { ...devices["Pixel 7"], viewport: { width: 320, height: 740 } }], ["desktop", { viewport: { width: 1440, height: 960 } }]]) {
    active = "A"; const { context, page } = await fixture(options);
    await context.addInitScript(() => localStorage.setItem("mft39.theme", "light"));
    await page.goto(base); await controlled(page); await page.getByRole("button", { name: "Установить MFT39", exact: true }).click();
    const dialog = page.getByRole("dialog"); await dialog.waitFor();
    assert((await dialog.innerText()).includes(name === "ios" ? "На iPhone и iPad" : name === "desktop" ? "На компьютере" : "На Android"));
    const bounds = await dialog.boundingBox(); const viewport = page.viewportSize(); assert(bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= viewport.width + 1 && bounds.y + bounds.height <= viewport.height + 1); await fit(page);
    await page.screenshot({ path: "test-results/pwa/screenshots/install-" + name + ".png", scale: "css" });
    await page.keyboard.press("Escape"); await dialog.waitFor({ state: "hidden" });
    await page.getByRole("button", { name: "Установить MFT39", exact: true }).click(); await page.getByRole("button", { name: "Понятно", exact: true }).click(); await dialog.waitFor({ state: "hidden" }); check(name + " installation guidance, keyboard and viewport fit");
    if (name === "small-android") {
      for (const outcome of ["dismissed", "accepted"]) {
        await page.evaluate(outcome => { window.__installPromptCalls = 0; const event = new Event("beforeinstallprompt", { cancelable: true }); Object.assign(event, { prompt: async () => { window.__installPromptCalls++; }, userChoice: Promise.resolve({ outcome }) }); window.dispatchEvent(event); }, outcome);
        await page.getByRole("button", { name: "Установить MFT39", exact: true }).click(); assert.equal(await page.evaluate(() => window.__installPromptCalls), 1);
        if (outcome === "accepted") await page.getByRole("button", { name: "Установить MFT39", exact: true }).waitFor({ state: "hidden" });
      }
      check("native install event adapter accepts/dismisses only after user click (fixture)");
    }
    await context.close();
  }
  {
    active = "A"; const { context, page, state } = await fixture({ viewport: { width: 1440, height: 960 }, reducedMotion: "reduce" }, true);
    await page.goto(base + "/account/bookings"); await controlled(page); await page.getByRole("heading", { name: privateMarker + " Тест", exact: true }).waitFor();
    const tokenSeen = await page.evaluate(async csrf => { const r = await fetch("https://api.mft39.ru/api/club/index.php?resource=device-create", { method: "POST", credentials: "include", cache: "no-store", headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf }, body: '{"label":"synthetic-pwa-fixture"}' }); return (await r.json()).token.length === 43; }, csrf);
    assert(tokenSeen); await page.evaluate(() => fetch("/api/probe").then(r => r.json())); assert(sameOriginProbe > 0); await privateCacheCheck(page); check("student/payment/session/CSRF/device token and same-origin API never enter CacheStorage or web storage");
    await page.goto(base + "/account/book"); await page.getByLabel("Фамилия ученика", { exact: true }).fill("Пвачерновик");
    const second = await context.newPage(); second.on("pageerror", error => errors.push(error.message)); await second.goto(base + "/coach"); await controlled(second);
    active = "B"; await second.evaluate(async () => { await (await navigator.serviceWorker.getRegistration()).update(); });
    await second.getByRole("status", { name: "Обновление MFT39", exact: true }).waitFor({ timeout: 30000 });
    assert.equal(await page.getByLabel("Фамилия ученика", { exact: true }).inputValue(), "Пвачерновик");
    await second.getByRole("button", { name: "Позже", exact: true }).click(); await second.getByRole("status", { name: "Обновление MFT39", exact: true }).waitFor({ state: "hidden" }); check("update waits for a decision, Later preserves current release");
    await second.getByRole("button", { name: "Обновить MFT39", exact: true }).click(); await second.getByRole("button", { name: "Обновить", exact: true }).click();
    await second.waitForFunction(() => document.querySelector('meta[name="pwa-qa-release"]')?.content === "B"); await controlled(second);
    assert.equal(await page.getByLabel("Фамилия ученика", { exact: true }).inputValue(), "Пвачерновик"); await privateCacheCheck(page); check("explicit update activates new verified release, another tab keeps its unsaved form");
    await page.screenshot({ path: "test-results/pwa/screenshots/update-desktop.png", scale: "css" });
    active = "BROKEN";
    const rejected = await second.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      const rejected = new Promise(resolve => registration.addEventListener("updatefound", () => { const worker = registration.installing; worker.addEventListener("statechange", () => { if (worker.state === "redundant") resolve(true); }); }, { once: true }));
      await registration.update(); return Promise.race([rejected, new Promise(resolve => setTimeout(() => resolve(false), 15000))]);
    }); assert(rejected);
    const cachesAfterFailure = await second.evaluate(() => caches.keys()); assert(cachesAfterFailure.includes("mft39-static-" + builds.B.version)); assert(!cachesAfterFailure.includes("mft39-static-" + builds.BROKEN.version)); check("partial/inconsistent release is rejected and previous verified static cache survives");
    state.offline = true; await context.setOffline(true); await second.reload(); await second.waitForFunction(() => document.querySelector('meta[name="pwa-qa-release"]')?.content === "B"); await page.getByRole("heading", { name: "Для кабинета нужен интернет", exact: true }).waitFor(); check("offline after failed update still uses verified release; private data hidden immediately");
    state.authenticated = false; active = "B"; const posts = state.posts; state.offline = false; await context.setOffline(false); await page.waitForURL("**/login"); assert.equal(state.posts, posts); await privateCacheCheck(page); check("reconnect checks fresh authorization, never restores cached account or replays writes");
    await context.close();
  }
  assert.deepEqual(errors, []);
  await writeFile("test-results/pwa/results.json", JSON.stringify({ fixtureApi: true, realServiceWorker: true, checks, errors, physicalDevices: false }, null, 2));
  console.log(JSON.stringify({ pwaChecks: checks.length, pageErrors: errors.length, realServiceWorker: true, physicalDevices: false }));
} catch(error) { if(diagnosticPage&&!diagnosticPage.isClosed()){await diagnosticPage.screenshot({path:"test-results/pwa/failure.png",scale:"css"});console.log(JSON.stringify({phase:checks.at(-1)?.name,url:diagnosticPage.url(),seen:diagnosticState?.seen,errors}));} throw error; } finally { await browser.close(); await new Promise(done => server.close(done)); }
