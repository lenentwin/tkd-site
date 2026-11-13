import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile, readFile } from "node:fs/promises";

const base = "http://127.0.0.1:5173";
const output = new URL("../test-results/", import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath:
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: true,
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  acceptDownloads: true,
});
const page = await context.newPage();
page.setDefaultTimeout(12000);
const results = [],
  errors = [],
  posts = [],
  dialogs = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("dialog", (dialog) => {
  dialogs.push(dialog.type());
  void dialog.accept();
});
context.on("request", (request) => {
  if (request.method() === "POST") posts.push(request.url());
});
const screenshot = (name) =>
  page.screenshot({
    path: new URL(`${name}.png`, output).pathname.replace(/^\/([A-Z]:)/, "$1"),
    fullPage: false,
    scale: "css",
  });
async function check(name, action) {
  try {
    await action();
    results.push({ name, passed: true });
    console.log(`PASS ${name}`);
  } catch (error) {
    results.push({ name, passed: false, error: error.message });
    console.log(`FAIL ${name}: ${error.message}`);
    await screenshot(`failure-${results.length}`).catch(() => {});
  }
}
try {
  await check(
    "Public direct routes, headings, navigation and titles",
    async () => {
      for (const route of [
        "/",
        "/coach",
        "/achievements",
        "/contacts",
        "/rutube",
        "/vk",
        "/login",
      ]) {
        const response = await page.goto(base + route, {
          waitUntil: "networkidle",
        });
        assert.equal(response.status(), 200);
        assert.ok(await page.getByRole("heading", { level: 1 }).count());
        assert.ok((await page.title()).includes("MFT39"));
      }
      await page.getByRole("link", { name: "Тренер", exact: true }).click();
      assert.ok(page.url().endsWith("/coach"));
      await page.goBack();
      assert.ok(page.url().endsWith("/login"));
      await page.goForward();
      assert.ok(page.url().endsWith("/coach"));
    },
  );
  await check(
    "Guest -> demo login -> account -> child/adult booking -> honest result",
    async () => {
      await page.goto(base, { waitUntil: "networkidle" });
      await page.locator(".hero-main-action").click();
      assert.ok(page.url().endsWith("/login"));
      await page.getByRole("button", { name: /Войти через Яндекс/ }).click();
      await page.waitForURL("**/account");
      await page
        .getByRole("link", { name: "Записаться на тренировку", exact: true })
        .first()
        .click();
      await page.waitForURL("**/booking");
      assert.equal(
        await page
          .getByLabel("ФИО ребёнка", { exact: true })
          .getAttribute("readonly"),
        "",
      );
      await page.getByLabel("Взрослый", { exact: true }).check();
      assert.equal(
        await page.getByLabel("ФИО участника", { exact: true }).inputValue(),
        "Тестовый Участник",
      );
      await page.getByLabel("Ребёнок / подросток", { exact: true }).check();
      await page.getByLabel("Зал", { exact: true }).selectOption("school10");
      const date = new Date();
      date.setDate(date.getDate() + 7);
      await page
        .getByLabel("Желаемая дата тренировки", { exact: true })
        .fill(date.toISOString().slice(0, 10));
      await page
        .getByRole("button", { name: "Посмотреть результат записи" })
        .click();
      assert.ok(
        (await page.getByRole("status").textContent()).includes(
          "Отправка заявок будет доступна",
        ),
      );
      await screenshot("demo-booking");
      assert.equal(posts.length, 0);
      const stored = await page.evaluate(() =>
        Object.values(localStorage).join(" "),
      );
      assert.ok(!stored.includes("Тестовый Ребёнок"));
    },
  );
  await check(
    "Map selection, services and explicit unconfirmed 2GIS fallback",
    async () => {
      await page.goto(`${base}/contacts`, { waitUntil: "networkidle" });
      await page.locator(".location-option").nth(2).click();
      assert.ok(
        (await page.locator(".map-address").textContent()).includes(
          "Войнич, 1",
        ),
      );
      assert.equal(
        await page
          .locator(".map-location-detail a.button")
          .getAttribute("href"),
        "https://yandex.ru/maps/-/CXCNa0zI",
      );
      await page.getByRole("button", { name: "2ГИС", exact: true }).click();
      assert.ok(
        (await page.locator(".map-fallback").textContent()).includes(
          "не подтверждена",
        ),
      );
      assert.equal(
        await page.locator(".map-fallback a").getAttribute("href"),
        "https://2gis.ru/kaliningrad",
      );
      await page
        .getByRole("button", { name: "Яндекс Карты", exact: true })
        .click();
      await page.locator(".location-option").first().click();
      assert.ok(
        (await page.locator(".map-address").textContent()).includes(
          "Челнокова, 43",
        ),
      );
      await screenshot("contacts-map");
    },
  );
  await check("Clipboard success, mailto and Gmail", async () => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"], {
      origin: base,
    });
    await page
      .getByRole("button", { name: "+7 (960) 297-53-77", exact: true })
      .click();
    assert.ok(
      (await page.getByRole("status").textContent()).includes("скопирован"),
    );
    assert.equal(
      await page.evaluate(() => navigator.clipboard.readText()),
      "+7 (960) 297-53-77",
    );
    assert.equal(
      await page
        .getByRole("link", { name: "tkdmft39@mail.ru", exact: true })
        .getAttribute("href"),
      "mailto:tkdmft39@mail.ru",
    );
    assert.ok(
      (
        await page
          .getByRole("link", { name: /Написать через Gmail/ })
          .getAttribute("href")
      ).includes("to=tkdmft39%40mail.ru"),
    );
  });
  await check("Clipboard denial never reports success", async () => {
    const denied = await browser.newContext({
      viewport: { width: 1366, height: 900 },
    });
    await denied.addInitScript(() =>
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: () => Promise.reject(new Error("Denied")) },
      }),
    );
    const deniedPage = await denied.newPage();
    await deniedPage.goto(`${base}/contacts`, { waitUntil: "networkidle" });
    await deniedPage
      .getByRole("button", { name: "+7 (960) 297-53-77", exact: true })
      .click();
    assert.ok(
      (await deniedPage.getByRole("status").textContent()).includes(
        "Не удалось скопировать",
      ),
    );
    await denied.close();
  });
  await check("Mobile tel action and menu open/close", async () => {
    const mobile = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const mobilePage = await mobile.newPage();
    await mobilePage.goto(`${base}/contacts`, { waitUntil: "networkidle" });
    assert.equal(
      await mobilePage
        .getByRole("link", { name: "+7 (960) 297-53-77", exact: true })
        .getAttribute("href"),
      "tel:+79602975377",
    );
    await mobilePage
      .getByRole("button", { name: "Открыть меню", exact: true })
      .click();
    assert.equal(
      await mobilePage
        .getByRole("button", { name: "Закрыть меню", exact: true })
        .getAttribute("aria-expanded"),
      "true",
    );
    await mobilePage.keyboard.press("Escape");
    assert.equal(
      await mobilePage
        .getByRole("button", { name: "Открыть меню", exact: true })
        .getAttribute("aria-expanded"),
      "false",
    );
    await mobile.close();
  });
  await check(
    "Editor text, live preview, undo/redo, save and reload",
    async () => {
      await page.goto(`${base}/editor`, { waitUntil: "networkidle" });
      await page
        .getByLabel("Девиз", { exact: true })
        .fill("Проверка редактирования MFT39");
      await page.getByRole("button", { name: "Mobile", exact: true }).click();
      await page.frameLocator("iframe").locator("h1").waitFor();
      await page.waitForFunction(
        () =>
          document
            .querySelector("iframe")
            ?.contentDocument?.querySelector(".hero-motto")
            ?.getAttribute("aria-label") === "Проверка редактирования MFT39",
      );
      assert.equal(
        await page
          .frameLocator("iframe")
          .locator(".hero-motto")
          .getAttribute("aria-label"),
        "Проверка редактирования MFT39",
      );
      await page.getByRole("button", { name: "Отменить", exact: true }).click();
      assert.equal(
        await page.getByLabel("Девиз", { exact: true }).inputValue(),
        "День без тренировки - потерянный день",
      );
      await page
        .getByRole("button", { name: "Повторить", exact: true })
        .click();
      assert.equal(
        await page.getByLabel("Девиз", { exact: true }).inputValue(),
        "Проверка редактирования MFT39",
      );
      await page
        .getByRole("button", { name: "Сохранить", exact: true })
        .click();
      await page.reload({ waitUntil: "networkidle" });
      assert.equal(
        await page.getByLabel("Девиз", { exact: true }).inputValue(),
        "Проверка редактирования MFT39",
      );
      await screenshot("editor-live-preview");
    },
  );
  await check("Editor sections reorder, hide, undo and restore", async () => {
    await page.getByRole("button", { name: "Разделы", exact: true }).click();
    await page.locator(".editor-item-list button").nth(1).click();
    await page
      .getByRole("button", { name: "Переместить выше", exact: true })
      .click();
    assert.equal(
      await page.locator(".editor-item-list button").first().textContent(),
      "Место для тренировки",
    );
    await page.getByRole("button", { name: "Отменить", exact: true }).click();
    await page.getByLabel("Показывать / включить", { exact: true }).uncheck();
    await page.getByRole("button", { name: "Отменить", exact: true }).click();
    assert.equal(
      await page
        .getByLabel("Показывать / включить", { exact: true })
        .isChecked(),
      true,
    );
  });
  await check(
    "Editor adds a coach and tournament, medal total recalculates",
    async () => {
      await page.getByRole("button", { name: "Тренеры", exact: true }).click();
      await page.getByRole("button", { name: "Добавить", exact: true }).click();
      await page
        .getByLabel("Название / имя", { exact: true })
        .fill("Тестовый профиль — удалить");
      assert.equal(await page.locator(".editor-item-list button").count(), 2);
      await page.getByRole("button", { name: "Удалить", exact: true }).click();
      assert.equal(await page.locator(".editor-item-list button").count(), 1);
      await page
        .getByRole("button", { name: "Победы и турниры", exact: true })
        .click();
      await page.getByLabel("Золотые медали", { exact: true }).fill("66");
      await page.getByLabel("Золотые медали", { exact: true }).press("Tab");
      assert.ok(
        (await page.locator(".editor-panel").textContent()).includes(
          "Всего 183",
        ),
      );
      await page.getByRole("button", { name: "Добавить", exact: true }).click();
      await page
        .getByLabel("Заголовок", { exact: true })
        .fill("Тестовый турнир — удалить");
      assert.equal(await page.locator(".editor-item-list button").count(), 8);
      await page.getByRole("button", { name: "Удалить", exact: true }).click();
    },
  );
  await check(
    "Editor file upload, aspect/focus, image persistence and export/import",
    async () => {
      await page
        .getByRole("button", { name: "Фотографии", exact: true })
        .click();
      const png = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
        "base64",
      );
      await page
        .locator(".editor-media-controls input[type=file]")
        .setInputFiles({
          name: "qa-neutral.png",
          mimeType: "image/png",
          buffer: png,
        });
      await page.waitForFunction(() =>
        document
          .querySelector(".editor-media-preview img")
          ?.getAttribute("src")
          ?.startsWith("blob:"),
      );
      await page
        .getByLabel("Соотношение сторон", { exact: true })
        .selectOption("1:1");
      await page
        .getByLabel("Фокус по горизонтали, %", { exact: true })
        .fill("65");
      await page
        .getByRole("button", { name: "Сохранить", exact: true })
        .click();
      const downloadEvent = page.waitForEvent("download");
      await page
        .getByRole("button", { name: "Экспорт JSON", exact: true })
        .click();
      const download = await downloadEvent;
      const file = await download.path();
      const exported = JSON.parse(await readFile(file, "utf8"));
      assert.equal(exported.content.media[0].focalPoint.x, 65);
      assert.equal(exported.content.media[0].aspectRatio, "1:1");
      assert.equal(exported.assets.length, 1);
      assert.ok(exported.content.media[0].src.startsWith("idb:"));
      await page
        .getByRole("button", { name: "Сбросить всё", exact: true })
        .click();
      await page
        .locator(".editor-transfer input[type=file]")
        .setInputFiles(file);
      await page.waitForFunction(() =>
        document
          .querySelector(".editor-status")
          ?.textContent.includes("импортирована"),
      );
      await page
        .getByRole("button", { name: "Сохранить", exact: true })
        .click();
      await page.reload({ waitUntil: "networkidle" });
      await page
        .getByRole("button", { name: "Фотографии", exact: true })
        .click();
      await page.waitForFunction(() =>
        document
          .querySelector(".editor-media-preview img")
          ?.getAttribute("src")
          ?.startsWith("blob:"),
      );
      assert.equal(
        await page
          .getByLabel("Фокус по горизонтали, %", { exact: true })
          .inputValue(),
        "65",
      );
      assert.ok(
        !JSON.stringify(
          await page.evaluate(() => Object.values(localStorage)),
        ).includes("base64"),
      );
    },
  );
  await check(
    "Invalid JSON rejected, previous content retained; reset to original",
    async () => {
      await page
        .locator(".editor-transfer input[type=file]")
        .setInputFiles({
          name: "broken.json",
          mimeType: "application/json",
          buffer: Buffer.from("{broken"),
        });
      await page.waitForFunction(() =>
        document
          .querySelector(".editor-status")
          ?.textContent.includes("корректным JSON"),
      );
      await page
        .getByRole("button", { name: "Название и тексты", exact: true })
        .click();
      assert.equal(
        await page.getByLabel("Девиз", { exact: true }).inputValue(),
        "Проверка редактирования MFT39",
      );
      await page
        .getByRole("button", { name: "Сбросить всё", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Сохранить", exact: true })
        .click();
      assert.equal(
        await page.getByLabel("Девиз", { exact: true }).inputValue(),
        "День без тренировки - потерянный день",
      );
      await page.getByRole("link", { name: "На сайт", exact: true }).click();
      await page.waitForURL(base + "/");
      await screenshot("home-restored");
    },
  );
  await check("No uncaught browser exceptions or booking POSTs", async () => {
    assert.deepEqual(errors, []);
    assert.deepEqual(posts, []);
  });
} finally {
  const report = {
    engine: await browser.version(),
    date: new Date().toISOString(),
    results,
    errors,
    posts,
    dialogs,
  };
  await writeFile(
    new URL("functional-results.json", output),
    JSON.stringify(report, null, 2),
  );
  console.log(
    JSON.stringify({
      passed: results.filter((r) => r.passed).length,
      total: results.length,
      errors,
    }),
  );
  await browser.close();
}
if (results.some((result) => !result.passed)) process.exitCode = 1;
