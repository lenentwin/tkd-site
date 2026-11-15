import { chromium } from "playwright";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";

// Deterministic raster exports of the existing brand vector, no new artwork.
const source = await readFile("public/favicon.svg", "utf8");
const inner = source.replace(/^<svg\b[^>]*>/, "").replace(/<\/svg>\s*$/, "");
const browser = await chromium.launch({ executablePath: process.env.BROWSER_PATH ?? "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: true });
await mkdir("public/pwa", { recursive: true });
try {
  const page = await browser.newPage();
  for (const [name, size, maskable] of [["icon-192.png",192,false],["icon-512.png",512,false],["icon-maskable-512.png",512,true],["apple-touch-icon.png",180,false]]) {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#101113"/><g' + (maskable ? ' transform="translate(8.96 8.96) scale(.72)"' : "") + '>' + inner + '</g></svg>';
    const png = await page.evaluate(async ({ svg, size }) => {
      const image = new Image(); image.src = "data:image/svg+xml;base64," + btoa(svg); await image.decode();
      const canvas = document.createElement("canvas"); canvas.width = canvas.height = size;
      const context = canvas.getContext("2d"); context.drawImage(image, 0, 0, size, size);
      return canvas.toDataURL("image/png").split(",")[1];
    }, { svg, size });
    const bytes = Buffer.from(png, "base64"); assert.equal(bytes.readUInt32BE(16), size); assert.equal(bytes.readUInt32BE(20), size);
    await writeFile("public/pwa/" + name, bytes);
  }
} finally { await browser.close(); }
console.log("PWA icons exported: 192, 512, maskable 512, Apple 180");
