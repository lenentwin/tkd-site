import assert from "node:assert/strict";
import { copyFile, readFile, stat, writeFile } from "node:fs/promises";
import { resolve, sep } from "node:path";

// GitHub Pages has no server-side SPA rewrite. Serve the built application
// through its custom 404 document, preserving pathname, query and hash.
// Keep this step separate from Vite's build: Cloudflare uses its native fallback.
const output = resolve("dist");
const html = await readFile(resolve(output, "index.html"), "utf8");
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
await copyFile("CNAME", resolve(output, "CNAME"));
await copyFile(resolve(output, "index.html"), resolve(output, "404.html"));
await writeFile(resolve(output, ".nojekyll"), "");
console.log(`Pages artifact verified: ${assets.length} JS/CSS files, ${domain}, SPA fallback`);
