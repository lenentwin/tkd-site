import { chromium } from "playwright";
import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";

await mkdir("test-results/release", { recursive: true });
const artifacts = await readdir("dist/assets");
const js = (await Promise.all(artifacts.filter(name => name.endsWith(".js")).map(name => readFile(`dist/assets/${name}`, "utf8")))).join("\n");
for (const forbidden of ["Тестовый Участник", "Тестовый Ребёнок", "Демо-участник", "Демонстрационный вход", "Место для будущих фотографий", "mft39.demo", "Демонстрация интерфейса"]) {
  assert(!js.includes(forbidden), `Production contains development marker: ${forbidden}`);
}
assert(!artifacts.some(name => /EditorPage/.test(name)));
assert((await readFile("dist/_redirects", "utf8")).includes("native SPA fallback"));
if ((await readdir("dist")).includes("404.html")) {
  assert.equal(await readFile("dist/404.html", "utf8"), await readFile("dist/index.html", "utf8"));
}
const headersFile = await readFile("dist/_headers", "utf8");
const csp = headersFile.split("\n").find(line => line.trim().startsWith("Content-Security-Policy:")).split("Content-Security-Policy: ")[1].trim();
const browser = await chromium.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: true });
const errors = [], posts = [], checks = [];
try {
  for (const width of [390, 768, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 960 } });
    await context.addInitScript(() => { sessionStorage.setItem("mft39.demo", "on"); sessionStorage.setItem("mft39:intro-seen", "1"); localStorage.setItem("mft39.content.v1", '{"invalid":true}'); });
    const page = await context.newPage();
    page.on("pageerror", e => errors.push(String(e)));
    page.on("request", request => { if (request.method() === "POST") posts.push(request.url()); });
    await page.route("https://api.mft39.ru/**", route => route.fulfill({
      status: 401, contentType: "application/json", body: '{"authenticated":false}',
      headers: { "Access-Control-Allow-Origin": "http://127.0.0.1:4183", "Access-Control-Allow-Credentials": "true" },
    }));
    // Exercise the exact intended CSP in a browser; Vite preview does not serve _headers.
    await page.route("http://127.0.0.1:4183/**", async route => {
      const response = await route.fetch();
      await route.fulfill({ response, headers: { ...response.headers(), "content-security-policy": csp } });
    });
    for (const route of ["/", "/coach", "/achievements", "/contacts", "/rutube", "/vk", "/login", "/account", "/account/bookings", "/account/book", "/account/profile", "/booking", "/editor"]) {
      await page.goto(`http://127.0.0.1:4183${route}`, { waitUntil: "domcontentloaded" });
      await page.locator("h1").first().waitFor();
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Overflow ${width} ${route}`);
      if (route === "/login" || route.startsWith("/account") || route === "/booking") {
        await page.waitForURL("**/login");
        assert.equal(await page.getByRole("button", { name: "Войти через Яндекс", exact: true }).count(), 1);
        assert.equal(await page.locator("form,input").count(), 0);
      }
      if (route === "/editor") assert.match(await page.locator("h1").innerText(), /не найдена/);
      checks.push({ width, route, passed: true });
    }
    await page.goto("http://127.0.0.1:4183/", { waitUntil: "domcontentloaded" });
    await page.locator(".hero-card").first().waitFor();
    const before = await page.locator(".hero-card").first().evaluate(el => el.style.transform);
    await page.getByRole("button", { name: "Повернуть карусель вперёд", exact: true }).click();
    await page.waitForTimeout(1100);
    assert.notEqual(await page.locator(".hero-card").first().evaluate(el => el.style.transform), before);
    for (const theme of ["light", "dark"]) {
      if (await page.locator("html").getAttribute("data-theme") !== theme) await page.locator(".theme-toggle").click();
      await page.waitForFunction(() => !document.documentElement.dataset.themeTransition);
      await page.screenshot({ path: `test-results/release/hero-${width}-${theme}.png` });
    }
    assert.equal(await page.getByRole("link", { name: "Локальный редактор", exact: true }).count(), 0);
    await context.close();
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(posts, []);
} finally {
  await browser.close();
  await writeFile("test-results/release/browser-results.json", JSON.stringify({ checks, errors, posts }, null, 2));
}
console.log(JSON.stringify({ routesAndWidths: checks.length, errors, posts, artifactCheck: "PASS", cspBrowserCheck: "PASS" }));
