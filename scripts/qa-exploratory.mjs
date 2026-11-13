import { chromium } from "playwright";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";

const browser = await chromium.launch({
  executablePath:
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
const errors = [],
  actions = [];
page.on("pageerror", (error) => errors.push(error.message));
const started = Date.now();
try {
  await page.goto("http://127.0.0.1:5173/", { waitUntil: "networkidle" });
  const until = Date.now() + 32000;
  while (Date.now() < until) {
    const toggle = page.getByRole("button", {
      name: /Включить (светлую|тёмную) тему/,
    });
    await toggle.click();
    actions.push("toggle theme");
    await page.getByRole("link", { name: "Тренер", exact: true }).click();
    actions.push("coach");
    await page.mouse.wheel(0, 520);
    await page.waitForTimeout(350);
    await page.getByRole("link", { name: "Галерея", exact: true }).click();
    const stop = page.getByRole("button", {
      name: "Остановить движение галереи",
      exact: true,
    });
    if (await stop.count()) await stop.click();
    await page
      .getByRole("button", { name: "Повернуть галерею вперёд", exact: true })
      .click();
    const photo = page.locator(".gallery-photo").first();
    await photo.focus();
    await page.keyboard.press("Enter");
    await page.getByRole("dialog").waitFor({ state: "visible" });
    actions.push("gallery keyboard open");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowLeft");
    await page.screenshot({
      path: "test-results/exploratory-dialog.png",
      scale: "css",
    });
    await page.keyboard.press("Escape");
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    await page.goBack();
    actions.push("history after dialog");
    await page
      .getByRole("link", { name: "Залы и контакты", exact: true })
      .first()
      .click();
    await page.getByRole("button", { name: "2ГИС", exact: true }).click();
    await page.locator(".location-option").nth(1).click();
    await page
      .getByRole("button", { name: "Яндекс Карты", exact: true })
      .click();
    actions.push("switch map service and venue");
    await page.setViewportSize({ width: 390, height: 844 });
    await page
      .getByRole("button", { name: "Открыть меню", exact: true })
      .click();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Escape");
    actions.push("mobile keyboard menu");
    await page.screenshot({
      path: "test-results/exploratory-mobile-contacts.png",
      scale: "css",
    });
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.getByRole("link", { name: /MFT39 — на главную/ }).click();
    await page.mouse.wheel(0, 650);
    await page.waitForTimeout(600);
  }
  assert.deepEqual(errors, []);
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  console.log(
    JSON.stringify({
      status: "PASS",
      elapsedMs: Date.now() - started,
      actions: actions.length,
      errors,
    }),
  );
  await writeFile(
    "test-results/exploratory-results.json",
    JSON.stringify(
      {
        elapsedMs: Date.now() - started,
        actions,
        errors,
        engine: await browser.version(),
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
