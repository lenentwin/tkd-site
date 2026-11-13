import { afterEach, describe, expect, it, vi } from "vitest";
import { bootstrapSchema, clubApi } from "../src/services/club";
import { currentPayment, kaliningradMonth } from "../src/pages/account/club/ClubProvider";
const csrf = "x".repeat(43); const id = "e264ab6a-6416-4fef-89e6-ea74157ddcc0";
const profile = { authenticated: true, user: { id: 1, role: "user" }, csrfToken: csrf };
const input = { students: [{ lastName: "Проверкин", firstName: "Пример", middleName: "", age: 25 }], locationId: "city", requestedDate: "2026-11-30" };
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
afterEach(() => vi.unstubAllGlobals());
describe("Club transport and calendar", () => {
  it("uses Kaliningrad midnight at both month and year boundaries", () => {
    expect(kaliningradMonth(Date.parse("2026-11-30T21:59:59Z"))).toBe("2026-11");
    expect(kaliningradMonth(Date.parse("2026-11-30T22:00:00Z"))).toBe("2026-12");
    expect(kaliningradMonth(Date.parse("2026-12-31T21:59:59Z"))).toBe("2026-12");
    expect(kaliningradMonth(Date.parse("2026-12-31T22:00:00Z"))).toBe("2027-01");
  });
  it("never displays a previous month's paid status as current", () => {
    expect(currentPayment({ month: "2026-12", status: "paid" }, "2027-01")).toBe("unknown");
    expect(currentPayment({ month: "2027-01", status: "unpaid" }, "2027-01")).toBe("unpaid");
  });
  it("requires the deployed schema and a valid server clock", () => {
    const value = { schemaVersion: 2, actor: { id: 1, role: "admin" }, staff: true, halls: [], scopeVersion: "v", cursor: 0, currentMonth: "2026-11", serverTime: "2026-11-30T12:00:00+00:00" };
    expect(bootstrapSchema.safeParse(value).success).toBe(true);
    expect(bootstrapSchema.safeParse({ ...value, serverTime: "invalid" }).success).toBe(false);
    expect(bootstrapSchema.safeParse({ ...value, schemaVersion: 1 }).success).toBe(false);
  });
  it("posts to the approved Russian API with cookies, CSRF and idempotency key", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(json(profile)).mockResolvedValueOnce(json({ batchId: id, applicationIds: [id], replayed: false })); vi.stubGlobal("fetch", fetch);
    await expect(clubApi.enroll(input, "stable-idempotency-key")).resolves.toMatchObject({ applicationIds: [id] });
    expect(fetch.mock.calls[1][0]).toContain("https://api.mft39.ru/api/club/index.php?resource=applications");
    expect(fetch.mock.calls[1][1]).toMatchObject({ method: "POST", credentials: "include", cache: "no-store", headers: { "X-CSRF-Token": csrf, "Idempotency-Key": "stable-idempotency-key", "Content-Type": "application/json" } });
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual(input);
  });
  it("does not report success on an interrupted submission", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(json(profile)).mockRejectedValueOnce(new Error("offline")));
    await expect(clubApi.enroll(input, "stable-idempotency-key")).rejects.toMatchObject({ status: 0 });
  });
  it("does not retry stale payment updates silently", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(json(profile)).mockResolvedValueOnce(json({ error: "version_conflict" }, 409)); vi.stubGlobal("fetch", fetch);
    await expect(clubApi.payment(id, "2026-11", "paid", 0, "2026-11", "")).rejects.toMatchObject({ status: 409, code: "version_conflict" }); expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("clears the session on 401 and never sends an anonymous mutation", async () => {
    const dispatchEvent = vi.fn(); vi.stubGlobal("window", { dispatchEvent }); const fetch = vi.fn().mockResolvedValue(json({}, 401)); vi.stubGlobal("fetch", fetch);
    await expect(clubApi.enroll(input, "stable-idempotency-key")).rejects.toMatchObject({ status: 401 }); expect(fetch).toHaveBeenCalledTimes(1); expect(dispatchEvent).toHaveBeenCalledOnce();
  });
  it("rejects HTML or malformed success responses with a safe message", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>hosting failure</html>")));
    await expect(clubApi.bootstrap()).rejects.toMatchObject({ status: 502, code: "invalid_response" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ ok: true })));
    await expect(clubApi.bootstrap()).rejects.toMatchObject({ status: 502 });
  });
});
