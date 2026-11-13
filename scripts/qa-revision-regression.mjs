import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const output = path.resolve("test-results/revision-2026-11-12");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath:
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: true,
});
const results = [];
const errors = [];
function assert(value, message) {
  if (!value) throw new Error(message);
}
async function check(name, callback) {
  try {
    const evidence = await callback();
    results.push({ name, passed: true, evidence });
    console.log(`PASS ${name}`);
  } catch (error) {
    results.push({ name, passed: false, error: String(error) });
    console.log(`FAIL ${name}: ${error}`);
  }
}
function captureErrors(page) {
  page.on("pageerror", (error) => errors.push(String(error)));
}
try {
  const desktop = await browser.newContext({
    viewport: { width: 1440, height: 960 },
  });
  const page = await desktop.newPage();
  captureErrors(page);
  await page.goto("http://127.0.0.1:5173/#gallery", {
    waitUntil: "domcontentloaded",
  });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(700);
  await check(
    "Second gallery retains photo navigation, Escape and restored keyboard focus",
    async () => {
      await page
        .getByRole("button", {
          name: "Остановить движение галереи",
          exact: true,
        })
        .click();
      const card = page.getByRole("button", {
        name: "Открыть фотографию: На тренировке",
        exact: true,
      });
      await card.click();
      assert(
        await page.locator("dialog").isVisible(),
        "Photo dialog did not open",
      );
      const first = await page.locator("#photo-title").innerText();
      await page
        .getByRole("button", { name: "Следующая фотография", exact: true })
        .click();
      assert(
        (await page.locator("#photo-title").innerText()) !== first,
        "Next photo did not change",
      );
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
      assert(
        (await page.locator("dialog").count()) === 0,
        "Escape did not close photo",
      );
      assert(
        await card.evaluate((element) => element === document.activeElement),
        "Focus was not restored",
      );
      await page.keyboard.press("Enter");
      assert(
        await page.locator("dialog").isVisible(),
        "Keyboard did not reopen photo",
      );
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
      return { next: true, escape: true, focus: true, keyboard: true };
    },
  );
  await check(
    "Second gallery drag retains inertia without opening a photo",
    async () => {
      const orbit = page.locator(".gallery-orbit");
      const box = await orbit.boundingBox();
      const first = page.locator(".gallery-photo").first();
      const before = await first.evaluate((element) => element.style.transform);
      await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
      await page.mouse.down();
      await page.mouse.move(
        box.x + box.width * 0.5 + 160,
        box.y + box.height * 0.5,
        { steps: 12 },
      );
      await page.mouse.up();
      const released = await first.evaluate(
        (element) => element.style.transform,
      );
      await page.waitForTimeout(300);
      const inertia = await first.evaluate(
        (element) => element.style.transform,
      );
      assert(
        before !== released && released !== inertia,
        "Gallery drag/inertia did not move",
      );
      assert(
        (await page.locator("dialog").count()) === 0,
        "Drag accidentally opened photo",
      );
      return { drag: true, inertia: true, accidentalDialog: false };
    },
  );
  await desktop.close();

  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const phone = await mobile.newPage();
  captureErrors(phone);
  await phone.goto("http://127.0.0.1:5173/", { waitUntil: "domcontentloaded" });
  await phone.evaluate(() => document.fonts.ready);
  await phone.waitForTimeout(500);
  await check(
    "Mobile Hero spacing clears the CTA caption and native scroll drives photos",
    async () => {
      const responsive = [];
      for (const width of [360, 390, 430, 600, 767]) {
        await phone.setViewportSize({ width, height: 844 });
        for (const theme of ["dark", "light"]) {
          if ((await phone.locator("html").getAttribute("data-theme")) !== theme) {
            await phone.getByRole("button", {
              name: theme === "dark" ? "Включить тёмную тему" : "Включить светлую тему",
              exact: true,
            }).tap();
          }
          await phone.waitForTimeout(100);
          const bounds = await phone.evaluate(() => ({
            caption: document.querySelector(".hero-main-action > p").getBoundingClientRect().bottom,
            photo: document.querySelector('.hero-card[data-active="true"]').getBoundingClientRect().top,
            overflow: document.documentElement.scrollWidth > innerWidth,
          }));
          assert(bounds.photo >= bounds.caption + 4 && !bounds.overflow, `Mobile Hero overlap/overflow at ${width}px ${theme}`);
          responsive.push({ width, theme, gap: bounds.photo - bounds.caption });
        }
      }
      await phone.setViewportSize({ width: 390, height: 844 });
      await phone.getByRole("button", { name: "Включить тёмную тему", exact: true }).tap();
      await phone.waitForTimeout(100);
      const geometry = await phone.evaluate(() => ({
        captionBottom: document
          .querySelector(".hero-main-action > p")
          .getBoundingClientRect().bottom,
        cardTop: document
          .querySelector('.hero-card[data-active="true"]')
          .getBoundingClientRect().top,
        ctaBottom: document
          .querySelector(".hero-main-action .button")
          .getBoundingClientRect().bottom,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      assert(
        geometry.cardTop >= geometry.captionBottom + 4,
        "Central photo overlaps caption",
      );
      assert(
        geometry.ctaBottom < 844 && geometry.scrollWidth === 390,
        "Mobile CTA or width regressed",
      );
      const first = phone.locator(".hero-card").first();
      const before = await first.evaluate((element) => element.style.transform);
      await phone.mouse.move(20, 300);
      await phone.mouse.wheel(0, 180);
      await phone.waitForTimeout(250);
      assert(
        (await phone.evaluate(() => scrollY)) > 0,
        "Native page scroll was blocked",
      );
      assert(
        before !== (await first.evaluate((element) => element.style.transform)),
        "Mobile scroll did not move photos",
      );
      await phone.mouse.wheel(0, -600);
      await phone.waitForTimeout(500);
      await phone.screenshot({
        path: path.join(output, "hero-mobile-spacing-final.png"),
      });
      return { ...geometry, responsive };
    },
  );
  await check(
    "Mobile halls menu scrolls to the requested section",
    async () => {
      await phone
        .getByRole("button", { name: "Открыть меню", exact: true })
        .tap();
      const menu = phone.getByRole("navigation", {
        name: "Мобильная навигация",
        exact: true,
      });
      const halls = menu.getByRole("link", { name: "Залы", exact: true });
      assert((await halls.count()) === 1, "Halls link is not unique");
      assert(
        (await menu
          .getByRole("link", { name: "Победы", exact: true })
          .count()) === 0,
        "Old label remains",
      );
      await halls.tap();
      await phone.waitForTimeout(700);
      assert(
        new URL(phone.url()).hash === "#locations",
        "Halls target is wrong",
      );
      const box = await phone.locator("#locations").boundingBox();
      assert(
        box.y >= 70 && box.y < 300,
        "Selected section was not scrolled into view",
      );
      return { hash: "#locations", sectionTop: box.y };
    },
  );
  await mobile.close();
  await check("Regression scenarios have no application errors", async () => {
    assert(errors.length === 0, errors.join("; "));
    return { errors: errors.length };
  });
} finally {
  await browser.close();
  await writeFile(
    path.join(output, "regression-results.json"),
    JSON.stringify({ results, errors }, null, 2),
  );
}
if (results.some((result) => !result.passed)) process.exitCode = 1;
