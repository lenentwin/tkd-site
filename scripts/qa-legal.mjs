import { chromium } from "playwright";
import { createServer } from "vite";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";

// Browser-only synthetic fixtures. Never connects to production API/accounts.
// QA inventory: public full texts + current status + draft rejection + navigation; 390/1440 light/dark fit;
// account/admin gate before private GET; separate read/checkbox proof + keyboard;
// exact hash/version payload, no identity fields, no repeat of current acceptance;
// partial versions; failed saves; offline, logout/home; per-child guardian proof.
const base = "http://127.0.0.1:4193", folder = "test-results/legal";
const server = await createServer({ server: { host: "127.0.0.1", port: 4193, strictPort: true }, define: { "import.meta.env.VITE_AUTH_ENABLED": '"true"', "import.meta.env.VITE_API_BASE_URL": '"https://api.mft39.ru"' } });
await server.listen();
const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_PATH ?? (process.platform === "win32" ? "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" : chromium.executablePath()) });
await mkdir(folder, { recursive: true });
const sourceDocuments = JSON.parse(await readFile("backend/resources/legal-documents.json", "utf8"));
// Keep rejection coverage independent of the production document status.
const draftDocuments = sourceDocuments.map(document => ({ ...document, status: "draft", version: "qa-draft.1" }));
const routes = { terms: "terms", privacy: "privacy", user_consent: "user-consent", guardian_consent: "guardian-consent" };
const titles = { terms: "Тестовое пользовательское соглашение", privacy: "Тестовая политика обработки данных", user_consent: "Тестовое согласие пользователя", guardian_consent: "Тестовое согласие представителя" };
const documents = Object.entries(titles).map(([type, title]) => {
  const content = `# ${title}\n\n` + Array.from({ length: 26 }, (_, index) => `## Раздел ${index + 1}\n\nСинтетический текст для проверки чтения. Это не юридический документ и не реальные данные. Проверяем доступность текста, последовательность разделов и отдельное подтверждение. Строка ${index + 1}.\n`).join("\n") + `\n## Последний раздел\n\nКОНЕЦ СИНТЕТИЧЕСКОГО ДОКУМЕНТА ${type}`;
  return { type, title, version: "qa-approved.1", hash: createHash("sha256").update(content).digest("hex"), status: "approved", content };
});
const csrf = "q".repeat(43), serverTime = "2026-11-15T12:00:00Z", month = "2026-11", id = "e264ab6a-6416-4fef-89e6-ea74157ddcc0";
const checks = [], errors = []; let lastPage;
const check = name => { checks.push({ name, passed: true }); console.log(`PASS ${name}`); };
async function until(predicate, description = "Expected condition") { for (let i = 0; i < 150; i++) { if (await predicate()) return; await new Promise(resolve => setTimeout(resolve, 20)); } throw new Error(description); }
async function visible(page, text) { await page.getByText(text, { exact: true }).first().waitFor(); }
async function fit(page) { assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "Horizontal overflow"); }
async function settleTheme(page, expected) {
  await page.waitForFunction(theme => document.documentElement.dataset.theme === theme && !document.documentElement.hasAttribute("data-theme-transition"), expected);
}
async function shot(page, name) { await page.screenshot({ path: `${folder}/${name}.png`, scale: "css" }); }
async function fixture({ role = "user", approved = true, source = false, unauthenticated = false, accepted = [], viewport = { width: 1440, height: 1000 } } = {}) {
  const state = { role, approved, unauthenticated, accepted: structuredClone(accepted), requests: [], posts: [], failSave: false, authUnavailable: false, offline: false };
  const activeDocuments = source ? sourceDocuments : approved ? documents : draftDocuments;
  const legal = () => ({ ok: true, documents: activeDocuments.map(({ type, title, version, hash, status }) => ({ type, title, version, hash, status })), enforcement: true, required: ["terms", "user_consent"].some(type => !state.accepted.some(accepted => { const current = activeDocuments.find(document => document.type === type); return accepted.type === type && accepted.version === current.version && accepted.hash === current.hash; })), canAccept: approved, accepted: state.accepted });
  const profile = { firstName: "Участник", lastName: "Синтетический", middleName: "", displayName: "Синтетический Участник", version: 1 };
  const context = await browser.newContext({ viewport, serviceWorkers: "block", reducedMotion: "reduce" });
  await context.addInitScript(() => {
    window.__legalStorageWrites = [];
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) { window.__legalStorageWrites.push({ key, value }); return original.call(this, key, value); };
  });
  await context.route("**/*", async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin === base) {
      if (!source && url.pathname === "/src/legal/documents.ts") return route.fulfill({ contentType: "application/javascript", body: `export const LEGAL_DOCUMENTS = ${JSON.stringify(activeDocuments)};` });
      return route.continue();
    }
    if (url.origin !== "https://api.mft39.ru") return route.abort();
    const headers = { "Access-Control-Allow-Origin": base, "Access-Control-Allow-Credentials": "true" };
    const json = (body, status = 200) => route.fulfill({ status, headers, contentType: "application/json", body: JSON.stringify(body) });
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: { ...headers, "Access-Control-Allow-Methods": "GET, POST", "Access-Control-Allow-Headers": "Content-Type, X-CSRF-Token, Idempotency-Key" } });
    if (state.offline) return route.abort();
    if (url.pathname.includes("/me")) {
      if (state.authUnavailable) return json({ error: "unavailable" }, 503);
      if (state.unauthenticated) return json({ error: "unauthenticated" }, 401);
      const current = legal();
      return json({ authenticated: true, user: { id: 7, role, ...profile }, csrfToken: csrf, legal: { required: current.required, enforcement: true, canAccept: current.canAccept } });
    }
    if (url.pathname.includes("/logout")) { state.unauthenticated = true; return json({ authenticated: false }); }
    const resource = url.searchParams.get("resource"), body = request.postDataJSON();
    state.requests.push({ resource, method: request.method() });
    if (request.method() === "POST") { state.posts.push({ resource, body }); assert.equal(request.headers()["x-csrf-token"], csrf); }
    if (resource === "legal") return json(legal());
    if (resource === "legal-accept") {
      if (state.failSave) return json({ error: "unavailable" }, 503);
      assert.deepEqual(Object.keys(body), ["documents"]);
      for (const proof of body.documents) {
        assert.deepEqual(Object.keys(proof).sort(), ["accepted", "hash", "type", "version"]);
        assert.equal(proof.accepted, true);
        const current = activeDocuments.find(document => document.type === proof.type);
        assert.equal(proof.hash, current.hash); assert.equal(proof.version, current.version); assert.equal(current.status, "approved");
        state.accepted.push({ type: proof.type, version: proof.version, hash: proof.hash, confirmedAt: serverTime });
      }
      return json(legal());
    }
    if (legal().required) return json({ error: "legal_required" }, 403);
    if (resource === "bootstrap") return json({ schemaVersion: 3, actor: { id: 7, role }, staff: role !== "user", permissions: [], halls: [{ id: "city", name: "Синтетический зал", address: "Тестовая площадка", active: true }], scopeVersion: "test", cursor: 0, currentMonth: month, serverTime });
    if (resource === "profile") return json({ profile });
    if (resource === "students" || resource === "applications" && request.method() === "GET") return json({ items: [], nextCursor: null });
    if (resource === "applications" && request.method() === "POST") return json({ batchId: id, applicationIds: [id], replayed: false });
    if (resource === "admin-halls") return json({ ok: true, items: [] });
    return json({ error: "not_found" }, 404);
  });
  const page = await context.newPage(); lastPage = page; page.setDefaultTimeout(10000);
  page.on("pageerror", error => errors.push(error.message));
  return { page, context, state };
}
const currentAcceptance = type => { const document = documents.find(item => item.type === type); return { type, version: document.version, hash: document.hash, confirmedAt: serverTime }; };
async function readAndCheck(page, index) {
  const checkbox = page.getByRole("checkbox").nth(index), region = page.locator(".legal-reader-scroll").nth(index);
  assert.equal(await checkbox.isChecked(), false);
  assert.equal(await checkbox.isEnabled(), false, "Checkbox must await full text");
  await region.focus(); await page.keyboard.press("End");
  await until(() => checkbox.isEnabled(), "Reading to end did not unlock checkbox");
  await checkbox.focus(); await page.keyboard.press("Space");
  assert.equal(await checkbox.isChecked(), true);
}
async function acceptAll(page) {
  const count = await page.getByRole("checkbox").count();
  for (let i = 0; i < count; i++) await readAndCheck(page, i);
  await page.getByRole("button", { name: "Подтвердить и открыть кабинет", exact: true }).click();
}
try {
  {
    const { page, context, state } = await fixture({ source: true, unauthenticated: true });
    for (const document of sourceDocuments) {
      await page.goto(`${base}/legal/${routes[document.type]}`);
      await page.getByRole("heading", { level: 1, name: document.title, exact: true }).waitFor();
      await page.getByText(document.status === "draft" ? "Черновик для согласования." : "Утверждённая редакция", { exact: true }).waitFor();
      const text = await page.locator("article").innerText();
      const last = document.content.trim().split("\n").at(-1).replaceAll("**", "");
      assert(text.includes(last), `Last paragraph missing for ${document.type}`);
      assert.equal(await page.getByRole("checkbox").count(), 0);
      assert.equal(await page.locator('.footer-legal a[href^="/legal/"]').count(), 4);
      assert.equal(await page.locator(".legal-navigation a").count(), 4);
      await page.keyboard.press("Control+End"); await fit(page);
      check(`Public ${document.status} ${document.type}: complete final paragraph, four footer/navigation links, no acceptance`);
    }
    assert.equal(state.posts.length, 0);
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      for (const theme of ["dark", "light"]) {
        await page.goto(`${base}/legal/privacy`); await page.locator(".legal-page-header h1").waitFor();
        const actual = await page.locator("html").getAttribute("data-theme");
        if (actual !== theme) await page.getByRole("button", { name: theme === "light" ? "Включить светлую тему" : "Включить тёмную тему", exact: true }).click();
        await settleTheme(page, theme); await page.evaluate(() => document.fonts.ready); await fit(page); await shot(page, `public-privacy-${width}-${theme}`);
        check(`Public privacy ${width}px ${theme}: viewport fit and screenshot`);
      }
    }
    for (const document of sourceDocuments.filter(document => document.type !== "privacy")) {
      for (const width of [390, 1440]) {
        await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
        for (const theme of ["dark", "light"]) {
          await page.goto(`${base}/legal/${routes[document.type]}`); await page.locator(".legal-page-header h1").waitFor();
          if (await page.locator("html").getAttribute("data-theme") !== theme) await page.getByRole("button", { name: theme === "light" ? "Включить светлую тему" : "Включить тёмную тему", exact: true }).click();
          await settleTheme(page, theme); await page.evaluate(() => document.fonts.ready); await fit(page); await shot(page, `public-${document.type}-${width}-${theme}`);
          check(`Public ${document.type} ${width}px ${theme}: viewport fit and screenshot`);
        }
      }
    }
    await page.locator(".footer-legal").scrollIntoViewIfNeeded(); await shot(page, "public-document-end-footer");
    await context.setOffline(true); await page.getByText("Не удалось проверить актуальность документа:", { exact: false }).waitFor();
    assert.equal(await page.locator("article").count(), 1); check("Public text stays readable offline with explicit currency warning");
    await context.setOffline(false);
    await page.goto(base + "/login"); await page.locator(".login-legal-links").waitFor(); assert.equal(await page.locator(".login-legal-links a").count(), 4);
    await page.locator('.login-legal-links a[href="/legal/terms"]').click(); await page.getByRole("heading", { level: 1 }).waitFor(); assert(page.url().endsWith("/legal/terms"));
    check("Login exposes four readable documents before authentication");
    await context.close();
  }
  {
    const { page, context, state } = await fixture({ approved: false });
    await page.goto(base + "/account/profile"); await visible(page, "Документы для личного кабинета");
    await page.getByText("Подтверждение пока недоступно:", { exact: false }).waitFor();
    assert.equal(state.requests.filter(item => item.resource !== "legal").length, 0);
    for (const checkbox of await page.getByRole("checkbox").all()) assert.equal(await checkbox.isEnabled(), false);
    assert.equal(await page.getByRole("button", { name: "Подтвердить и открыть кабинет", exact: true }).isEnabled(), false);
    check("Draft server state blocks acceptance and private GET");
    await page.getByRole("button", { name: "Выйти из аккаунта", exact: true }).click(); await page.locator(".login-legal-links").waitFor();
    assert.equal(state.posts.length, 0); check("Logout remains available from draft gate"); await context.close();
  }
  {
    const { page, context, state } = await fixture();
    await page.goto(base + "/account/profile"); await page.locator(".legal-reader-scroll").first().waitFor();
    assert.equal(state.requests.filter(item => item.resource !== "legal").length, 0);
    assert.equal(await page.getByRole("checkbox").count(), 2); check("Fresh session mounts gate before any private GET");
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      for (const theme of ["dark", "light"]) {
        const actual = await page.locator("html").getAttribute("data-theme");
        if (actual !== theme) await page.getByRole("button", { name: theme === "light" ? "Включить светлую тему" : "Включить тёмную тему", exact: true }).click();
        await settleTheme(page, theme); await page.keyboard.press("Control+Home"); await fit(page); await shot(page, `acceptance-${width}-${theme}`);
        check(`Acceptance ${width}px ${theme}: viewport fit and screenshot`);
      }
    }
    await readAndCheck(page, 0); assert.equal(await page.getByRole("button", { name: "Подтвердить и открыть кабинет", exact: true }).isEnabled(), false);
    await readAndCheck(page, 1); await until(() => page.getByRole("button", { name: "Подтвердить и открыть кабинет", exact: true }).isEnabled()); await shot(page, "acceptance-read-and-checked");
    await page.getByRole("button", { name: "Подтвердить и открыть кабинет", exact: true }).click();
    await page.getByRole("heading", { name: "Мои данные", exact: true }).waitFor();
    assert.deepEqual(state.posts[0].body.documents.map(item => item.type), ["terms", "user_consent"]);
    assert.equal(state.accepted.length, 2); check("Keyboard End and Space confirm each exact hash/version separately, then private page opens");
    const reads = state.requests.filter(item => item.resource === "legal").length;
    await page.reload(); await page.getByRole("heading", { name: "Мои данные", exact: true }).waitFor();
    assert.equal(state.requests.filter(item => item.resource === "legal").length, reads); check("Current accepted versions are not requested again after reload");
    const storage = await page.evaluate(() => window.__legalStorageWrites); assert(!storage.some(item => /qa-approved|confirmedAt|"accepted"|Синтетический|Участник|user_consent/.test(item.value)));
    check("No consent or synthetic identity written to browser storage"); await context.close();
  }
  {
    const { page, context, state } = await fixture({ accepted: [currentAcceptance("terms"), { ...currentAcceptance("user_consent"), version: "qa-old.1" }] });
    await page.goto(base + "/account/profile"); await page.locator(".legal-reader-scroll").waitFor(); assert.equal(await page.getByRole("checkbox").count(), 1);
    await acceptAll(page); await page.getByRole("heading", { name: "Мои данные", exact: true }).waitFor();
    assert.deepEqual(state.posts[0].body.documents.map(item => item.type), ["user_consent"]); check("Only the missing current version is read and accepted again"); await context.close();
  }
  {
    const { page, context, state } = await fixture({ role: "admin" });
    await page.goto(base + "/admin/users"); await page.locator(".legal-reader-scroll").first().waitFor();
    assert.equal(state.requests.filter(item => item.resource !== "legal").length, 0); check("Admin URL is gated before private admin GET");
    state.failSave = true; await acceptAll(page); await page.getByRole("alert").waitFor(); assert.equal(state.accepted.length, 0);
    assert.equal(state.requests.filter(item => item.resource !== "legal" && item.resource !== "legal-accept").length, 0);
    assert.equal(await page.getByRole("heading", { name: "Документы для личного кабинета", exact: true }).count(), 1); check("Failed save keeps gate open without false success/private data");
    await page.getByRole("button", { name: "Обновить документы", exact: true }).click(); await page.locator(".legal-reader-scroll").first().waitFor();
    assert.equal(await page.getByRole("checkbox").first().isChecked(), false); assert.equal(await page.getByRole("checkbox").first().isEnabled(), false); check("Retry resets read/accept state for fresh document review");
    state.offline = true; await context.setOffline(true); await page.getByRole("heading", { name: "Нет подключения", exact: true }).waitFor();
    const posts = state.posts.length; assert.equal(await page.getByRole("button", { name: "Подтвердить и открыть кабинет", exact: true }).count(), 0); assert.equal(state.posts.length, posts);
    check("Offline state prevents legal POST and retains navigation");
    state.offline = false; await context.setOffline(false); await page.locator(".legal-reader-scroll").first().waitFor();
    await page.getByRole("link", { name: "На главную", exact: true }).last().click(); await page.locator(".hero-section").first().waitFor(); check("Home remains available without accepting documents"); await context.close();
  }
  {
    const { page, context, state } = await fixture({ accepted: [currentAcceptance("terms"), currentAcceptance("user_consent")] });
    await page.goto(base + "/account/book?location=city");
    await page.getByLabel("Фамилия ученика", { exact: true }).fill("Синтетический"); await page.getByLabel("Имя ученика", { exact: true }).fill("Первый"); await page.getByLabel("Год рождения ученика", { exact: true }).fill("2016");
    const first = page.getByLabel("Согласие представителя ученика 1", { exact: true }); assert.equal(await first.isChecked(), false); assert.equal(await first.isEnabled(), false);
    await page.getByRole("button", { name: "Добавить ещё ученика", exact: true }).click();
    await page.getByLabel("Фамилия ученика", { exact: true }).nth(1).fill("Синтетический"); await page.getByLabel("Имя ученика", { exact: true }).nth(1).fill("Второй"); await page.getByLabel("Год рождения ученика", { exact: true }).nth(1).fill("2017");
    const second = page.getByLabel("Согласие представителя ученика 2", { exact: true }); assert.equal(await second.isChecked(), false); assert.equal(await second.isEnabled(), false);
    await page.locator(".legal-reader-scroll").focus(); await page.keyboard.press("End"); await until(() => first.isEnabled());
    await first.check(); assert.equal(await second.isChecked(), false); await second.check(); await first.scrollIntoViewIfNeeded(); await shot(page, "booking-guardian-confirmations");
    await page.getByLabel("Телефон представителя", { exact: true }).fill("+7 (900) 000-00-00");
    await page.getByLabel("Спортивный зал", { exact: true }).selectOption("city");
    const date = page.getByLabel("Желаемая дата тренировки", { exact: true }); await date.fill(await date.getAttribute("min"));
    await page.getByRole("button", { name: "Отправить заявку", exact: true }).click(); await visible(page, "Заявка сохранена и ожидает решения тренера.");
    const booking = state.posts.find(item => item.resource === "applications").body;
    assert.equal(booking.students.length, 2);
    for (const student of booking.students) assert.deepEqual(student.guardianConsent, { type: "guardian_consent", version: documents[3].version, hash: documents[3].hash, accepted: true });
    check("Two children require independent unchecked guardian proofs; exact proof travels with each student");
    await page.getByText("Заявка сохранена и ожидает решения тренера.", { exact: true }).scrollIntoViewIfNeeded(); await shot(page, "booking-after-two-guardian-proofs");
    const posts = state.posts.length; state.offline = true; await context.setOffline(true);
    await page.getByRole("heading", { name: "Для кабинета нужен интернет", exact: true }).waitFor();
    assert.equal(await page.getByRole("button", { name: "Отправить заявку", exact: true }).count(), 0); assert.equal(state.posts.length, posts);
    check("Offline booking unmounts private form and cannot submit another application"); await context.close();
  }
  assert.deepEqual(errors, []); check("No browser page errors");
  await writeFile(`${folder}/results.json`, JSON.stringify({ checks, browserErrors: errors, fixtureOnly: true, productionRequests: 0, realDraftBundleUnchanged: true }, null, 2));
  console.log(JSON.stringify({ passed: checks.length, browserErrors: errors.length }));
} catch (error) {
  await lastPage?.screenshot({ path: `${folder}/failure.png`, fullPage: true }).catch(() => {});
  await writeFile(`${folder}/results.json`, JSON.stringify({ checks, browserErrors: errors, failure: String(error), fixtureOnly: true }, null, 2)); throw error;
} finally { await browser.close(); await server.close(); }
