import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const output = path.resolve("test-results/revision-nav-readability");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath:
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: true,
});
const results = [];
const errors = [];
const widths = [360, 390, 430, 768, 1024, 1366, 1440, 1920];
function assert(value, message) {
  if (!value) throw new Error(message);
}
async function check(name, callback) {
  try {
    const evidence = await callback();
    results.push({ name, status: "PASS", evidence });
    console.log(`PASS ${name}`);
  } catch (error) {
    results.push({ name, status: "FAIL", error: String(error) });
    console.log(`FAIL ${name}: ${error}`);
  }
}
const context = await browser.newContext({
  viewport: { width: 1440, height: 960 },
});
const page = await context.newPage();
page.on("pageerror", (error) => errors.push(String(error)));
try {
  await page.goto("http://127.0.0.1:5173/", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => document.fonts.ready);
  await check(
    "Desktop primary navigation uses the six requested homepage anchors",
    async () => {
      const nav = page.getByRole("navigation", {
        name: "Основная навигация",
        exact: true,
      });
      const links = await nav.locator("a").evaluateAll((items) =>
        items.map((item) => ({
          label: item.textContent.trim(),
          href: item.getAttribute("href"),
        })),
      );
      const expected = [
        "coach",
        "locations",
        "gallery",
        "rutube",
        "reviews",
        "contacts",
      ];
      assert(links.length === expected.length, "Unexpected primary link count");
      assert(
        links.every((link, index) => link.href === `/#${expected[index]}`),
        "A primary link still targets a separate page",
      );
      assert(
        links[3].label === "RuTube" && /VK/.test(links[4].label),
        "VK is not adjacent to RuTube",
      );
      assert(
        links.filter((link) => link.label === "Залы").length === 1 &&
          links[1].label === "Залы" &&
          !links.some((link) => link.label === "Победы"),
        "The requested halls label was not applied exactly once",
      );
      for (const link of links) {
        await nav.getByRole("link", { name: link.label, exact: true }).click();
        await page.waitForTimeout(750);
        const section = link.href.slice(2);
        assert(
          new URL(page.url()).pathname === "/" &&
            new URL(page.url()).hash === `#${section}`,
          `Wrong route: ${link.label}`,
        );
        const box = await page.locator(`#${section}`).boundingBox();
        const header = await page.locator(".site-header").boundingBox();
        assert(
          box && box.y < 960 && box.y + box.height > header.height,
          `Target not visible: ${link.label}`,
        );
        assert(
          (await nav
            .getByRole("link", { name: link.label, exact: true })
            .getAttribute("aria-current")) === "location",
          `No active location: ${link.label}`,
        );
      }
      return links;
    },
  );
  await check(
    "Navigation from a detail page and repeated hash return",
    async () => {
      await page.goto("http://127.0.0.1:5173/coach", {
        waitUntil: "domcontentloaded",
      });
      await page
        .getByRole("navigation", { name: "Основная навигация", exact: true })
        .getByRole("link", { name: "VK и отзывы", exact: true })
        .click();
      await page.waitForTimeout(750);
      assert(
        new URL(page.url()).pathname === "/" &&
          new URL(page.url()).hash === "#reviews",
        "Detail page navigation failed",
      );
      await page.mouse.move(700, 400);
      await page.mouse.wheel(0, -1500);
      await page.waitForTimeout(200);
      await page
        .getByRole("navigation", { name: "Основная навигация", exact: true })
        .getByRole("link", { name: "VK и отзывы", exact: true })
        .click();
      await page.waitForTimeout(750);
      const box = await page.locator("#reviews").boundingBox();
      assert(
        box && box.y >= 75 && box.y < 230,
        "Clicking the current hash did not scroll back",
      );
      return {
        pathname: new URL(page.url()).pathname,
        hash: new URL(page.url()).hash,
        targetY: box.y,
      };
    },
  );
  await check(
    "RuTube and VK have prominent paired official links",
    async () => {
      const group = page.getByRole("group", {
        name: "Официальные каналы клуба",
        exact: true,
      });
      const links = await group.locator("a").evaluateAll((items) =>
        items.map((item) => ({
          name: item.getAttribute("aria-label"),
          href: item.href,
          text: item.innerText,
          fontSize: getComputedStyle(item.querySelector("strong")).fontSize,
          x: item.getBoundingClientRect().x,
          width: item.getBoundingClientRect().width,
        })),
      );
      assert(links.length === 2, "Official channel pair is missing");
      assert(
        links.some((item) => item.href === "https://vk.ru/tkdmft39"),
        "Wrong VK link",
      );
      assert(
        links.some(
          (item) => item.href === "https://rutube.ru/channel/55532225/",
        ),
        "Wrong RuTube link",
      );
      assert(
        links.every((item) => parseFloat(item.fontSize) >= 35),
        "Channel labels are not prominent; readability.css may be unimported",
      );
      assert(
        links[1].x > links[0].x + 100,
        "Desktop channel links are not side by side",
      );
      await group.screenshot({
        path: path.join(output, "channels-desktop.png"),
      });
      return links;
    },
  );
  await check(
    "Reviews are explicit and the empty state contains no invented quotation",
    async () => {
      const section = page.locator("#reviews");
      assert(
        (await section
          .getByRole("heading", { name: "Отзывы", exact: true })
          .count()) === 1,
        "No explicit reviews heading",
      );
      assert(
        (await section
          .getByRole("heading", {
            name: "Подтверждённых отзывов пока нет",
            exact: true,
          })
          .count()) === 1,
        "No honest empty state",
      );
      assert(
        (await section.locator("blockquote").count()) === 0,
        "Unexpected fabricated quotation",
      );
      assert(
        (await section.locator(".quote-mark").count()) === 0,
        "Decorative quotation still imitates a review",
      );
      await section.screenshot({
        path: path.join(output, "reviews-desktop.png"),
      });
      return {
        heading: "Отзывы",
        emptyState: "Подтверждённых отзывов пока нет",
        quotations: 0,
      };
    },
  );
  await check(
    "Desktop content is larger and the 7.5 percent container is preserved",
    async () => {
      const sizes = await page.evaluate(() => {
        const font = (selector) =>
          parseFloat(
            getComputedStyle(document.querySelector(selector)).fontSize,
          );
        const container = document
          .querySelector(".header-inner")
          .getBoundingClientRect();
        return {
          nav: font(".desktop-nav a"),
          intro: font(".locations-section .section-heading p"),
          venue: font(".location-overview-item > p"),
          coach: font(".coach-biography"),
          map: font(".map-location-detail dd"),
          reviews: font(".reviews-empty p"),
          button: font(".reviews-empty .button"),
          left: container.left,
          right: innerWidth - container.right,
          viewport: innerWidth,
        };
      });
      assert(
        sizes.nav >= 15 &&
          sizes.intro >= 17 &&
          sizes.venue >= 16 &&
          sizes.coach >= 16 &&
          sizes.map >= 16 &&
          sizes.reviews >= 17 &&
          sizes.button >= 16,
        "Desktop text did not increase",
      );
      assert(
        sizes.left >= sizes.viewport * 0.075 - 1 &&
          sizes.right >= sizes.viewport * 0.075 - 1,
        "Desktop safe padding regressed",
      );
      return sizes;
    },
  );
  await check(
    "Mobile keyboard, Escape, theme and anchor selection",
    async () => {
      const mobile = await browser.newContext({
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      });
      const p = await mobile.newPage();
      try {
        await p.goto("http://127.0.0.1:5173/", { waitUntil: "domcontentloaded" });
        const toggle = p.getByRole("button", {
          name: "Открыть меню",
          exact: true,
        });
        await toggle.focus();
        await p.keyboard.press("Enter");
        await p.waitForTimeout(100);
        const menu = p.getByRole("navigation", {
          name: "Мобильная навигация",
          exact: true,
        });
        assert(await menu.isVisible(), "Keyboard did not open menu");
        const labels = await menu.locator("a").allTextContents();
        assert(
          labels.filter((label) => label.trim() === "Залы").length === 1 &&
            !labels.some((label) => label.trim() === "Победы"),
          "Mobile navigation still uses the old victories label",
        );
        assert(
          labels.findIndex((label) => label.trim() === "VK и отзывы") ===
            labels.findIndex((label) => label.trim() === "RuTube") + 1,
          "VK adjacency missing on mobile",
        );
        await p.keyboard.press("Escape");
        assert(
          await toggle.evaluate((el) => el === document.activeElement),
          "Escape did not restore toggle focus",
        );
        await toggle.tap();
        await menu
          .getByRole("link", { name: "VK и отзывы", exact: true })
          .tap();
        await p.waitForTimeout(600);
        assert(new URL(p.url()).hash === "#reviews", "Mobile anchor failed");
        assert(
          (await p
            .getByRole("button", { name: "Открыть меню", exact: true })
            .getAttribute("aria-expanded")) === "false",
          "Menu stayed open after selection",
        );
        assert(
          await p
            .locator("#reviews")
            .getByRole("heading", { name: "Отзывы", exact: true })
            .isVisible(),
          "Mobile reviews heading missing",
        );
        await p
          .getByRole("button", { name: "Включить светлую тему", exact: true })
          .tap();
        assert(
          (await p.locator("html").getAttribute("data-theme")) === "light",
          "Theme switch failed",
        );
        await p
          .locator("#reviews")
          .screenshot({ path: path.join(output, "reviews-mobile-light.png") });
        await p
          .locator(".club-channels")
          .screenshot({ path: path.join(output, "channels-mobile-light.png") });
        return {
          keyboard: true,
          escapeFocus: true,
          anchor: "#reviews",
          menuCloses: true,
          theme: "light",
        };
      } finally {
        await mobile.close();
      }
    },
  );
  for (const width of widths) {
    await check(`Responsive content ${width}px dark/light`, async () => {
      await page.setViewportSize({ width, height: width < 768 ? 844 : 960 });
      await page.goto("http://127.0.0.1:5173/#reviews", {
        waitUntil: "domcontentloaded",
      });
      await page.evaluate(() => document.fonts.ready);
      const states = [];
      for (const theme of ["dark", "light"]) {
        if ((await page.locator("html").getAttribute("data-theme")) !== theme)
          await page
            .getByRole("button", {
              name:
                theme === "dark"
                  ? "Включить тёмную тему"
                  : "Включить светлую тему",
              exact: true,
            })
            .click();
        await page.waitForTimeout(200);
        await page.screenshot({
          path: path.join(output, `header-${width}-${theme}.png`),
          clip: { x: 0, y: 0, width, height: 125 },
        });
        for (const selector of [".club-channels", "#reviews", "#locations"])
          await page.locator(selector).screenshot({
            path: path.join(
              output,
              `${selector.replace(/[^a-z-]/g, "")}-${width}-${theme}.png`,
            ),
          });
        const geometry = await page.evaluate(() => ({
          viewport: innerWidth,
          scrollWidth: document.documentElement.scrollWidth,
          navVisible:
            getComputedStyle(document.querySelector(".desktop-nav")).display !==
            "none",
          mobileVisible:
            getComputedStyle(document.querySelector(".mobile-menu-toggle"))
              .display !== "none",
          intro: parseFloat(
            getComputedStyle(
              document.querySelector(".locations-section .section-heading p"),
            ).fontSize,
          ),
          reviewText: parseFloat(
            getComputedStyle(document.querySelector(".reviews-empty p"))
              .fontSize,
          ),
        }));
        assert(
          geometry.scrollWidth === width,
          "Unexpected horizontal overflow",
        );
        assert(
          geometry.navVisible || geometry.mobileVisible,
          "Navigation disappeared",
        );
        assert(
          geometry.intro >= (width < 768 ? 14 : 17) &&
            geometry.reviewText >= (width < 768 ? 15 : 17),
          "Content text is too small",
        );
        states.push({ theme, ...geometry });
      }
      return states;
    });
  }
} finally {
  await context.close();
  await browser.close();
  await writeFile(
    path.join(output, "results.json"),
    JSON.stringify({ results, errors }, null, 2),
  );
}
console.log(
  JSON.stringify(
    {
      checks: results.length,
      failures: results.filter((item) => item.status === "FAIL"),
      errors,
    },
    null,
    2,
  ),
);
if (results.some((item) => item.status === "FAIL") || errors.length)
  process.exitCode = 1;
