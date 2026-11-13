import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile, stat, mkdir, writeFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import assert from "node:assert/strict";

// Run against a production build with VITE_AUTH_ENABLED=true. All signed-in
// profiles below are synthetic fixtures; this is not a live OAuth acceptance.
const root = resolve("dist");
const server = createServer(async (request, response) => {
  let path = resolve(root, `.${new URL(request.url, "http://local").pathname}`);
  if (!path.startsWith(`${root}${sep}`) && path !== root) { response.writeHead(403).end(); return; }
  let status = 200;
  if (path === root) path = resolve(root, "index.html");
  try { if (!(await stat(path)).isFile()) throw new Error(); }
  catch { path = resolve(root, "index.html"); status = 404; }
  response.writeHead(status, { "content-type": ({ ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2", ".svg": "image/svg+xml" })[extname(path)] ?? "application/octet-stream" });
  response.end(await readFile(path));
});
await new Promise(done => server.listen(4188, "127.0.0.1", done));
const base = "http://127.0.0.1:4188";
await mkdir("test-results/account", { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.BROWSER_PATH ?? "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: true });
const errors = [], checks = [], requests = [];
const check = (width, scenario) => checks.push({ width, scenario, passed: true });
try {
  for (const width of [320, 390, 768, 1024, 1440, 1920]) {
    const context = await browser.newContext({ viewport: { width, height: 960 } });
    await context.addInitScript(() => {
      window.__accountStorageWrites = [];
      const setItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) { window.__accountStorageWrites.push(String(value)); return setItem.call(this, key, value); };
      for (const method of ["put", "add"]) {
        const original = IDBObjectStore.prototype[method];
        IDBObjectStore.prototype[method] = function (value, ...args) { window.__accountStorageWrites.push(JSON.stringify(value)); return original.call(this, value, ...args); };
      }
      sessionStorage.setItem("mft39.demo", "on"); sessionStorage.setItem("mft39:intro-seen", "1");
    });
    let signedIn = false, offline = false, logoutFails = false;
    const page = await context.newPage(); page.on("pageerror", error => errors.push(String(error)));
    page.on("request", request => requests.push({ method: request.method(), url: request.url(), body: request.postData() ?? "" }));
    await page.route("https://api.mft39.ru/**", async route => {
      const request = route.request(); const path = new URL(request.url()).pathname;
      if (offline) return route.abort();
      const headers = { "Access-Control-Allow-Origin": base, "Access-Control-Allow-Credentials": "true" };
      if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: { ...headers, "Access-Control-Allow-Methods": "POST", "Access-Control-Allow-Headers": "X-CSRF-Token" } });
      if (path.includes("/club")) return route.fulfill({ status: 404, contentType: "application/json", headers, body: '{"error":"not_found"}' });
      if (path.includes("start")) return route.fulfill({ contentType: "text/html", body: "<h1>OAuth navigation fixture</h1>" });
      if (path.includes("logout")) {
        assert.equal(path, "/api/logout/index.php"); assert.equal(request.headers()["x-csrf-token"], "x".repeat(43));
        if (!logoutFails) signedIn = false;
        return route.fulfill({ status: logoutFails ? 503 : 200, contentType: "application/json", headers, body: '{"authenticated":false}' });
      }
      return route.fulfill({ status: signedIn ? 200 : 401, contentType: "application/json", headers,
        body: JSON.stringify(signedIn ? { authenticated: true, user: { id: 1, role: "user" }, csrfToken: "x".repeat(43) } : { authenticated: false }) });
    });
    const fit = async () => assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Overflow at ${width}: ${page.url()}`);
    const settled = async () => { await page.locator(".cabinet-content").waitFor(); await page.waitForFunction(() => getComputedStyle(document.querySelector(".cabinet-content")).opacity === "1"); };
    await page.goto(base); await page.locator(".hero-main-action a").waitFor();
    assert.equal(await page.locator(".hero-main-action a").innerText(), "Войти в личный кабинет");
    assert.equal(await page.locator(".hero-main-action a").getAttribute("href"), "/login"); await fit(); check(width, "anonymous CTA and public layout");
    if (width < 1024) {
      const menu = page.getByRole("button", { name: "Открыть меню", exact: true });
      if (await menu.isVisible()) {
        await menu.click(); await page.locator(".mobile-menu .button").click(); await page.waitForURL("**/login");
        assert.equal(await page.locator(".mobile-menu").count(), 0); check(width, "mobile menu closes after login CTA");
      }
    }
    await page.goto(`${base}/account/book`); await page.waitForURL("**/login");
    const login = page.getByRole("button", { name: "Войти через Яндекс", exact: false }); await login.waitFor();
    assert.equal(await page.locator(".cabinet-form").count(), 0); check(width, "direct private route rejects demo storage and 401");
    if ([390, 1440].includes(width)) {
      await login.click(); await page.waitForURL("https://api.mft39.ru/auth/yandex/start/"); check(width, "real OAuth start navigation");
    }
    signedIn = true;
    for (const route of ["/account", "/account/bookings", "/account/profile", "/account/book"]) {
      await page.goto(`${base}${route}`); await settled(); await fit();
      assert.equal(await page.locator('.cabinet-sidebar a[aria-current="page"]').count(), 1);
      assert.equal(await page.locator('meta[name="robots"]').getAttribute("content"), "noindex,nofollow");
      check(width, `direct signed-in ${route}`);
    }
    await page.goto(base);
    await page.waitForFunction(() => document.querySelector(".hero-main-action a")?.textContent?.includes("Личный кабинет"));
    assert.equal(await page.locator(".hero-main-action a").getAttribute("href"), "/account");
    assert.equal(await page.locator(".contact-cta a.button").first().getAttribute("href"), "/account");
    check(width, "authenticated public CTAs go to account");
    await page.goto(`${base}/booking`); await page.waitForURL("**/account/book"); await settled(); check(width, "legacy booking redirect");
    if ([390, 1440].includes(width)) {
      await page.getByRole("button", { name: "Проверить заполнение" }).click();
      await page.getByRole("alert").waitFor(); assert.equal(await page.locator('[aria-invalid="true"]').count() > 0, true);
      assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("aria-invalid")), "true");
      check(width, "validation errors and focus");
      await page.getByLabel("Фамилия ученика", { exact: true }).fill("Проверкин");
      await page.getByLabel("Имя ученика", { exact: true }).fill("Тест");
      await page.getByLabel("Возраст, полных лет", { exact: true }).fill("9");
      await page.getByLabel("Фамилия представителя", { exact: true }).fill("Проверкин");
      await page.getByLabel("Имя представителя", { exact: true }).fill("Пример");
      await page.getByLabel("Телефон представителя", { exact: true }).fill("+70000000000");
      await page.getByRole("button", { name: "Добавить ещё ученика" }).click();
      await page.getByLabel("Фамилия ученика", { exact: true }).nth(1).fill("Проверкин");
      await page.getByLabel("Имя ученика", { exact: true }).nth(1).fill("Пример");
      await page.getByLabel("Возраст, полных лет", { exact: true }).nth(1).fill("12");
      await page.getByLabel("Спортивный зал", { exact: true }).selectOption({ index: 1 });
      await page.getByLabel("Желаемая дата тренировки", { exact: true }).fill("2099-01-02");
      await page.getByLabel("Согласие на обработку данных", { exact: true }).check();
      await page.getByRole("button", { name: "Проверить заполнение" }).click();
      await page.getByRole("status").filter({ hasText: "Заявка не отправлялась" }).waitFor();
      assert(await page.getByRole("button", { name: "Отправка недоступна" }).isDisabled());
      assert(!/успешно записаны|заявка отправлена/i.test(await page.locator("main").innerText()));
      const refreshed = page.waitForResponse(response => response.url().includes("/api/me/"));
      await page.evaluate(() => window.dispatchEvent(new Event("focus")));
      await refreshed;
      assert.equal(await page.getByLabel("Фамилия ученика", { exact: true }).first().inputValue(), "Проверкин");
      const storage = await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }));
      assert(!storage.includes("Проверкин") && !storage.includes("+70000000000"));
      const writes = await page.evaluate(() => JSON.stringify(window.__accountStorageWrites));
      assert(!writes.includes("Проверкин") && !writes.includes("+70000000000"), "Personal data reached a storage write");
      assert(!requests.some(request => request.body.includes("Проверкин") || request.url.includes("Проверкин") || request.body.includes("+70000000000")));
      check(width, "multiple minors, guardian, validation, no send/storage, background refresh preserves form");
      await page.getByRole("button", { name: "Убрать ученика 2" }).click();
      assert.equal(await page.getByLabel("Фамилия ученика", { exact: true }).count(), 1);
      await page.getByRole("navigation", { name: "Разделы личного кабинета" }).getByRole("link", { name: "Мои данные" }).click();
      await page.getByRole("navigation", { name: "Разделы личного кабинета" }).getByRole("link", { name: "Записаться на тренировку" }).click();
      assert.equal(await page.getByLabel("Фамилия ученика", { exact: true }).first().inputValue(), ""); check(width, "form clears on leaving");
    }
    for (const route of ["/account", "/account/book"]) {
      await page.goto(`${base}${route}`); await settled();
      for (const theme of ["dark", "light"]) {
        if (await page.locator("html").getAttribute("data-theme") !== theme) await page.locator(".theme-toggle").click();
        await page.waitForFunction(() => !document.documentElement.dataset.themeTransition); await fit();
        await page.screenshot({ path: `test-results/account/${width}-${route.endsWith("book") ? "form" : "home"}-${theme}.png`, fullPage: true });
        check(width, `${route} ${theme} visual/fit`);
      }
    }
    signedIn = false; await page.evaluate(() => window.dispatchEvent(new Event("focus"))); await page.waitForURL("**/login"); check(width, "session expiry 401 clears account");
    await page.goto(`${base}/booking`); await page.waitForURL("**/login"); check(width, "anonymous legacy booking goes to login");
    signedIn = true; await page.goto(`${base}/login`); await page.waitForURL("**/account"); await settled(); check(width, "valid session skips repeat login");
    if ([390, 1440].includes(width)) {
      logoutFails = true; await page.getByRole("button", { name: "Выход из аккаунта", exact: true }).click(); await page.getByRole("alert").waitFor();
      assert(page.url().endsWith("/account")); logoutFails = false; check(width, "failed logout is honest");
    }
    await page.getByRole("button", { name: "Выход из аккаунта", exact: true }).click(); await page.waitForURL("**/login"); check(width, "CSRF logout clears session");
    offline = true; await page.goto(`${base}/account/profile`); await page.getByRole("heading", { name: "Не удалось проверить вход" }).waitFor();
    check(width, "offline has bounded explicit error"); offline = false; signedIn = true;
    await page.getByRole("button", { name: "Повторить проверку" }).click(); await settled(); check(width, "retry recovers profile");
    if (width === 390) {
      await page.emulateMedia({ reducedMotion: "reduce" }); await page.goto(`${base}/account`); await settled();
      assert(await page.locator(".cabinet-content").evaluate(element => {
        const transform = getComputedStyle(element).transform;
        if (transform === "none") return true;
        const matrix = new DOMMatrixReadOnly(transform);
        return matrix.m41 === 0 && matrix.m42 === 0 && matrix.m43 === 0 && matrix.m11 === 1 && matrix.m22 === 1;
      }));
      await page.screenshot({ path: "test-results/account/reduced-motion.png", fullPage: true }); check(width, "reduced motion fade without translation");
    }
    await context.close();
  }
  assert.deepEqual(errors, []);
  assert(requests.filter(request => request.method === "POST").every(request => request.url.endsWith("/api/logout/index.php") && request.body === ""));
  console.log(JSON.stringify({ passed: checks.length, errors, onlyLogoutPosts: true }));
} finally {
  await browser.close(); server.close();
  await writeFile("test-results/account/results.json", JSON.stringify({ checks, errors, posts: requests.filter(request => request.method === "POST").map(request => ({ method: request.method, url: request.url, body: request.body })) }, null, 2));
}
