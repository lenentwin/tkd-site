import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const output = path.resolve("test-results/yandex-map-revision");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath:
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: true,
});
const results = [];
const errors = [];
const venues = [
  {
    id: "chelnokova",
    name: "Центр развития тхэквондо МФТ",
    token: "CXCNaB8Z",
    expected: "улица Генерала Челнокова, 43",
  },
  {
    id: "city",
    name: "Центр тхэквондо МФТ — ТЦ «Сити»",
    token: "CXCNaKYV",
    expected: "Московский проспект, 171А",
  },
  {
    id: "school10",
    name: "Школа №10",
    token: "CXCNa0zI",
    expected: "улица Войнич, 1",
  },
];
function assert(value, message) {
  if (!value) throw new Error(message);
}
async function check(name, callback) {
  try {
    const evidence = await callback();
    results.push({ name, status: "PASS", evidence });
    console.log("PASS " + name);
  } catch (error) {
    results.push({ name, status: "FAIL", error: String(error) });
    console.log("FAIL " + name + " " + error);
  }
}

try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({
      viewport: { width, height: width < 768 ? 844 : 1000 },
      isMobile: width < 768,
      hasTouch: width < 768,
      locale: "ru-RU",
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(String(error)));
    let mapRequests = 0;
    page.on("request", (request) => {
      if (
        /api-maps\.yandex\.ru\/frame|yandex\.ru\/map-widget/.test(request.url())
      )
        mapRequests++;
    });
    await page.goto("http://127.0.0.1:5173/", { waitUntil: "networkidle" });
    await check(`Lazy map and removal of public 2GIS at ${width}`, async () => {
      assert(
        (await page.locator(".yandex-map-frame iframe").count()) === 0,
        "Map loaded before viewport",
      );
      assert(mapRequests === 0, "Map network request happened on first screen");
      assert(
        !/2ГИС|2GIS|2gis/i.test(await page.locator("#map").innerText()),
        "2GIS UI remains",
      );
      return { mapRequests, firstScreenIframeCount: 0, twoGisVisible: false };
    });
    await page.locator("#map").scrollIntoViewIfNeeded();
    let referenceBounds = null;
    for (const venue of venues) {
      await check(`Real embedded ${venue.id} map at ${width}`, async () => {
        const option = page
          .getByRole("group", { name: "Выбор зала", exact: true })
          .getByRole("button")
          .filter({ hasText: venue.name });
        if (width < 768) await option.tap();
        else await option.click();
        assert(
          (await option.getAttribute("aria-pressed")) === "true",
          "Selection not highlighted",
        );
        const iframe = page.locator(".yandex-map-frame iframe");
        await iframe.waitFor({ state: "attached", timeout: 10000 });
        await iframe.scrollIntoViewIfNeeded();
        assert(
          (await iframe.getAttribute("src")).includes(venue.token),
          "Iframe source does not match selected venue",
        );
        assert(
          (await iframe.getAttribute("title")).includes(venue.name),
          "Wrong iframe title",
        );
        assert(
          (await iframe.getAttribute("loading")) === "lazy",
          "Iframe not lazy",
        );
        const handle = await iframe.elementHandle();
        const frame = await handle.contentFrame();
        await frame.waitForFunction(
          (expected) => document.body?.innerText.includes(expected),
          venue.expected,
          { timeout: 30000 },
        );
        await frame.waitForFunction(
          () => document.body?.innerText.includes("© Яндекс"),
          undefined,
          { timeout: 10000 },
        );
        await page.waitForTimeout(1800);
        const text = await frame.locator("body").innerText();
        const controls = await frame
          .locator("button,[role=button]")
          .evaluateAll((items) =>
            items
              .map((item) => ({
                label: item.getAttribute("aria-label"),
                title: item.getAttribute("title"),
                text: item.innerText.slice(0, 45),
              }))
              .filter((item) => item.label || item.title)
              .slice(0, 35),
          );
        const bounds = await iframe.boundingBox();
        assert(
          bounds.width >= 300 && bounds.height >= 400,
          "Map rectangle too small",
        );
        if (!referenceBounds) referenceBounds = bounds;
        else
          assert(
            Math.abs(referenceBounds.width - bounds.width) < 2 &&
              Math.abs(referenceBounds.height - bounds.height) < 2,
            "Map rectangle jumps between venues",
          );
        assert(
          (await page.locator(".map-selected-summary h3").innerText()) ===
            venue.name,
          "Selected name out of sync",
        );
        assert(
          (
            await page.locator(".map-summary-actions a").getAttribute("href")
          ).endsWith(venue.token),
          "External link out of sync",
        );
        await page
          .locator(".map-canvas-column")
          .screenshot({
            path: path.join(output, `integrated-${venue.id}-${width}.png`),
          });
        const geometry = await page.evaluate(() => ({
          viewport: innerWidth,
          scrollWidth: document.documentElement.scrollWidth,
        }));
        assert(
          geometry.viewport === geometry.scrollWidth,
          "Horizontal overflow",
        );
        return {
          source: await iframe.getAttribute("src"),
          frameUrl: frame.url(),
          addressVerified: venue.expected,
          text: text.slice(0, 1200),
          bounds: { width: bounds.width, height: bounds.height },
          controls,
          ...geometry,
        };
      });
    }
    if (width === 1440) {
      await check("Offline fallback and reconnect", async () => {
        await context.setOffline(true);
        await page.waitForTimeout(150);
        assert(
          await page.locator(".map-embed-error").isVisible(),
          "No offline error state",
        );
        assert(
          (await page
            .locator(".map-summary-actions a")
            .getAttribute("href")) === "https://yandex.ru/maps/-/CXCNa0zI",
          "External fallback lost",
        );
        assert(
          (await page.locator(".map-selected-summary").innerText()).includes(
            "Войнич, 1",
          ),
          "Address lost offline",
        );
        await page
          .locator(".map-selected-summary")
          .screenshot({
            path: path.join(output, "offline-address-fallback.png"),
          });
        await context.setOffline(false);
        await page
          .locator(".map-embed-error")
          .waitFor({ state: "hidden", timeout: 30000 });
        return {
          errorVisible: true,
          addressPreserved: true,
          externalLinkPreserved: true,
          reconnect: true,
        };
      });
    }
    await context.close();
  }
} finally {
  await browser.close();
  await writeFile(
    path.join(output, "qa-results.json"),
    JSON.stringify({ results, errors }, null, 2),
  );
}
console.log(
  JSON.stringify(
    {
      checks: results.length,
      failures: results.filter((result) => result.status === "FAIL"),
      errors,
    },
    null,
    2,
  ),
);
if (results.some((result) => result.status === "FAIL") || errors.length)
  process.exitCode = 1;
