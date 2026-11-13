import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const output = path.resolve("test-results/theme-revision");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: true,
});
const results = [];
const errors = [];
const assert = (value, message) => { if (!value) throw new Error(message); };
async function check(name, callback) {
  try {
    results.push({ name, passed: true, evidence: await callback() });
    console.log(`PASS ${name}`);
  } catch (error) {
    results.push({ name, passed: false, error: String(error) });
    console.log(`FAIL ${name}: ${error}`);
  }
}
async function newPage(options = {}, fallback = false) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, ...options });
  await context.addInitScript(({ fallback }) => {
    sessionStorage.setItem("mft39:intro-seen", "1");
    if (fallback) {
      Object.defineProperty(document, "startViewTransition", { value: undefined, configurable: true });
    } else if (document.startViewTransition) {
      const start = document.startViewTransition.bind(document);
      window.__themeFrames = [];
      document.startViewTransition = (callback) => {
        const transition = start(callback);
        transition.ready.then(() => {
          const animations = document.getAnimations().filter((animation) => /::view-transition-(old|new)\(root\)/.test(animation.effect?.pseudoElement ?? ""));
          const timings = animations.map((animation) => ({ pseudo: animation.effect.pseudoElement, duration: animation.effect.getTiming().duration }));
          if (window.__freezeTheme) {
            animations.forEach((animation) => {
              animation.pause();
              animation.currentTime = Number(animation.effect.getTiming().duration) / 2;
            });
            window.__frozenTheme = animations;
          }
          window.__themeFrames.push(timings);
        }).catch(() => undefined);
        return transition;
      };
    }
  }, { fallback });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.goto("http://127.0.0.1:5173/", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(150);
  return { context, page };
}
async function settle(page) {
  await page.waitForFunction(() => !document.documentElement.dataset.themeTransition);
}
async function freezeSwitch(page, name, duration) {
  await page.evaluate(() => {
    window.__freezeTheme = true;
    window.__frozenTheme = null;
  });
  await page.locator(".theme-toggle").click();
  await page.waitForFunction(() => window.__frozenTheme?.length === 2);
  const evidence = await page.evaluate(() => window.__themeFrames.at(-1));
  assert(evidence.every((animation) => animation.duration === duration), "Unexpected theme fade timing");
  await page.screenshot({ path: path.join(output, `${name}-mid.png`) });
  await page.evaluate(() => {
    window.__freezeTheme = false;
    window.__frozenTheme.forEach((animation) => animation.play());
  });
  await settle(page);
  await page.screenshot({ path: path.join(output, `${name}-end.png`) });
  return evidence;
}
try {
  const { context, page } = await newPage();
  await check("Theme fades from dark to light in a synchronized 300ms crossfade", async () => {
    const evidence = await freezeSwitch(page, "to-light", 300);
    assert(await page.locator("html").getAttribute("data-theme") === "light", "Light theme did not apply");
    return evidence;
  });
  await check("Light motto is solid black without gradient, stroke, gold or glow", async () => {
    const evidence = await page.evaluate(() => {
      const style = (selector) => getComputedStyle(document.querySelector(selector));
      return {
        fill: style(".motto-heavy").webkitTextFillColor,
        background: style(".motto-heavy").backgroundImage,
        stroke: style(".motto-heavy").webkitTextStrokeWidth,
        shadow: style(".motto-heavy").textShadow,
        gold: style(".motto-gold").display,
        glow: style(".hero-type-glow").display,
      };
    });
    assert(evidence.fill === "rgb(17, 17, 17)" && evidence.background === "none" && evidence.stroke === "0px" && evidence.shadow === "none", "Light text still has decorative fill/stroke");
    assert(evidence.gold === "none" && evidence.glow === "none", "Light glow remains visible");
    return evidence;
  });
  await check("Reverse fade restores the dark gradient and gold layer", async () => {
    const timings = await freezeSwitch(page, "to-dark", 300);
    const style = await page.locator(".motto-heavy").first().evaluate((element) => getComputedStyle(element).backgroundImage);
    assert(style.includes("linear-gradient"), "Dark gradient was lost");
    assert(await page.locator(".motto-gold").first().evaluate((element) => getComputedStyle(element).display) !== "none", "Dark gold layer was lost");
    return { timings, gradient: style };
  });
  await check("Rapid toggles settle on the saved theme and preserve scroll/focus", async () => {
    await page.mouse.wheel(0, 220);
    await page.waitForTimeout(100);
    const before = await page.evaluate(() => scrollY);
    for (let index = 0; index < 6; index += 1) {
      await page.locator(".theme-toggle").click({ force: true });
      await page.waitForTimeout(25);
    }
    await settle(page);
    const evidence = await page.evaluate(() => ({ theme: document.documentElement.dataset.theme, saved: localStorage.getItem("mft39.theme"), scroll: scrollY, focused: document.activeElement.classList.contains("theme-toggle") }));
    assert(evidence.theme === evidence.saved && evidence.theme === "dark", `Rapid toggle state diverged: ${JSON.stringify(evidence)}`);
    assert(Math.abs(before - evidence.scroll) < 2 && evidence.focused, "Theme switch moved the page or focus");
    return evidence;
  });
  await context.close();
  await check("Mobile light theme stays readable and fits the viewport", async () => {
    const mobile = await newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    try {
      await mobile.page.locator(".theme-toggle").tap();
      await settle(mobile.page);
      const evidence = await mobile.page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth, fill: getComputedStyle(document.querySelector(".motto-heavy")).webkitTextFillColor }));
      assert(evidence.width === evidence.scrollWidth && evidence.fill === "rgb(17, 17, 17)", "Mobile light theme regressed");
      await mobile.page.screenshot({ path: path.join(output, "light-mobile.png") });
      return evidence;
    } finally { await mobile.context.close(); }
  });
  await check("Reduced motion uses a short 150ms fade without movement", async () => {
    const reduced = await newPage({ reducedMotion: "reduce" });
    try {
      return await freezeSwitch(reduced.page, "reduced-to-light", 150);
    } finally { await reduced.context.close(); }
  });
  await check("Color fallback works when snapshot transitions are unavailable", async () => {
    const fallback = await newPage({}, true);
    try {
      await fallback.page.locator(".theme-toggle").click();
      const during = await fallback.page.evaluate(() => ({ mode: document.documentElement.dataset.themeTransition, properties: getComputedStyle(document.body).transitionProperty, duration: getComputedStyle(document.body).transitionDuration }));
      assert(during.mode === "fallback" && during.properties.includes("background-color") && during.duration.includes("0.3s"), "Fallback does not fade colors");
      await settle(fallback.page);
      assert(await fallback.page.locator("html").getAttribute("data-theme") === "light", "Fallback theme failed");
      return during;
    } finally { await fallback.context.close(); }
  });
  await check("Theme scenarios have no application errors", async () => {
    assert(errors.length === 0, errors.join("; "));
    return { errors: errors.length };
  });
} finally {
  await browser.close();
  await writeFile(path.join(output, "results.json"), JSON.stringify({ results, errors }, null, 2));
}
if (results.some((result) => !result.passed)) process.exitCode = 1;
