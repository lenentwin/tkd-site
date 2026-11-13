import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";

const out = "test-results/revision-2026-11-12";
await mkdir(out, { recursive: true });
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
async function check(name, action) {
  try {
    const evidence = await action();
    results.push({ name, passed: true, evidence });
    console.log("PASS " + name);
  } catch (error) {
    results.push({ name, passed: false, error: error.message });
    console.log("FAIL " + name + ": " + error.message);
    await page
      .screenshot({ path: `${out}/failure-${results.length}.png` })
      .catch(() => {});
  }
}
async function candidate() {
  return page.locator(".hero-carousel").evaluate((root) => {
    const cards = [...root.querySelectorAll(".hero-card")];
    for (const [index, card] of cards.entries()) {
      if (card.dataset.active === "true") continue;
      const box = card.getBoundingClientRect();
      for (const fraction of [0.5, 0.25, 0.75]) {
        const x = box.left + box.width * fraction,
          y = box.top + box.height * 0.55;
        if (
          x < innerWidth * 0.46 ||
          x > innerWidth - 25 ||
          y < 170 ||
          y > innerHeight - 20
        )
          continue;
        if (document.elementFromPoint(x, y)?.closest(".hero-card") === card)
          return { index, x, y };
      }
    }
    return null;
  });
}
try {
  await page.goto("http://127.0.0.1:5173/", { waitUntil: "networkidle" });
  await page.waitForTimeout(3800);
  await check(
    "Gold layer is aligned below text and does not participate in layout",
    async () => {
      const evidence = await page.locator(".hero-motto").evaluate((root) => ({
        label: root.getAttribute("aria-label"),
        gold: [...root.querySelectorAll(".motto-letter")].map((letter) => {
          const gold = letter.querySelector(".motto-gold"),
            heavy = letter.querySelector(".motto-heavy");
          const a = gold.getBoundingClientRect(),
            b = heavy.getBoundingClientRect();
          return {
            position: getComputedStyle(gold).position,
            dx: a.x - b.x,
            dy: a.y - b.y,
            stroke: getComputedStyle(gold).webkitTextStrokeWidth,
          };
        }),
        copyWidth: root.parentElement.getBoundingClientRect().width,
        textWidth: root.getBoundingClientRect().width,
        fill: getComputedStyle(root.querySelector(".motto-heavy"))
          .backgroundImage,
        duration: getComputedStyle(root.querySelector(".motto-gold"))
          .animationDuration,
      }));
      assert.ok(
        evidence.gold.every(
          (item) =>
            item.position === "absolute" &&
            Math.abs(item.dx) < 0.1 &&
            Math.abs(item.dy) <= 1,
        ),
      );
      assert.ok(evidence.textWidth <= evidence.copyWidth + 2);
      assert.equal(evidence.duration, "1.5s");
      assert.ok(evidence.fill.includes("linear-gradient"));
      assert.equal(await page.locator(".hero-discipline").count(), 0);
      assert.equal(
        await page.locator(".hero-carousel-controls > p").count(),
        0,
      );
      await page.screenshot({
        path: `${out}/hero-desktop-dark.png`,
        scale: "css",
      });
      return {
        glyphs: evidence.gold.length,
        duration: evidence.duration,
        fill: evidence.fill,
      };
    },
  );
  await check(
    "Center photo is larger and timed ease-in-out promotes another frame",
    async () => {
      const before = await page
        .locator(".hero-carousel")
        .getAttribute("data-active-index");
      const sizes = await page
        .locator(".hero-card")
        .evaluateAll((cards) =>
          cards.map((card) => ({
            active: card.dataset.active,
            width: card.getBoundingClientRect().width,
          })),
        );
      const center = sizes.find((item) => item.active === "true");
      assert.ok(
        center.width >
          Math.min(
            ...sizes
              .filter((item) => item.active !== "true")
              .map((item) => item.width),
          ) *
            1.2,
      );
      await page.waitForTimeout(6200);
      const after = await page
        .locator(".hero-carousel")
        .getAttribute("data-active-index");
      assert.notEqual(after, before);
      return { before, after, centerWidth: center.width };
    },
  );
  await check(
    "Pause stops ambient movement, selection remains usable",
    async () => {
      await page
        .getByRole("button", {
          name: "Приостановить автоматическое вращение",
          exact: true,
        })
        .click();
      await page.mouse.move(10, 110);
      await page.waitForTimeout(1300);
      const before = await page
        .locator(".hero-card")
        .first()
        .getAttribute("style");
      await page.waitForTimeout(350);
      assert.equal(
        await page.locator(".hero-card").first().getAttribute("style"),
        before,
      );
      const target = await candidate();
      assert.ok(target, "No visible peripheral frame");
      const scroll = await page.evaluate(() => ({ x: scrollX, y: scrollY }));
      await page.mouse.click(target.x, target.y);
      await page.waitForTimeout(1100);
      assert.equal(
        await page.locator(".hero-carousel").getAttribute("data-active-index"),
        String(target.index),
      );
      assert.deepEqual(
        await page.evaluate(() => ({ x: scrollX, y: scrollY })),
        scroll,
      );
      return { selected: target.index, scroll };
    },
  );
  await check(
    "Rapid clicks, tiny drags, release and right click never shift the page",
    async () => {
      const original = await page.evaluate(() => ({ x: scrollX, y: scrollY }));
      let selections = 0;
      for (let i = 0; i < 8; i++) {
        const target = await candidate();
        if (!target) continue;
        await page.mouse.move(target.x, target.y);
        await page.mouse.down();
        await page.mouse.move(target.x + (i % 2 ? 2 : 0), target.y + 1);
        await page.mouse.up();
        await page.waitForTimeout(90);
        selections++;
      }
      await page.waitForTimeout(1200);
      await page.mouse.click(1100, 500, { button: "right" });
      await page.keyboard.press("Escape");
      assert.deepEqual(
        await page.evaluate(() => ({ x: scrollX, y: scrollY })),
        original,
      );
      assert.equal(await page.locator(".hero-carousel.is-dragging").count(), 0);
      const transforms = await page
        .locator(".hero-card")
        .evaluateAll((cards) => cards.map((card) => card.style.transform));
      assert.ok(
        transforms.every(
          (value) => !value.includes("NaN") && !value.includes("Infinity"),
        ),
      );
      return { selections, finiteTransforms: true };
    },
  );
  await check(
    "Drag inertia settles to a center and keyboard selects without scrolling",
    async () => {
      const box = await page.locator(".hero-carousel").boundingBox();
      const x = Math.min(1300, box.x + box.width * 0.6),
        y = box.y + box.height * 0.45;
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x - 160, y + 2, { steps: 14 });
      await page.mouse.up();
      const released = await page
        .locator(".hero-card")
        .first()
        .getAttribute("style");
      await page.waitForTimeout(150);
      assert.notEqual(
        await page.locator(".hero-card").first().getAttribute("style"),
        released,
      );
      await page.waitForTimeout(2200);
      const current = page.locator(".hero-card[data-active=true]");
      await current.focus();
      const before = await page
        .locator(".hero-carousel")
        .getAttribute("data-active-index");
      const scroll = await page.evaluate(() => scrollY);
      await page.keyboard.press("ArrowRight");
      await page.waitForTimeout(1100);
      assert.notEqual(
        await page.locator(".hero-carousel").getAttribute("data-active-index"),
        before,
      );
      assert.equal(await page.evaluate(() => scrollY), scroll);
      return { inertia: true, keyboard: true };
    },
  );
  await check("Grid highlights strongly near the pointer", async () => {
    await page.mouse.move(350, 250);
    await page.waitForTimeout(500);
    const grid = await page
      .locator(".interactive-grid")
      .evaluate((el) => ({
        opacity: Number(getComputedStyle(el).opacity),
        background: getComputedStyle(el).backgroundImage,
        mask: getComputedStyle(el).maskImage,
      }));
    assert.ok(grid.opacity >= 0.6);
    assert.ok(grid.mask.includes("330px"));
    await page.screenshot({ path: `${out}/grid-lit.png`, scale: "css" });
    return grid;
  });
  await check("Revised Hero fits all eight widths in both themes", async () => {
    const records = [];
    for (const width of [360, 390, 430, 768, 1024, 1366, 1440, 1920]) {
      await page.setViewportSize({ width, height: width < 768 ? 844 : 1000 });
      for (const theme of ["dark", "light"]) {
        const current = await page.locator("html").getAttribute("data-theme");
        if (current !== theme)
          await page
            .getByRole("button", {
              name:
                theme === "dark"
                  ? "Включить тёмную тему"
                  : "Включить светлую тему",
              exact: true,
            })
            .click();
        await page.waitForTimeout(400);
        const geometry = await page.evaluate(() => ({
          width: innerWidth,
          scrollWidth: document.documentElement.scrollWidth,
          motto: document.querySelector(".hero-motto").getBoundingClientRect()
            .right,
          ctaBottom: document
            .querySelector(".hero-main-action .button")
            .getBoundingClientRect().bottom,
        }));
        assert.ok(geometry.scrollWidth <= width);
        assert.ok(geometry.motto <= width);
        if (width < 768) assert.ok(geometry.ctaBottom <= 844);
        records.push({ width, theme, ...geometry });
        if ([390, 768, 1440].includes(width))
          await page.screenshot({
            path: `${out}/hero-${width}-${theme}.png`,
            scale: "css",
          });
      }
    }
    return records;
  });
  await check(
    "Reduced motion: no auto/float/shine and manual controls still work",
    async () => {
      const reduced = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
        reducedMotion: "reduce",
      });
      const p = await reduced.newPage();
      await p.goto("http://127.0.0.1:5173/", { waitUntil: "networkidle" });
      const before = await p
        .locator(".hero-card")
        .first()
        .getAttribute("style");
      await p.waitForTimeout(500);
      assert.equal(
        await p.locator(".hero-card").first().getAttribute("style"),
        before,
      );
      assert.equal(
        await p
          .locator(".motto-gold")
          .first()
          .evaluate((el) => getComputedStyle(el).animationName),
        "none",
      );
      await p
        .getByRole("button", { name: "Повернуть карусель вперёд", exact: true })
        .click();
      assert.equal(
        await p.locator(".hero-carousel").getAttribute("data-active-index"),
        "1",
      );
      await p.screenshot({ path: `${out}/hero-reduced.png`, scale: "css" });
      await reduced.close();
      return { static: true, controls: true };
    },
  );
  await check("No uncaught browser errors", async () =>
    assert.deepEqual(errors, []),
  );
} finally {
  await writeFile(
    `${out}/hero-results.json`,
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
      errors,
    }),
  );
  await browser.close();
}
if (results.some((item) => !item.passed) || errors.length) process.exitCode = 1;
