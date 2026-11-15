import { describe, expect, it } from "vitest";
import { isNetworkOnly, isStaticResource, navigationCanUseShell, oldCachesToDelete } from "../src/pwa/policy";
import { installPlatform } from "../src/pwa/runtime";
import { addHtmlSecurity } from "../build/security";
const origin = "https://mft39.ru";
const url = (path: string) => new URL(path, origin);

describe("PWA privacy boundaries", () => {
  it("allows only build-time static asset classes", () => {
    for (const path of ["/index.html", "/manifest.webmanifest", "/favicon.svg", "/assets/AccountPage-123.js", "/assets/index-123.css", "/fonts/bebas.woff2", "/images/hero.svg", "/pwa/icon-512.png"]) expect(isStaticResource(url(path), origin)).toBe(true);
    for (const path of ["/", "/account", "/account/trainer", "/login", "/admin", "/editor", "/api/me/", "/assets/students.json", "/config.local.php", "/images/private.json", "/404.html", "/sw.js"]) expect(isStaticResource(url(path), origin)).toBe(false);
  });
  it("never caches API, OAuth, cross-origin resources or tokenized URLs", () => {
    for (const path of ["/api/club/index.php?resource=students", "/API/me/", "/auth/yandex/start", "/oauth/callback", "/callback", "/?code=secret", "/?state=secret", "/assets/index.js?access_token=secret", "https://api.mft39.ru/api/me/", "https://oauth.yandex.ru/authorize", "https://other.invalid/assets/index.js"]) {
      expect(isNetworkOnly(url(path), origin)).toBe(true); expect(isStaticResource(url(path), origin)).toBe(false); expect(navigationCanUseShell(url(path), origin)).toBe(false);
    }
  });
  it("rejects static query variants and encoded path separators", () => {
    for (const path of ["/index.html?studentId=x", "/assets/index.js?x=1", "/images/%2fprivate.svg", "/images/%5cprivate.svg", "/images/%00.svg"]) expect(isStaticResource(url(path), origin)).toBe(false);
  });
  it("can serve only the public CSR shell for offline navigation", () => {
    expect(navigationCanUseShell(url("/account/book?location=city"), origin)).toBe(true);
    expect(isStaticResource(url("/account/book?location=city"), origin)).toBe(false);
  });
  it("cleans only owned caches and retains two older static releases for open tabs", () => {
    expect(oldCachesToDelete(["another-app", "mft39-static-a", "mft39-static-b", "mft39-static-c", "mft39-static-current"], "mft39-static-current")).toEqual(["mft39-static-a"]);
  });
});
describe("PWA installation and production HTML", () => {
  it("recognizes iPhone, iPad desktop UA, Android and desktop", () => {
    expect(installPlatform("iPhone Safari")).toBe("ios"); expect(installPlatform("Macintosh Safari", 5)).toBe("ios");
    expect(installPlatform("Android Chrome")).toBe("android"); expect(installPlatform("Windows Chrome")).toBe("desktop");
  });
  it("inserts CSP before scripts, removes unsupported meta directives and remains idempotent", () => {
    const headers = "Content-Security-Policy: default-src 'self'; worker-src 'self'; frame-ancestors 'none'; form-action 'none'";
    const html = addHtmlSecurity('<html><head><script src="/assets/index.js"></script></head></html>', headers);
    expect(html.indexOf("Content-Security-Policy")).toBeLessThan(html.indexOf("<script")); expect(html).not.toContain("frame-ancestors"); expect(html).toContain("worker-src");
    expect(addHtmlSecurity(html, headers)).toBe(html);
  });
});
