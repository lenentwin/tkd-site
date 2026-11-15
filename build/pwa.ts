import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve, relative, sep } from "node:path";
import { build, type Plugin, type ResolvedConfig } from "vite";
import { isStaticResource } from "../src/pwa/policy";
import { addHtmlSecurity } from "./security";

/** A dependency-free Vite plugin: final static assets -> versioned native SW. */
export function mft39Pwa(): Plugin {
  let config: ResolvedConfig;
  return {
    name: "mft39-pwa",
    apply: "build",
    enforce: "post",
    configResolved(value) { config = value; },
    transformIndexHtml: { order: "post", async handler(html) {
      return addHtmlSecurity(html, await readFile(resolve(config.root, "public/_headers"), "utf8"));
    } },
    async closeBundle() {
      const output = resolve(config.root, config.build.outDir);
      const entries: { url: string; revision: string }[] = [];
      async function walk(directory: string): Promise<void> {
        for (const file of await readdir(directory, { withFileTypes: true })) {
          const path = resolve(directory, file.name);
          if (file.isDirectory()) { await walk(path); continue; }
          const url = "/" + relative(output, path).split(sep).join("/");
          if (!isStaticResource(new URL(url, "https://mft39.ru"), "https://mft39.ru")) continue;
          const contents = await readFile(path);
          if (contents.length > 3 * 1024 * 1024) throw new Error("PWA asset exceeds static cache budget: " + url);
          entries.push({ url, revision: createHash("sha256").update(contents).digest("hex") });
        }
      }
      await walk(output);
      entries.sort((a, b) => a.url.localeCompare(b.url));
      if (!entries.some(entry => entry.url === "/index.html") || !entries.some(entry => entry.url === "/manifest.webmanifest")) throw new Error("Missing PWA shell/manifest");
      const version = createHash("sha256").update(JSON.stringify(entries)).digest("hex").slice(0, 20);
      const result = await build({
        configFile: false, root: config.root, publicDir: false, logLevel: "error",
        define: { __MFT39_PRECACHE__: JSON.stringify(entries), __MFT39_PWA_BUILD__: JSON.stringify(version) },
        build: { write: false, emptyOutDir: false, sourcemap: false, target: "es2022", minify: true,
          lib: { entry: resolve(config.root, "src/sw.ts"), name: "Mft39ServiceWorker", formats: ["iife"] },
          rollupOptions: { output: { inlineDynamicImports: true } },
        },
      });
      const bundle = Array.isArray(result) ? result[0] : result;
      if (!("output" in bundle)) throw new Error("Missing compiled service worker");
      const worker = bundle.output.find(item => item.type === "chunk");
      if (!worker || worker.code.includes("__MFT39_PRECACHE__")) throw new Error("Invalid compiled service worker");
      await writeFile(resolve(output, "sw.js"), worker.code);
    },
  };
}
