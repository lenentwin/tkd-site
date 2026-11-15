import assert from "node:assert/strict";
import { copyFile, readFile, stat, writeFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { createHash } from "node:crypto";

// GitHub Pages has no server-side SPA rewrite. Serve the built application
// through its custom 404 document, preserving pathname, query and hash.
// Keep this step separate from Vite's build: Cloudflare uses its native fallback.
const output = resolve("dist");
let html = await readFile(resolve(output, "index.html"), "utf8");
assert(!/\/src\/|\.tsx\b/.test(html), "Pages must never publish source entry points");
const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"?#]+\.(?:js|css))"/g)].map(match => match[1]);
assert(assets.some(path => path.endsWith(".js")), "Missing built JavaScript");
assert(assets.some(path => path.endsWith(".css")), "Missing built stylesheet");
for (const asset of assets) {
  const file = resolve(output, `.${asset}`);
  assert(file.startsWith(`${output}${sep}`), "Asset path escaped dist");
  assert((await stat(file)).isFile(), `Missing production asset: ${asset}`);
}
const domain = (await readFile("CNAME", "utf8")).trim();
assert.equal(domain, "mft39.ru", "Preserve the existing custom domain");
// Pages ignores Cloudflare _headers. Deliver the supported CSP directives in
// HTML before any script; keep development/HMR and Cloudflare builds unchanged.
const headers = await readFile("public/_headers", "utf8");
const policy = headers.match(/^\s*Content-Security-Policy:\s*(.+)$/m)?.[1];
assert(policy, "Missing security policy");
const metaPolicy = policy.split(";").map(value => value.trim()).filter(value => value && !/^(frame-ancestors|report-uri|report-to|sandbox)\b/i.test(value)).join("; ");
const escapeAttribute = value => value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
if (!/<meta\b[^>]*http-equiv=["']Content-Security-Policy["']/i.test(html)) {
  html = html.replace(/<head>/i, `<head>\n    <meta http-equiv="Content-Security-Policy" content="${escapeAttribute(metaPolicy)}" />\n    <meta name="referrer" content="strict-origin-when-cross-origin" />`);
}
assert(html.indexOf('http-equiv="Content-Security-Policy"') < html.indexOf("<script"), "CSP must precede scripts");
await writeFile(resolve(output, "index.html"), html);
const manifest = JSON.parse(await readFile(resolve(output, "manifest.webmanifest"), "utf8"));
assert.equal(manifest.name, "MFT39");
assert.equal(manifest.display, "standalone");
assert.equal(manifest.scope, "/");
assert.equal(manifest.start_url, "/");
for (const size of [192, 512]) {
  const icon = manifest.icons.find(item => item.sizes === size + "x" + size && item.purpose === "any");
  assert(icon, "Missing PWA icon " + size);
  const bytes = await readFile(resolve(output, "." + icon.src));
  assert.equal(bytes.readUInt32BE(16), size); assert.equal(bytes.readUInt32BE(20), size);
}
const worker = await readFile(resolve(output, "sw.js"), "utf8");
assert(worker.includes(createHash("sha256").update(html).digest("hex")), "PWA shell revision must match final HTML, including CSP");
await copyFile("CNAME", resolve(output, "CNAME"));
await copyFile(resolve(output, "index.html"), resolve(output, "404.html"));
await writeFile(resolve(output, ".nojekyll"), "");
console.log(`Pages artifact verified: ${assets.length} JS/CSS files, ${domain}, SPA fallback, HTML CSP`);
