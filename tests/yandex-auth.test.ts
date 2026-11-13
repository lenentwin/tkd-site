import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchYandexSession, logoutYandexSession } from "../src/services/yandexAuth";
const csrf = "x".repeat(43);
const profile = { authenticated: true, user: { id: 1, role: "user" }, csrfToken: csrf };
afterEach(() => vi.unstubAllGlobals());
describe("Yandex server auth adapter", () => {
  it("loads only a validated server profile with cookies", async () => {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify(profile)));
    vi.stubGlobal("fetch", request);
    expect((await fetchYandexSession()).session).toMatchObject({ mode: "server", id: 1, role: "user" });
    expect(request.mock.calls[0][1]).toMatchObject({ credentials: "include", cache: "no-store" });
  });
  it("treats 401 as signed out and does not fake success for network errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 401 })));
    expect((await fetchYandexSession()).session).toBeNull();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    await expect(fetchYandexSession()).rejects.toThrow();
  });
  it("rejects malformed profiles and unrecognized roles", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ ...profile, user: { id: 1, role: "admin" } }))));
    await expect(fetchYandexSession()).rejects.toThrow();
  });
  it("posts logout with CSRF and reports server failure", async () => {
    const request = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(profile))).mockResolvedValueOnce(new Response("{}", { status: 503 }));
    vi.stubGlobal("fetch", request);
    await expect(logoutYandexSession()).rejects.toThrow();
    expect(request.mock.calls[1][0]).toBe("https://api.mft39.ru/api/logout/index.php");
    expect(request.mock.calls[1][1]).toMatchObject({ method: "POST", credentials: "include", headers: { "X-CSRF-Token": csrf } });
  });
});
