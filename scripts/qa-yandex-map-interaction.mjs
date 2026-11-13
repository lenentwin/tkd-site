import { chromium } from "playwright";
import { writeFile } from "node:fs/promises";
const browser = await chromium.launch({
  executablePath:
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: true,
});
const results = [];
const readScale = (text) =>
  text
    .split("\n")
    .map((line) => line.trim())
    .find((line) => /^\d+(?:[.,]\d+)?\s*(?:км|м)$/.test(line));
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({
      viewport: { width, height: width < 768 ? 844 : 1000 },
      isMobile: width < 768,
      hasTouch: width < 768,
      locale: "ru-RU",
    });
    try {
      const page = await context.newPage();
      await page.goto("http://127.0.0.1:5173/#map", {
        waitUntil: "domcontentloaded",
      });
      const iframe = page.locator(".yandex-map-frame iframe");
      await iframe.waitFor({ state: "attached", timeout: 10000 });
      await iframe.scrollIntoViewIfNeeded();
      const frame = await (await iframe.elementHandle()).contentFrame();
      await frame.waitForFunction(
        () => document.body?.innerText.includes("улица Генерала Челнокова, 43"),
        undefined,
        { timeout: 30000 },
      );
      const close = frame.getByRole("button", { name: "Закрыть", exact: true });
      if (await close.count()) {
        if (width < 768) await close.first().tap();
        else await close.first().click();
      }
      const before = readScale(await frame.locator("body").innerText());
      if (!before)
        throw new Error("Scale indicator missing before interaction");
      const zoomIn = frame.getByRole("button", {
        name: "Приблизить",
        exact: true,
      });
      if (width < 768) await zoomIn.tap();
      else await zoomIn.click();
      await frame.waitForFunction(
        (initial) => {
          const scale = document.body?.innerText
            .split("\n")
            .map((line) => line.trim())
            .find((line) => /^\d+(?:[.,]\d+)?\s*(?:км|м)$/.test(line));
          return scale && scale !== initial;
        },
        before,
        { timeout: 10000 },
      );
      const enlarged = readScale(await frame.locator("body").innerText());
      await page
        .locator(".map-canvas-column")
        .screenshot({
          path: `test-results/yandex-map-revision/interactive-zoom-${width}.png`,
        });
      const zoomOut = frame.getByRole("button", {
        name: "Отдалить",
        exact: true,
      });
      if (width < 768) await zoomOut.tap();
      else await zoomOut.click();
      await frame.waitForFunction(
        (initial) =>
          document.body?.innerText
            .split("\n")
            .map((line) => line.trim())
            .some((line) => line === initial),
        before,
        { timeout: 10000 },
      );
      const restored = readScale(await frame.locator("body").innerText());
      results.push({
        width,
        status: "PASS",
        action: width < 768 ? "touch tap" : "mouse click",
        before,
        enlarged,
        restored,
      });
      console.log(JSON.stringify(results.at(-1)));
    } catch (error) {
      results.push({ width, status: "FAIL", error: String(error) });
      console.log(JSON.stringify(results.at(-1)));
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
  await writeFile(
    "test-results/yandex-map-revision/interaction-results.json",
    JSON.stringify(results, null, 2),
  );
}
if (results.some((result) => result.status === "FAIL")) process.exitCode = 1;
