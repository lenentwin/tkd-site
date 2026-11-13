import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const output = path.resolve('test-results/visual');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
const results = [];
const errors = [];
const widths = [360, 390, 430, 768, 1024, 1366, 1440, 1920];
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(String(error)));
  for (const width of widths) {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 960 });
    await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    if (await page.locator('html').getAttribute('data-theme') !== 'dark') await page.getByRole('button', { name: 'Включить тёмную тему' }).click();
    await page.waitForTimeout(3300);
    for (const theme of ['dark', 'light']) {
      if (await page.locator('html').getAttribute('data-theme') !== theme) await page.getByRole('button', { name: theme === 'dark' ? 'Включить тёмную тему' : 'Включить светлую тему' }).click();
      await page.waitForTimeout(350);
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      await page.screenshot({ path: path.join(output, `hero-${width}-${theme}.png`), scale: 'css' });
      await page.screenshot({ path: path.join(output, `full-${width}-${theme}.png`), fullPage: true, scale: 'css' });
      const geometry = await page.evaluate(() => {
        const cta = document.querySelector('.hero-main-action .button').getBoundingClientRect();
        const h1 = document.querySelector('h1').getBoundingClientRect();
        const nav = document.querySelector('.site-header').getBoundingClientRect();
        return { viewport: innerWidth, scrollWidth: document.documentElement.scrollWidth, cta: { x: cta.x, y: cta.y, right: cta.right, bottom: cta.bottom }, h1: { x: h1.x, right: h1.right }, nav: { height: nav.height }, fonts: [...document.fonts].map((font) => ({ family: font.family, weight: font.weight, status: font.status })) };
      });
      results.push({ width, theme, ...geometry });
      if (geometry.scrollWidth > geometry.viewport) throw new Error(`Horizontal overflow at ${width}/${theme}`);
      if (geometry.h1.right > width + 1) throw new Error(`Heading clipped at ${width}/${theme}`);
      if (width < 768 && geometry.cta.bottom > 844) throw new Error(`Mobile CTA below initial viewport at ${width}/${theme}`);
    }
  }
  await context.close();
} finally {
  await browser.close();
  await writeFile(path.join(output, 'viewport-results.json'), JSON.stringify({ results, errors }, null, 2));
}
console.log(JSON.stringify({ screenshots: results.length * 2, errors, geometry: results.map(({ width, theme, scrollWidth, cta, h1 }) => ({ width, theme, scrollWidth, cta, h1 })) }, null, 2));
