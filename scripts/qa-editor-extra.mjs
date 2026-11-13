import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";

const browser = await chromium.launch({
  executablePath:
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: true,
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
const page = await context.newPage();
page.setDefaultTimeout(12000);
const results = [],
  errors = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("dialog", (dialog) => void dialog.accept());
async function check(name, action) {
  try {
    await action();
    results.push({ name, passed: true });
    console.log("PASS " + name);
  } catch (error) {
    results.push({ name, passed: false, error: error.message });
    console.log("FAIL " + name + ": " + error.message);
  }
}
try {
  await page.goto("http://127.0.0.1:5173/editor", { waitUntil: "networkidle" });
  await check(
    "Venue add/remove and schedule editing use the public model",
    async () => {
      await page
        .getByRole("button", { name: "Залы и условия", exact: true })
        .click();
      const venues = page.locator(".editor-collection").first();
      await venues
        .getByRole("button", { name: "Добавить", exact: true })
        .click();
      await page
        .getByLabel("Название / имя", { exact: true })
        .fill("Проверка новой площадки");
      await page
        .getByLabel("Расписание тренировок", { exact: true })
        .fill("Тестовое описание — удалить");
      assert.equal(await venues.locator(".editor-item-list button").count(), 4);
      await page
        .getByRole("button", { name: "Сохранить", exact: true })
        .click();
      const live = await context.newPage();
      await live.goto("http://127.0.0.1:5173/contacts", {
        waitUntil: "networkidle",
      });
      assert.ok(
        (await live.locator("main").textContent()).includes(
          "Проверка новой площадки",
        ),
      );
      await live.close();
      await venues
        .getByRole("button", { name: "Удалить", exact: true })
        .click();
      assert.equal(await venues.locator(".editor-item-list button").count(), 3);
    },
  );
  await check(
    "Contacts and page metadata update from the same document",
    async () => {
      await page.getByRole("button", { name: "Контакты", exact: true }).click();
      await page
        .getByLabel("Телефон", { exact: true })
        .fill("+7 (000) 000-00-00");
      await page
        .getByLabel("Электронная почта", { exact: true })
        .fill("qa@example.com");
      await page.getByLabel("Электронная почта", { exact: true }).press("Tab");
      await page
        .getByRole("button", { name: "Страницы и SEO", exact: true })
        .click();
      await page
        .getByRole("group", { name: "/contacts", exact: true })
        .getByLabel("Заголовок", { exact: true })
        .fill("Проверка метаданных — MFT39");
      await page
        .getByRole("button", { name: "Сохранить", exact: true })
        .click();
      const live = await context.newPage();
      await live.goto("http://127.0.0.1:5173/contacts", {
        waitUntil: "networkidle",
      });
      assert.equal(await live.title(), "Проверка метаданных — MFT39");
      assert.equal(
        await live
          .getByRole("button", { name: "+7 (000) 000-00-00", exact: true })
          .count(),
        1,
      );
      assert.equal(
        await live
          .getByRole("link", { name: "qa@example.com", exact: true })
          .getAttribute("href"),
        "mailto:qa@example.com",
      );
      await live.close();
    },
  );
  await check(
    "Theme, motion, three preview modes and reset block",
    async () => {
      await page
        .getByRole("button", { name: "Оформление и движение", exact: true })
        .click();
      await page
        .getByLabel("Исходная тема", { exact: true })
        .selectOption("light");
      await page.getByLabel("Показывать / включить", { exact: true }).uncheck();
      for (const mode of ["Desktop", "Tablet", "Mobile"]) {
        await page.getByRole("button", { name: mode, exact: true }).click();
        await page.waitForFunction(
          () =>
            document.querySelector("iframe")?.contentDocument?.documentElement
              ?.dataset.theme === "light",
        );
        assert.equal(
          await page
            .frameLocator("iframe")
            .locator("html")
            .getAttribute("data-motion"),
          "off",
        );
      }
      await page
        .getByRole("button", { name: "Сбросить блок", exact: true })
        .click();
      assert.equal(
        await page.getByLabel("Исходная тема", { exact: true }).inputValue(),
        "dark",
      );
      assert.equal(
        await page
          .getByLabel("Показывать / включить", { exact: true })
          .isChecked(),
        true,
      );
    },
  );
  await check(
    "Gallery media order, visibility, source path and removal",
    async () => {
      await page
        .getByRole("button", { name: "Фотографии", exact: true })
        .click();
      await page.getByRole("button", { name: "Добавить", exact: true }).click();
      await page
        .getByLabel("Путь или ссылка изображения", { exact: true })
        .fill("/favicon.svg");
      await page
        .getByLabel("Путь или ссылка изображения", { exact: true })
        .press("Tab");
      await page
        .getByLabel("Альтернативный текст", { exact: true })
        .fill("Нейтральный тестовый знак");
      await page.getByLabel("Показывать фотографию", { exact: true }).uncheck();
      await page
        .getByRole("button", { name: "Переместить выше", exact: true })
        .click();
      assert.equal(await page.locator(".editor-item-list button").count(), 13);
      assert.equal(
        await page
          .getByLabel("Показывать фотографию", { exact: true })
          .isChecked(),
        false,
      );
      await page.getByRole("button", { name: "Удалить", exact: true }).click();
      assert.equal(await page.locator(".editor-item-list button").count(), 12);
    },
  );
  await check(
    "Manual video configuration and unconfirmed reviews stay honest",
    async () => {
      await page
        .getByRole("button", { name: "Видео и отзывы", exact: true })
        .click();
      await page
        .getByLabel("Описание", { exact: true })
        .fill("Тестовое описание выбранного видео");
      await page.getByRole("button", { name: "Добавить", exact: true }).click();
      await page
        .getByLabel("Автор", { exact: true })
        .fill("Тестовая запись — не публиковать");
      await page
        .getByLabel("Текст отзыва", { exact: true })
        .fill("Неподтверждённая запись для проверки скрытого состояния");
      assert.equal(
        await page
          .getByLabel(
            "Подтверждаю, что отзыв настоящий и согласован для публикации",
            { exact: true },
          )
          .isChecked(),
        false,
      );
      await page
        .getByRole("button", { name: "Сохранить", exact: true })
        .click();
      const live = await context.newPage();
      await live.goto("http://127.0.0.1:5173/vk", { waitUntil: "networkidle" });
      assert.ok(
        !(await live.locator("main").textContent()).includes(
          "Неподтверждённая запись",
        ),
      );
      await live.close();
      await page
        .getByRole("button", { name: "Сбросить всё", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Сохранить", exact: true })
        .click();
    },
  );
  await check("Editor mobile layout and no console errors", async () => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.getByRole("button", { name: "Контакты", exact: true }).click();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    await page.screenshot({
      path: "test-results/editor-mobile-360.png",
      scale: "css",
    });
    assert.deepEqual(errors, []);
  });
  await check("Unsaved changes produce a beforeunload warning", async () => {
    await page
      .getByLabel("Телефон", { exact: true })
      .fill("+7 (000) 111-11-11");
    const dialogEvent = page.waitForEvent("dialog");
    const reload = page.reload({ waitUntil: "domcontentloaded" });
    const dialog = await dialogEvent;
    assert.equal(dialog.type(), "beforeunload");
    await reload;
    await page.getByRole("button", { name: "Контакты", exact: true }).waitFor();
  });
} finally {
  await mkdir("test-results", { recursive: true });
  await writeFile(
    "test-results/editor-extra-results.json",
    JSON.stringify(
      { results, errors, engine: await browser.version() },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({
      passed: results.filter((item) => item.passed).length,
      total: results.length,
    }),
  );
  await browser.close();
}
if (results.some((item) => !item.passed)) process.exitCode = 1;
